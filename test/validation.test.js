const test = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../backend/validation/schemas');

test('registration accepts a complete strong account', () => {
  const result = schemas.register.safeParse({ fullName:'Sam Perera', username:'sam.perera', email:'SAM@example.com', phone:'+94 77 123 4567', nicNumber:'200012345678', address:'12 Main Street, Colombo', password:'Secure123', confirmPassword:'Secure123' });
  assert.equal(result.success, true);
  assert.equal(result.data.email, 'sam@example.com');
});

test('registration rejects mismatched passwords', () => {
  const result = schemas.register.safeParse({ fullName:'Sam Perera', username:'sam.perera', email:'sam@example.com', phone:'+94 77 123 4567', nicNumber:'200012345678', address:'12 Main Street, Colombo', password:'Secure123', confirmPassword:'Different123' });
  assert.equal(result.success, false);
});

test('claim validation rejects a future incident date', () => {
  const result = schemas.claim.safeParse({ policyNumber:'POL-100', claimType:'Motor', incidentDate:'2999-01-01', incidentLocation:'Colombo', estimatedAmount:1000, description:'A sufficiently detailed incident description.' });
  assert.equal(result.success, false);
});
