const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const anthropicService = require('../services/anthropicService');

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
      scheduledAt = item.scheduled_at;
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
        blog_post_id: newPost.id
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

async function runWorker() {
  console.log('[AI Worker] AI Blog Generation Worker started and polling database...');
  
  while (true) {
    try {
      // Find a job that is running or pending
      let activeJob = await prisma.aiBlogJob.findFirst({
        where: {
          status: { in: ['pending', 'running'] }
        },
        include: {
          items: {
            where: { status: 'pending' },
            orderBy: { id: 'asc' }
          }
        }
      });

      if (!activeJob) {
        // No pending or running jobs, rest for a bit
        await sleep(5000);
        continue;
      }

      // If job is pending, mark it running
      if (activeJob.status === 'pending') {
        activeJob = await prisma.aiBlogJob.update({
          where: { id: activeJob.id },
          data: {
            status: 'running',
            started_at: new Date()
          },
          include: {
            items: {
              where: { status: 'pending' },
              orderBy: { id: 'asc' }
            }
          }
        });
        console.log(`[AI Worker] Job ID ${activeJob.id} ("${activeJob.batch_name || 'Unnamed Batch'}") started.`);
      }

      // Process the first pending item
      const pendingItem = activeJob.items[0];
      if (pendingItem) {
        await processJobItem(activeJob, pendingItem);
        // Wait a small buffer time (e.g. 2s) to prevent Anthropic rate-limiting spikes
        await sleep(2000);
      } else {
        // If there are no more pending items, complete the job
        // Check if there are any generating items still in progress (highly unlikely with sequential runs, but safe)
        const generatingItemsCount = await prisma.aiBlogJobItem.count({
          where: { ai_job_id: activeJob.id, status: 'generating' }
        });

        if (generatingItemsCount === 0) {
          const freshJobData = await prisma.aiBlogJob.findUnique({
            where: { id: activeJob.id }
          });

          let finalStatus = 'completed';
          if (freshJobData.generated_count === 0 && freshJobData.failed_count > 0) {
            finalStatus = 'failed';
          }

          await prisma.aiBlogJob.update({
            where: { id: activeJob.id },
            data: {
              status: finalStatus,
              completed_at: new Date()
            }
          });
          console.log(`[AI Worker] Job ID ${activeJob.id} finished with status: ${finalStatus}`);
        }
      }
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
