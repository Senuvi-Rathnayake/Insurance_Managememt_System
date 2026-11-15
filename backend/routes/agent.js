const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/h2');
const config = require('../config');
const schemas = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { requireAgent } = require('../middleware/auth');

const router = express.Router();

router.post('/login', validate(schemas.agentLogin), async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, full_name, username, password_hash FROM agents WHERE LOWER(username)=LOWER($1) AND active=TRUE', [req.validated.username]);
    const agent = result.rows[0];
    if (!agent || !(await bcrypt.compare(req.validated.password, agent.password_hash))) return res.status(401).json({ message: 'Invalid agent credentials.' });
    const token = jwt.sign({ id: agent.id, username: agent.username, name: agent.full_name, role: 'agent' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    return res.json({ token, agent: { id: agent.id, fullName: agent.full_name, username: agent.username } });
  } catch (error) { return next(error); }
});

router.use(requireAgent);

router.get('/notifications', async (req, res, next) => {
  try {
    const result = await db.query(`SELECT n.id, n.reference_number, n.contact_number, n.incident_type, n.incident_at,
      n.accident_location, n.description, n.status, n.submitted_at, n.updated_at,
      v.registration_number, v.vehicle_type, u.full_name, u.email, u.phone,
      assigned.full_name AS assigned_agent_name
      FROM accident_notifications n
      JOIN vehicles v ON v.id=n.vehicle_id
      JOIN users u ON u.id=n.user_id
      LEFT JOIN agents assigned ON assigned.id=n.assigned_agent_id
      ORDER BY CASE WHEN n.status='Pending' THEN 0 ELSE 1 END, n.submitted_at DESC`);
    for (const item of result.rows) {
      const photos = await db.query('SELECT id, original_name, mime_type, file_size FROM accident_photos WHERE notification_id=$1', [item.id]);
      const history = await db.query(`SELECT h.status, h.note, h.changed_at, a.full_name AS agent_name
        FROM claim_status_history h LEFT JOIN agents a ON a.id=h.changed_by_agent_id
        WHERE h.notification_id=$1 ORDER BY h.changed_at`, [item.id]);
      item.photos = photos.rows;
      item.history = history.rows;
    }
    return res.json(result.rows);
  } catch (error) { return next(error); }
});

router.patch('/notifications/:id/status', validate(schemas.statusUpdate), async (req, res, next) => {
  try {
    if (req.validated.status === 'Rejected' && !req.validated.note?.trim()) {
      return res.status(400).json({ message: 'Please add a reason before rejecting a claim.' });
    }
    const existing = await db.query('SELECT id FROM accident_notifications WHERE id=$1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Notification not found.' });
    await db.query('UPDATE accident_notifications SET status=$1, assigned_agent_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3', [req.validated.status, req.user.id, req.params.id]);
    await db.query('INSERT INTO claim_status_history (notification_id, status, note, changed_by_agent_id) VALUES ($1,$2,$3,$4)', [req.params.id, req.validated.status, req.validated.note || null, req.user.id]);
    return res.json({ message: 'Claim status updated successfully.' });
  } catch (error) { return next(error); }
});

module.exports = router;
