const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const anthropicService = require('../services/anthropicService');

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getScheduledPipelineLimit = () => {
  const limit = parseInt(process.env.AI_BLOG_SCHEDULED_PIPELINE_LIMIT, 10);
  return Number.isInteger(limit) && limit > 0 ? limit : 5;
};

const fitDateToPublishWindow = (date, windowStartStr = '08:00', windowEndStr = '22:00') => {
  const current = new Date(date.getTime());
  const [startH, startM] = windowStartStr.split(':').map(Number);
  const [endH, endM] = windowEndStr.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (true) {
    const curMinutes = current.getHours() * 60 + current.getMinutes();

    if (curMinutes >= startMinutes && curMinutes <= endMinutes) {
      return current;
    }

    if (curMinutes > endMinutes) {
      current.setDate(current.getDate() + 1);
      current.setHours(startH, startM, 0, 0);
    } else {
      current.setHours(startH, startM, 0, 0);
    }
  }
};

// Helper to generate unique slug
const generateUniqueSlug = async (title) => {
  let baseSlug = title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!baseSlug) baseSlug = 'artikel';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug }
    });
    if (!existing) {
      break;
    }
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

const resolveScheduledAt = async (job, item) => {
  if (job.publish_mode !== 'scheduled') {
    return null;
  }

  const intervalHours = job.interval_hours || 12;
  const windowStart = job.publish_window_start || '08:00';
  const windowEnd = job.publish_window_end || '22:00';
  const latestScheduledPost = await prisma.blogPost.findFirst({
    where: {
      ai_job_id: job.id,
      status: 'scheduled',
      scheduled_at: { not: null }
    },
    orderBy: { scheduled_at: 'desc' }
  });

  if (latestScheduledPost?.scheduled_at) {
    const nextDate = new Date(latestScheduledPost.scheduled_at.getTime());
    nextDate.setHours(nextDate.getHours() + intervalHours);
    return fitDateToPublishWindow(nextDate, windowStart, windowEnd);
  }

  const fallbackDate = item.scheduled_at || job.publish_start_at || new Date();
  return fitDateToPublishWindow(new Date(fallbackDate), windowStart, windowEnd);
};

async function processJobItem(job, item) {
  console.log(`[AI Worker] Processing item ID ${item.id}: "${item.title}"`);
  
  try {
    // 1. Update item status to generating
    await prisma.aiBlogJobItem.update({
      where: { id: item.id },
      data: { status: 'generating' }
    });

    // 2. Generate article using Anthropic API
    const articleData = await anthropicService.generateSeoArticle(item.title, job.knowledge_base);
    
    // 3. Resolve slug uniqueness
    const finalSlug = await generateUniqueSlug(articleData.slug || item.title);

    // 4. Determine status and scheduling dates
    let postStatus = 'draft';
    let publishedAt = null;
    let scheduledAt = null;

    if (job.publish_mode === 'published') {
      postStatus = 'published';
      publishedAt = new Date();
    } else if (job.publish_mode === 'scheduled') {
      postStatus = 'scheduled';
      scheduledAt = await resolveScheduledAt(job, item);
    }

    // 5. Create the BlogPost
    const newPost = await prisma.blogPost.create({
      data: {
        title: articleData.title || item.title,
        slug: finalSlug,
        excerpt: articleData.excerpt || null,
        content: articleData.content,
        featured_image: job.featured_image || null,
        category_id: job.category_id,
        author_id: job.created_by,
        status: postStatus,
        source: 'ai',
        meta_title: articleData.meta_title || null,
        meta_description: articleData.meta_description || null,
        focus_keyword: articleData.focus_keyword || null,
        canonical_url: null,
        scheduled_at: scheduledAt,
        published_at: publishedAt,
        ai_job_id: job.id
      }
    });

    // 6. Mark item completed
    await prisma.aiBlogJobItem.update({
      where: { id: item.id },
      data: {
        status: 'completed',
        slug: finalSlug,
        blog_post_id: newPost.id,
        scheduled_at: scheduledAt
      }
    });

    // 7. Update Job counters
    await prisma.aiBlogJob.update({
      where: { id: job.id },
      data: {
        generated_count: { increment: 1 }
      }
    });

    console.log(`[AI Worker] Item ID ${item.id} completed successfully. Post ID: ${newPost.id}`);
  } catch (error) {
    console.error(`[AI Worker] Error processing item ID ${item.id}:`, error.message);
    
    // Mark item as failed
    await prisma.aiBlogJobItem.update({
      where: { id: item.id },
      data: {
        status: 'failed',
        error_message: error.message
      }
    });

    // Update job failed count
    await prisma.aiBlogJob.update({
      where: { id: job.id },
      data: {
        failed_count: { increment: 1 }
      }
    });
  }
}

