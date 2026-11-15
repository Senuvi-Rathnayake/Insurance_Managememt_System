const express = require('express');
const crypto = require('node:crypto');
const db = require('../database/h2');
const schemas = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { requireCustomer } = require('../middleware/auth');

const router = express.Router();
router.use(requireCustomer);

router.post('/inquiries', validate(schemas.inquiry), async (req, res, next) => {
  try {
    const { subject, message } = req.validated;
    await db.query('INSERT INTO inquiries (user_id, subject, message) VALUES ($1,$2,$3)', [req.user.id, subject, message]);
    return res.status(201).json({ message: 'Your inquiry has been received.', inquiry: { status: 'Received' } });
  } catch (error) { return next(error); }
});

router.post('/claims', validate(schemas.claim), async (req, res, next) => {
  try {
    const d = req.validated;
    await db.query('INSERT INTO claims (user_id, policy_number, claim_type, incident_date, incident_location, estimated_amount, description) VALUES ($1,$2,$3,$4,$5,$6,$7)', [req.user.id, d.policyNumber, d.claimType, d.incidentDate, d.incidentLocation, d.estimatedAmount, d.description]);
    return res.status(201).json({ message: 'Claim submitted successfully.', claim: { status: 'Submitted' } });
  } catch (error) { return next(error); }
});

router.get('/claims', async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, policy_number, claim_type, incident_date, incident_location, estimated_amount, description, status, created_at, updated_at FROM claims WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    return res.json(result.rows);
  } catch (error) { return next(error); }
});

router.post('/payments', validate(schemas.payment), async (req, res, next) => {
  try {
    const d = req.validated;
    const prefixTwo = Number(d.cardNumber.slice(0, 2));
    const prefixFour = Number(d.cardNumber.slice(0, 4));
    const paymentMethod = d.cardNumber.startsWith('4') ? 'Visa' : ((prefixTwo >= 51 && prefixTwo <= 55) || (prefixFour >= 2221 && prefixFour <= 2720) ? 'Mastercard' : 'Card');
    const lastFour = d.cardNumber.slice(-4);
    const reference = `SL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    await db.query(`INSERT INTO payments
      (user_id, policy_number, payment_type, amount, payment_method, cardholder_name, card_last_four, reference_number)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [req.user.id, d.policyNumber, d.paymentType, d.amount, paymentMethod, d.cardholderName, lastFour, reference]);
    const payment = await db.query(`SELECT id, policy_number, payment_type, amount, payment_method,
      cardholder_name, card_last_four, reference_number, status, paid_at FROM payments WHERE reference_number=$1`, [reference]);
    return res.status(201).json({ message: 'Payment completed successfully.', payment: payment.rows[0] });
  } catch (error) { return next(error); }
});

router.get('/payments', async (req, res, next) => {
  try {
    const result = await db.query(`SELECT id, policy_number, payment_type, amount, payment_method,
      cardholder_name, card_last_four, reference_number, status, paid_at
      FROM payments WHERE user_id=$1 ORDER BY paid_at DESC`, [req.user.id]);
    return res.json(result.rows);
  } catch (error) { return next(error); }
});

router.post('/feedback', validate(schemas.feedback), async (req, res, next) => {
  try {
    const d = req.validated;
    const status = d.feedbackType === 'Complaint' ? 'Received' : 'Published';
    await db.query('INSERT INTO feedback (user_id, feedback_type, rating, title, message, status) VALUES ($1,$2,$3,$4,$5,$6)', [req.user.id, d.feedbackType, d.rating || null, d.title, d.message, status]);
    return res.status(201).json({ message: `${d.feedbackType} submitted successfully.`, feedback: { status } });
  } catch (error) { return next(error); }
});

router.get('/feedback', async (req, res, next) => {
  try {
    const result = await db.query("SELECT f.id, f.feedback_type, f.rating, f.title, f.message, f.status, f.created_at, u.full_name FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.feedback_type='Review' OR f.user_id=$1 ORDER BY f.created_at DESC LIMIT 100", [req.user.id]);
    return res.json(result.rows);
  } catch (error) { return next(error); }
});

module.exports = router;
