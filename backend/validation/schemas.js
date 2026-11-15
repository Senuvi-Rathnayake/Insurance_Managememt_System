const { z } = require('zod');

const text = (label, min, max) => z.string().trim().min(min, `${label} is required.`).max(max, `${label} is too long.`);
const username = z.string().trim().min(3, 'Username must contain at least 3 characters.').max(50).regex(/^[A-Za-z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores, and hyphens.');
const password = z.string().min(8, 'Password must contain at least 8 characters.').max(72).regex(/[A-Z]/, 'Password needs an uppercase letter.').regex(/[a-z]/, 'Password needs a lowercase letter.').regex(/\d/, 'Password needs a number.');

const register = z.object({
  fullName: text('Full name', 2, 120),
  username,
  email: z.email('Enter a valid email address.').max(160).transform((value) => value.toLowerCase()),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number.'),
  nicNumber: z.string().trim().min(5, 'Enter a valid NIC number.').max(30),
  address: text('Address', 5, 500),
  password,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });

const login = z.object({ username: text('Username', 1, 160), password: z.string().min(1, 'Password is required.').max(72) });
const inquiry = z.object({ subject: text('Subject', 3, 160), message: text('Message', 10, 2000) });
const claim = z.object({
  policyNumber: text('Policy number', 3, 50),
  claimType: z.enum(['Motor', 'Health', 'Life', 'Home', 'Travel', 'Other']),
  incidentDate: z.iso.date('Select a valid incident date.'),
  incidentLocation: text('Incident location', 3, 240),
  estimatedAmount: z.coerce.number().min(0, 'Amount cannot be negative.').max(100000000),
  description: text('Description', 20, 2500)
}).refine((data) => new Date(data.incidentDate) <= new Date(), { path: ['incidentDate'], message: 'Incident date cannot be in the future.' });
const payment = z.object({
  policyNumber: text('Policy number', 3, 50),
  amount: z.coerce.number().positive('Amount must be greater than zero.').max(100000000),
  paymentMethod: z.enum(['Visa', 'Mastercard', 'Bank Transfer'])
});
const feedback = z.object({
  feedbackType: z.enum(['Review', 'Complaint']),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  title: text('Title', 3, 160),
  message: text('Message', 10, 2000)
}).refine((data) => data.feedbackType !== 'Review' || data.rating, { path: ['rating'], message: 'Please rate your experience.' });

module.exports = { register, login, inquiry, claim, payment, feedback };
