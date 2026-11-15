const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../database/h2');
const config = require('../config');
const schemas = require('../validation/schemas');
const { requireAuth, requireCustomer } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(config.rootDir, 'uploads', 'accidents');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDir),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { files: 6, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

function removeUploadedFiles(files = []) {
  files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
}

function referenceNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `VI-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function detailsFor(notificationId) {
  const base = await db.query(`SELECT n.id, n.reference_number, n.contact_number, n.incident_type, n.incident_at,
    n.accident_location, n.description, n.status, n.submitted_at, n.updated_at,
    v.registration_number, v.vehicle_type, u.full_name, u.email, u.phone
    FROM accident_notifications n
    JOIN vehicles v ON v.id=n.vehicle_id JOIN users u ON u.id=n.user_id WHERE n.id=$1`, [notificationId]);
  if (!base.rows[0]) return null;
  const history = await db.query(`SELECT h.status, h.note, h.changed_at, a.full_name AS agent_name
    FROM claim_status_history h LEFT JOIN agents a ON a.id=h.changed_by_agent_id
    WHERE h.notification_id=$1 ORDER BY h.changed_at`, [notificationId]);
  const photos = await db.query('SELECT id, original_name, mime_type, file_size FROM accident_photos WHERE notification_id=$1 ORDER BY uploaded_at', [notificationId]);
  return { ...base.rows[0], history: history.rows, photos: photos.rows };
}

router.post('/accidents', requireCustomer, upload.array('photos', 6), async (req, res, next) => {
  const parsed = schemas.accident.safeParse(req.body);
  if (!parsed.success) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid accident details.' });
  }
  try {
    const d = parsed.data;
    let vehicle = await db.query('SELECT id FROM vehicles WHERE user_id=$1 AND UPPER(registration_number)=UPPER($2)', [req.user.id, d.vehicleRegistrationNumber]);
    if (!vehicle.rows[0]) {
      await db.query('INSERT INTO vehicles (user_id, registration_number, vehicle_type) VALUES ($1,$2,$3)', [req.user.id, d.vehicleRegistrationNumber, d.vehicleType]);
      vehicle = await db.query('SELECT id FROM vehicles WHERE user_id=$1 AND UPPER(registration_number)=UPPER($2)', [req.user.id, d.vehicleRegistrationNumber]);
    } else {
      await db.query('UPDATE vehicles SET vehicle_type=$1 WHERE id=$2', [d.vehicleType, vehicle.rows[0].id]);
    }

    const reference = referenceNumber();
    await db.query(`INSERT INTO accident_notifications
      (reference_number, user_id, vehicle_id, contact_number, incident_type, incident_at, accident_location, description)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [reference, req.user.id, vehicle.rows[0].id, d.contactNumber, d.incidentType, d.incidentAt, d.accidentLocation, d.description]);
    const notification = await db.query('SELECT id FROM accident_notifications WHERE reference_number=$1', [reference]);
    const id = notification.rows[0].id;
    await db.query("INSERT INTO claim_status_history (notification_id, status, note) VALUES ($1,'Pending',$2)", [id, 'Accident notification received. An agent will make contact within 24 hours.']);
    for (const file of req.files || []) {
      await db.query('INSERT INTO accident_photos (notification_id, stored_name, original_name, mime_type, file_size) VALUES ($1,$2,$3,$4,$5)', [id, file.filename, file.originalname, file.mimetype, file.size]);
    }
    return res.status(201).json({
      message: 'Your accident notification has been successfully submitted. One of our insurance agents will contact you within 24 hours to discuss your incident and guide you through the next steps.',
      notification: await detailsFor(id)
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    return next(error);
  }
});

