# Insurance Management System

A responsive vehicle insurance accident-notification portal using vanilla HTML/CSS/JavaScript, Express.js REST APIs, and a file-backed H2 database.

## Features

- Secure registration and login with bcrypt password hashing and JWT authentication
- Unique username, email, and NIC validation
- Vehicle-focused homepage with future services marked as coming soon
- Accident reporting with vehicle, incident, location, and contact details
- Optional multi-photo upload with browser previews (up to 6 images, 5 MB each)
- Unique notification reference numbers and a 24-hour contact confirmation
- Customer claim status tracking with a complete status timeline
- Customer editing and deletion while a notification is still Pending
- Authenticated agent dashboard for viewing notifications/photos and updating status
- Database-backed customer review showcase with three idempotently seeded demo reviews
- Contact inquiries and published customer reviews; online payments remain a future placeholder
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

4. Visit `http://localhost:3000`. The agent dashboard is available at `http://localhost:3000/agent.html`.

The default development agent is `claims.agent` with password `Agent123!`. Change `AGENT_USERNAME` and `AGENT_PASSWORD` in `.env` before the first production startup.

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
| POST / GET | `/api/accidents` | Submit or list vehicle accident notifications |
| GET | `/api/accident-photos/:id` | Retrieve an authorized accident photo |
| POST | `/api/agent/login` | Authenticate a claims agent |
| GET | `/api/agent/notifications` | List accident notifications for an agent |
| PATCH | `/api/agent/notifications/:id/status` | Update claim status and history |

All endpoints after authentication require an `Authorization: Bearer <token>` header.

Uploaded photos are stored under `uploads/accidents/` and excluded from Git. Payment, complaint submission, and non-vehicle insurance products remain under development in this release.

Customers may update accident details, vehicle details, contact information, and add photos while a notification remains `Pending`. They may also delete a Pending notification. As soon as an agent changes the status, the notification becomes read-only for the customer to preserve the claim audit record.
