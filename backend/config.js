const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret-change-before-production';

if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production.');
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  h2Port: Number(process.env.H2_PORT || 5435),
  h2User: process.env.H2_USER || 'sa',
  h2Password: process.env.H2_PASSWORD || 'securelife-local-db',
  agentUsername: process.env.AGENT_USERNAME || 'claims.agent',
  agentPassword: process.env.AGENT_PASSWORD || 'Agent123!',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  isProduction,
  rootDir: path.join(__dirname, '..')
};
