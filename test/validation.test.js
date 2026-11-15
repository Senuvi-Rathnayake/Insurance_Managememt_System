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

test('vehicle accident validation accepts complete incident details', () => {
  const result = schemas.accident.safeParse({ contactNumber:'+94 77 123 4567', vehicleRegistrationNumber:'cab-1234', vehicleType:'Car', incidentType:'Collision', incidentAt:'2026-10-10T14:30', accidentLocation:'Galle Road, Colombo', description:'The insured vehicle was involved in a rear-end collision.' });
  assert.equal(result.success, true);
  assert.equal(result.data.vehicleRegistrationNumber, 'CAB-1234');
});

test('vehicle accident validation rejects future incidents', () => {
  const result = schemas.accident.safeParse({ contactNumber:'+94 77 123 4567', vehicleRegistrationNumber:'CAB-1234', vehicleType:'Car', incidentType:'Collision', incidentAt:'2999-10-10T14:30', accidentLocation:'Colombo', description:'The insured vehicle was involved in a collision.' });
  assert.equal(result.success, false);
});

test('payment validation accepts a supported card and normalizes the policy number', () => {
  const result = schemas.payment.safeParse({
    policyNumber:'pol-vehicle-1001', paymentType:'Policy Premium', amount:'12500.00',
    cardholderName:'Sam Perera', cardNumber:'4111 1111 1111 1111',
    expiryMonth:'12', expiryYear:String(new Date().getFullYear() + 1), cvv:'123'
  });
  assert.equal(result.success, true);
  assert.equal(result.data.policyNumber, 'POL-VEHICLE-1001');
  assert.equal(result.data.cardNumber, '4111111111111111');
});

test('payment validation rejects an invalid card number', () => {
  const result = schemas.payment.safeParse({
    policyNumber:'POL-1001', paymentType:'Policy Renewal', amount:5000,
    cardholderName:'Sam Perera', cardNumber:'4111 1111 1111 1112',
    expiryMonth:12, expiryYear:new Date().getFullYear() + 1, cvv:'123'
  });
  assert.equal(result.success, false);
});
