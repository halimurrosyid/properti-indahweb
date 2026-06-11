const { PrismaClient } = require('@prisma/client');
const { notifyUser, isTemplateEnabled, getSiteUrl } = require('../services/emailService');
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

function startOfDayKey(date) {
  return date.toISOString().split('T')[0];
}

async function sendPackageExpiryReminders() {
  if (!await isTemplateEnabled(prisma, 'email_package_notifications_enabled')) {
    return;
  }

  const now = new Date();
  const windows = [
    { label: 'H-3', minDays: 2, maxDays: 3 },
    { label: 'H-1', minDays: 0, maxDays: 1 }
  ];

  try {
    for (const window of windows) {
      const from = new Date(now.getTime() + window.minDays * 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + window.maxDays * 24 * 60 * 60 * 1000);

      const agents = await prisma.user.findMany({
        where: {
          role: 'agent',
          agentUntil: {
            gte: from,
            lt: to
          },
          email: { not: null }
        }
      });

      for (const user of agents) {
        await notifyUser(
          prisma,
          user,
          'package_expiring',
          `Paket agen Anda akan berakhir ${window.label}`,
          'Paket agen hampir berakhir',
          `Paket agen Anda akan berakhir pada ${user.agentUntil.toLocaleDateString('id-ID')}. Perpanjang paket agar kuota listing tetap aktif.`,
          { label: 'Lihat Paket', url: `${getSiteUrl()}/packages` },
          { userId: user.id, agentUntil: user.agentUntil },
          `agent-expiry:${user.id}:${window.label}:${startOfDayKey(user.agentUntil)}`
        );
      }

      const properties = await prisma.property.findMany({
        where: {
          isFeatured: true,
          featuredUntil: {
            gte: from,
            lt: to
          }
        },
        include: { user: true }
      });

      for (const property of properties) {
        await notifyUser(
          prisma,
          property.user,
          'featured_expiring',
          `Featured listing akan berakhir ${window.label}`,
          'Featured listing hampir berakhir',
          `Masa featured untuk listing "${property.title}" akan berakhir pada ${property.featuredUntil.toLocaleDateString('id-ID')}.`,
          { label: 'Lihat Listing', url: `${getSiteUrl()}/property/${property.slug}` },
          { propertyId: property.id, featuredUntil: property.featuredUntil },
          `featured-expiry:${property.id}:${window.label}:${startOfDayKey(property.featuredUntil)}`
        );
      }
    }
  } catch (error) {
    console.error('[Package Scheduler] Error sending package expiry reminders:', error);
  }
}

async function runScheduler() {
  console.log('[Blog Scheduler] Automated Publish & Premium Listing Scheduler started and polling database...');
  
  while (true) {
    await checkScheduledPosts();
    await checkExpiredFeaturedProperties();
    await checkExpiredAgentPackages();
    await sendPackageExpiryReminders();
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
