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

async function checkExpiredFeaturedProperties() {
  const now = new Date();
  
  try {
    // Find and update properties whose premium duration has ended
    const expired = await prisma.property.updateMany({
      where: {
        isFeatured: true,
        featuredUntil: {
          lt: now
        }
      },
      data: {
        isFeatured: false
      }
    });

    if (expired.count > 0) {
      console.log(`[Property Scheduler] Deactivated ${expired.count} expired premium (Featured) listings.`);
    }
  } catch (error) {
    console.error('[Property Scheduler] Error checking expired premium listings:', error);
  }
}

async function checkExpiredAgentPackages() {
  const now = new Date();

  try {
    const expired = await prisma.user.updateMany({
      where: {
        role: 'agent',
        agentUntil: {
          lt: now
        }
      },
      data: {
        role: 'user',
        listingLimit: 1,
        agentUntil: null,
        activePackageCode: null
      }
    });

    if (expired.count > 0) {
      console.log(`[Package Scheduler] Downgraded ${expired.count} expired agent subscriptions.`);
    }
  } catch (error) {
    console.error('[Package Scheduler] Error checking expired agent packages:', error);
  }
}

async function runScheduler() {
  console.log('[Blog Scheduler] Automated Publish & Premium Listing Scheduler started and polling database...');
  
  while (true) {
    await checkScheduledPosts();
    await checkExpiredFeaturedProperties();
    await checkExpiredAgentPackages();
    // Check every 30 seconds
    await sleep(30000);
  }
}

if (require.main === module) {
  runScheduler().catch(err => {
    console.error('[Blog Scheduler] FATAL crash:', err);
    process.exit(1);
  });
}

module.exports = { runScheduler };