const shouldPauseScheduledJob = async (job) => {
  if (job.publish_mode !== 'scheduled') {
    return false;
  }

  const scheduledCount = await prisma.blogPost.count({
    where: {
      ai_job_id: job.id,
      status: 'scheduled'
    }
  });

  return scheduledCount >= getScheduledPipelineLimit();
};

const markJobRunning = async (job) => {
  if (job.status !== 'pending') {
    return job;
  }

  const startedAt = job.started_at || new Date();
  const updatedJob = await prisma.aiBlogJob.update({
    where: { id: job.id },
    data: {
      status: 'running',
      started_at: startedAt
    },
    include: {
      items: {
        where: { status: 'pending' },
        orderBy: { id: 'asc' }
      }
    }
  });

  console.log(`[AI Worker] Job ID ${updatedJob.id} ("${updatedJob.batch_name || 'Unnamed Batch'}") started.`);
  return updatedJob;
};

const finishJobIfReady = async (job) => {
  const generatingItemsCount = await prisma.aiBlogJobItem.count({
    where: { ai_job_id: job.id, status: 'generating' }
  });

  if (generatingItemsCount > 0) {
    return true;
  }

  const pendingItemsCount = await prisma.aiBlogJobItem.count({
    where: { ai_job_id: job.id, status: 'pending' }
  });

  if (pendingItemsCount > 0) {
    return false;
  }

  const freshJobData = await prisma.aiBlogJob.findUnique({
    where: { id: job.id }
  });

  let finalStatus = 'completed';
  if (freshJobData.generated_count === 0 && freshJobData.failed_count > 0) {
    finalStatus = 'failed';
  }

  await prisma.aiBlogJob.update({
    where: { id: job.id },
    data: {
      status: finalStatus,
      completed_at: new Date()
    }
  });
  console.log(`[AI Worker] Job ID ${job.id} finished with status: ${finalStatus}`);
  return true;
};

async function runWorker() {
  console.log('[AI Worker] AI Blog Generation Worker started and polling database...');
  
  while (true) {
    try {
      // Find active jobs and process the first one that has an open generation slot.
      const activeJobs = await prisma.aiBlogJob.findMany({
        where: {
          status: { in: ['pending', 'running'] }
        },
        orderBy: { created_at: 'asc' },
        include: {
          items: {
            where: { status: 'pending' },
            orderBy: { id: 'asc' }
          }
        }
      });

      if (activeJobs.length === 0) {
        // No pending or running jobs, rest for a bit
        await sleep(5000);
        continue;
      }

      let didWork = false;

      for (const job of activeJobs) {
        const pendingItem = job.items[0];

        if (!pendingItem) {
          didWork = await finishJobIfReady(job) || didWork;
          continue;
        }

        if (await shouldPauseScheduledJob(job)) {
          continue;
        }

        const activeJob = await markJobRunning(job);
        await processJobItem(activeJob, pendingItem);
        didWork = true;
        break;
      }

      // Wait a small buffer after work to prevent API rate spikes. If every
      // scheduled batch is full, rest longer until scheduler opens a slot.
      await sleep(didWork ? 2000 : 30000);
    } catch (loopError) {
      console.error('[AI Worker] Loop error:', loopError);
      await sleep(10000);
    }
  }
}

if (require.main === module) {
  runWorker().catch(err => {
    console.error('[AI Worker] FATAL crash:', err);
    process.exit(1);
  });
}

module.exports = { runWorker };
