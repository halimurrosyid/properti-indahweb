const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkScheduledPosts() {
  const now = new Date();
  
  try {
    // Find all scheduled posts whose scheduled_at time is <= now
    const pendingPosts = await prisma.blogPost.findMany({
      where: {
        status: 'scheduled',
        scheduled_at: {
          lte: now
        }
      }
    });

    if (pendingPosts.length === 0) {
      return;
    }

    console.log(`[Blog Scheduler] Found ${pendingPosts.length} posts waiting to be published...`);

    for (const post of pendingPosts) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: {
          status: 'published',
          published_at: now
        }
      });
      console.log(`[Blog Scheduler] Post ID ${post.id} ("${post.title}") has been published automatically.`);
    }
  } catch (error) {
    console.error('[Blog Scheduler] Error checking scheduled posts:', error);
  }
}

async function runScheduler() {
  console.log('[Blog Scheduler] Automated Publish Scheduler started and polling database...');
  
  while (true) {
    await checkScheduledPosts();
    // Check every 30 seconds
    await sleep(30000);
  }
}

// Start execution
runScheduler().catch(err => {
  console.error('[Blog Scheduler] FATAL crash:', err);
  process.exit(1);
});
