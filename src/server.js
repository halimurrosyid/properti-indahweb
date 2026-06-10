const app = require('./app');
const PORT = process.env.PORT || 3000;
const shouldRunBackgroundJobs = process.env.RUN_BACKGROUND_JOBS !== 'false';

app.listen(PORT, () => {
  console.log(`Server 1rumah.biz.id is running on http://localhost:${PORT}`);

  if (shouldRunBackgroundJobs) {
    const { runWorker: runAiBlogWorker } = require('./workers/aiBlogWorker');
    const { runScheduler: runBlogScheduler } = require('./workers/blogScheduler');

    runAiBlogWorker().catch(err => {
      console.error('[AI Worker] FATAL crash:', err);
      process.exit(1);
    });

    runBlogScheduler().catch(err => {
      console.error('[Blog Scheduler] FATAL crash:', err);
      process.exit(1);
    });
  } else {
    console.log('Background jobs are disabled by RUN_BACKGROUND_JOBS=false');
  }
});
