const app = require('./app');
const config = require('./config');
const db = require('./database/h2');
const { seedDevelopmentAgent, seedMockReviews } = require('./services/seed-agent');

let server;

async function start() {
  try {
    await db.startDatabase();
    await seedDevelopmentAgent();
    await seedMockReviews();
    server = app.listen(config.port, () => console.log(`SecureLife is available at http://localhost:${config.port}`));
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    await db.stopDatabase().catch(() => {});
    process.exit(1);
  }
}

async function shutdown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.stopDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  // The database child must not remain bound to its port if Node exits unexpectedly.
  try { require('./database/h2').stopDatabase(); } catch { /* process is already exiting */ }
});
start();