router.put('/accidents/:id', requireCustomer, upload.array('photos', 6), async (req, res, next) => {
  const parsed = schemas.accident.safeParse(req.body);
  if (!parsed.success) {
    removeUploadedFiles(req.files);
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid accident details.' });
  }
  try {
    const existing = await db.query('SELECT id, status FROM accident_notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!existing.rows[0]) { removeUploadedFiles(req.files); return res.status(404).json({ message: 'Accident notification not found.' }); }
    if (existing.rows[0].status !== 'Pending') { removeUploadedFiles(req.files); return res.status(409).json({ message: 'This notification can no longer be edited because an agent has started processing it.' }); }
    const photoCount = await db.query('SELECT COUNT(*) AS total FROM accident_photos WHERE notification_id=$1', [req.params.id]);
    if (Number(photoCount.rows[0].total) + (req.files?.length || 0) > 6) {
      removeUploadedFiles(req.files);
      return res.status(400).json({ message: 'A notification may contain no more than 6 photos.' });
    }
    const d = parsed.data;
    let vehicle = await db.query('SELECT id FROM vehicles WHERE user_id=$1 AND UPPER(registration_number)=UPPER($2)', [req.user.id, d.vehicleRegistrationNumber]);
    if (!vehicle.rows[0]) {
      await db.query('INSERT INTO vehicles (user_id, registration_number, vehicle_type) VALUES ($1,$2,$3)', [req.user.id, d.vehicleRegistrationNumber, d.vehicleType]);
      vehicle = await db.query('SELECT id FROM vehicles WHERE user_id=$1 AND UPPER(registration_number)=UPPER($2)', [req.user.id, d.vehicleRegistrationNumber]);
    } else {
      await db.query('UPDATE vehicles SET vehicle_type=$1 WHERE id=$2', [d.vehicleType, vehicle.rows[0].id]);
    }
    await db.query(`UPDATE accident_notifications SET vehicle_id=$1, contact_number=$2, incident_type=$3,
      incident_at=$4, accident_location=$5, description=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7`,
      [vehicle.rows[0].id, d.contactNumber, d.incidentType, d.incidentAt, d.accidentLocation, d.description, req.params.id]);
    for (const file of req.files || []) {
      await db.query('INSERT INTO accident_photos (notification_id, stored_name, original_name, mime_type, file_size) VALUES ($1,$2,$3,$4,$5)', [req.params.id, file.filename, file.originalname, file.mimetype, file.size]);
    }
    await db.query("INSERT INTO claim_status_history (notification_id, status, note) VALUES ($1,'Pending',$2)", [req.params.id, 'The customer updated the accident notification.']);
    return res.json({ message: 'Accident notification updated successfully.', notification: await detailsFor(req.params.id) });
  } catch (error) {
    removeUploadedFiles(req.files);
    return next(error);
  }
});

router.delete('/accidents/:id', requireCustomer, async (req, res, next) => {
  try {
    const existing = await db.query('SELECT id, status, vehicle_id FROM accident_notifications WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Accident notification not found.' });
    if (existing.rows[0].status !== 'Pending') return res.status(409).json({ message: 'This notification can no longer be deleted because an agent has started processing it.' });
    const photos = await db.query('SELECT stored_name FROM accident_photos WHERE notification_id=$1', [req.params.id]);
    await db.query('DELETE FROM accident_notifications WHERE id=$1', [req.params.id]);
    const remainingVehicleUse = await db.query('SELECT COUNT(*) AS total FROM accident_notifications WHERE vehicle_id=$1', [existing.rows[0].vehicle_id]);
    if (Number(remainingVehicleUse.rows[0].total) === 0) await db.query('DELETE FROM vehicles WHERE id=$1', [existing.rows[0].vehicle_id]);
    photos.rows.forEach((photo) => fs.rm(path.join(uploadDir, photo.stored_name), { force: true }, () => {}));
    return res.json({ message: 'Accident notification deleted successfully.' });
  } catch (error) { return next(error); }
});

router.get('/accidents', requireCustomer, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id FROM accident_notifications WHERE user_id=$1 ORDER BY submitted_at DESC', [req.user.id]);
    return res.json(await Promise.all(result.rows.map((row) => detailsFor(row.id))));
  } catch (error) { return next(error); }
});

router.get('/accident-photos/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await db.query(`SELECT p.stored_name, p.original_name, p.mime_type, n.user_id
      FROM accident_photos p JOIN accident_notifications n ON n.id=p.notification_id WHERE p.id=$1`, [req.params.id]);
    const photo = result.rows[0];
    if (!photo) return res.status(404).json({ message: 'Photo not found.' });
    if (req.user.role !== 'agent' && String(photo.user_id) !== String(req.user.id)) return res.status(403).json({ message: 'Access denied.' });
    res.type(photo.mime_type);
    return res.sendFile(path.join(uploadDir, photo.stored_name));
  } catch (error) { return next(error); }
});

module.exports = router;
