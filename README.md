# SecureLife Insurance Portal

A responsive full-stack insurance customer portal using vanilla HTML/CSS/JavaScript, Express.js REST APIs, and a file-backed H2 database.

## Features

- Secure registration and login with bcrypt password hashing and JWT authentication
- Unique username, email, and NIC validation
- Protected customer portal and responsive navigation
- Claim notification and claim tracking
- Policy payment recording and payment history
- Contact inquiries
- Reviews, ratings, and complaints
- Server-side validation, rate limiting, secure headers, and consistent error responses

## Requirements

- Node.js 20 or later
- Java 17 or later (required by H2)

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random value.

3. Start the app:

   ```sh
   npm start
   ```

4. Visit `http://localhost:3000`.

The install step downloads the official H2 JAR from Maven Central. H2 data files are created in `data/` and ignored by Git.

## Project structure

```text
backend/
  database/       H2 lifecycle and SQL schema
  middleware/     authentication and validation
  routes/         REST API routes
  validation/     shared request schemas
frontend/
  css/            responsive design system
  js/             authentication and portal behavior
  *.html          login, registration, and customer portal
scripts/          H2 installation helper
```

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Authenticate and receive a JWT |
| GET | `/api/auth/me` | View the authenticated profile |
| POST | `/api/inquiries` | Submit an inquiry |
| POST / GET | `/api/claims` | Submit or list claims |
| POST / GET | `/api/payments` | Record or list payments |
| POST / GET | `/api/feedback` | Submit or list feedback |

All endpoints after authentication require an `Authorization: Bearer <token>` header.

> The payment page is an initial/demo interface. It deliberately does not collect card credentials or process real financial transactions. Connect a PCI-compliant payment provider before production use.
