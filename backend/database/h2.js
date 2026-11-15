const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const config = require('../config');

let h2Process;
let pool;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensurePortFree(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', () => reject(new Error(`H2 port ${port} is already in use. Stop the existing process or choose another H2_PORT.`)));
    tester.once('listening', () => tester.close(resolve));
    tester.listen(port, '127.0.0.1');
  });
}

async function connectWithRetry() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }
  throw new Error(`H2 did not become ready: ${lastError?.message}`);
}

async function startDatabase() {
  const jar = path.join(config.rootDir, 'vendor', 'h2.jar');
  const dataDir = path.join(config.rootDir, 'data');
  if (!fs.existsSync(jar)) throw new Error('H2 driver is missing. Run npm install first.');
  fs.mkdirSync(dataDir, { recursive: true });
  await ensurePortFree(config.h2Port);

  h2Process = spawn('java', [
    '-cp', jar,
    'org.h2.tools.Server',
    '-pg',
    '-pgPort', String(config.h2Port),
    '-baseDir', dataDir,
    '-ifNotExists'
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

  h2Process.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (message) console.error(`[H2] ${message}`);
  });

  pool = new Pool({
    host: '127.0.0.1',
    port: config.h2Port,
    database: 'insurance',
    user: config.h2User,
    password: config.h2Password,
    max: 10
  });
  pool.on('error', (error) => console.error(`Idle H2 connection error: ${error.message}`));

  await connectWithRetry();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

async function stopDatabase() {
  if (h2Process && !h2Process.killed) h2Process.kill();
  if (pool) await pool.end();
}

function query(text, params) {
  if (!pool) throw new Error('Database is not initialized.');
  return pool.query(text, params);
}

module.exports = { startDatabase, stopDatabase, query };
