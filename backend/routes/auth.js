const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/h2');
const config = require('../config');
const schemas = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const data = req.validated;
    const existing = await db.query('SELECT username, email, nic_number FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2) OR LOWER(nic_number)=LOWER($3)', [data.username, data.email, data.nicNumber]);
    if (existing.rows.length) {
      const row = existing.rows[0];
      const field = row.username?.toLowerCase() === data.username.toLowerCase() ? 'username' : row.email?.toLowerCase() === data.email ? 'email' : 'NIC number';
      return res.status(409).json({ message: `That ${field} is already registered.` });
    }
    const hash = await bcrypt.hash(data.password, 12);
    await db.query('INSERT INTO users (full_name, username, email, phone, nic_number, address, password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)', [data.fullName, data.username, data.email, data.phone, data.nicNumber, data.address, hash]);
    return res.status(201).json({ message: 'Account created successfully. You can now log in.' });
  } catch (error) { return next(error); }
});

router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.validated;
    const result = await db.query('SELECT id, full_name, username, email, password_hash FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($1)', [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid username or password.' });
    const token = jwt.sign({ id: user.id, username: user.username, name: user.full_name }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    return res.json({ token, user: { id: user.id, fullName: user.full_name, username: user.username, email: user.email } });
  } catch (error) { return next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, full_name, username, email, phone, nic_number, address FROM users WHERE id=$1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'User not found.' });
    return res.json(result.rows[0]);
  } catch (error) { return next(error); }
});

module.exports = router;
