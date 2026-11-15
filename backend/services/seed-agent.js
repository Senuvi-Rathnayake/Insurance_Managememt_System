const bcrypt = require('bcryptjs');
const db = require('../database/h2');
const config = require('../config');
const crypto = require('node:crypto');

async function seedDevelopmentAgent() {
  const existing = await db.query('SELECT id FROM agents WHERE LOWER(username)=LOWER($1)', [config.agentUsername]);
  if (existing.rows.length) return;
  const hash = await bcrypt.hash(config.agentPassword, 12);
  await db.query('INSERT INTO agents (full_name, username, email, phone, password_hash) VALUES ($1,$2,$3,$4,$5)', [
    'Claims Support Agent', config.agentUsername, 'claims.agent@securelife.lk', '+94 11 777 2020', hash
  ]);
}

const mockReviews = [
  { fullName:'Nadeesha Perera', username:'demo.review.nadeesha', email:'nadeesha.demo@securelife.lk', phone:'+94 77 000 1001', nic:'DEMO-REV-001', rating:5, title:'Quick and reassuring support', message:'The accident notification process was simple, and the claims agent explained every next step clearly.' },
  { fullName:'Kavindu Silva', username:'demo.review.kavindu', email:'kavindu.demo@securelife.lk', phone:'+94 77 000 1002', nic:'DEMO-REV-002', rating:4, title:'Easy claim tracking', message:'I appreciated being able to follow the status of my vehicle claim online without making repeated phone calls.' },
  { fullName:'Amaya Fernando', username:'demo.review.amaya', email:'amaya.demo@securelife.lk', phone:'+94 77 000 1003', nic:'DEMO-REV-003', rating:5, title:'Helpful when it mattered', message:'The team contacted me quickly after my accident and guided me through the documents I needed to provide.' }
];

async function seedMockReviews() {
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  for (const review of mockReviews) {
    let user = await db.query('SELECT id FROM users WHERE username=$1', [review.username]);
    if (!user.rows[0]) {
      await db.query(`INSERT INTO users (full_name, username, email, phone, nic_number, address, password_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [review.fullName, review.username, review.email, review.phone, review.nic, 'Demo customer record', passwordHash]);
      user = await db.query('SELECT id FROM users WHERE username=$1', [review.username]);
    }
    const existing = await db.query("SELECT id FROM feedback WHERE user_id=$1 AND feedback_type='Review' AND title=$2", [user.rows[0].id, review.title]);
    if (!existing.rows[0]) {
      await db.query("INSERT INTO feedback (user_id, feedback_type, rating, title, message, status) VALUES ($1,'Review',$2,$3,$4,'Published')", [user.rows[0].id, review.rating, review.title, review.message]);
    }
  }
}

module.exports = { seedDevelopmentAgent, seedMockReviews };
