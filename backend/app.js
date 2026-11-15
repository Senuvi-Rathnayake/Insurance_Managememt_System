const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const portalRoutes = require('./routes/portal');
const config = require('./config');

const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { "img-src": ["'self'", 'data:', 'https://images.unsplash.com'] } } }));
app.use(cors({ origin: config.isProduction ? false : true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes);
app.use('/api', portalRoutes);

const frontend = path.join(config.rootDir, 'frontend');
app.use(express.static(frontend, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(frontend, 'login.html')));

app.use('/api', (req, res) => res.status(404).json({ message: 'API endpoint not found.' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === '23505') return res.status(409).json({ message: 'This information already exists.' });
  return res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

module.exports = app;
