# CRM Backend

Express + MongoDB backend for a simple CRM system: users, customers, leads, deals, conversations/messages, follow-ups, notes, notifications, activities, dashboard metrics, and cross-entity search.

## Tech Stack

- **Runtime:** Node.js, Express 5
- **Database:** MongoDB + Mongoose 9
- **Auth:** JWT (`jsonwebtoken`), password hashing with `bcryptjs`
- **Uploads/Images:** `multer`, `sharp` (served from `/images`)
- **Mail:** `nodemailer`
- **Config:** `dotenv`, `cors`

## Features

- JWT authentication: register, login, logout
- Role-based access control: `ADMIN`, `MANAGER`, `SALES_AGENT`
- User administration (create, list, deactivate, role assignment)
- Customer CRUD + search by name / phone / email
- Lead pipeline with enforced status transitions (`NEW → CONTACTED → INTERESTED → NEGOTIATION → WON / LOST`)
- Deal pipeline (`NEGOTIATION → WON / LOST`) with value/currency tracking
- Conversations with nested messages, assignment, and status workflow
- Follow-ups with due dates, overdue detection, complete/cancel/reopen
- Notes attached to exactly one Customer or Lead
- Notifications per user (read / read-all / delete)
- Activity log per entity and per actor
- Dashboard metrics: overview, leads by status/source, deals by stage, sales performance, revenue by period
- Global `/search` endpoint across CRM entities

See detailed references:

- `ROUTES.md` — full API route list
- `MODELS.md` — Mongoose schema documentation

## Project Structure

```text
src/
  server.js          # entry point: loads .env, connects DB, listens on PORT
  app.js             # Express app, mounts All_Routes at /, static /images, error handler
  config/database.js # Mongoose connection (uses process.env.url)
  routes/            # auth, users, customers, leads, deals, dashboard,
                     # activities, conversations, followups, notes, search,
                     # notifications (+ unmounted message.routes.js)
  controllers/
  models/            # User, Customer, Lead, Deal, Conversation, Message,
                     # FollowUp, Note, Notification, Activity
  middleware/        # auth.middleware, role.middleware
  services/          # activity, dashboard, notification
  utils/             # AppError, Async_Wrapper, HttpStatusText, Email
  constants/
images/              # uploaded/served files (gitignored)
```

## Prerequisites

- Node.js 18+ (or current LTS)
- npm
- Running MongoDB instance (local or Atlas)

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   PORT=3000
   url=mongodb://127.0.0.1:27017/crm
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=7d
   ```

   > `src/config/database.js` connects with `mongoose.connect(process.env.url)`, and `src/server.js` listens on `process.env.PORT`.

3. Run the server:

   ```bash
   npm start
   ```

   This runs `nodemon src/server.js`. The API is served from `/` (e.g. `http://localhost:3000/auth/login`).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Port the server listens on |
| `url` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWTs |
| `JWT_EXPIRES_IN` | Yes | JWT lifetime (e.g. `7d`) |

Check `src/utils/Email.js` if you enable email sending — add SMTP credentials as needed.

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `start` | `nodemon src/server.js` | Start dev server with auto-reload |

## API Overview

Base URL: `/` (`src/routes/All_Routes.js` mounted at `/` in `src/app.js`).

Protected routes require:

```http
Authorization: Bearer <JWT>
```

Main prefixes:

| Prefix | Purpose |
| --- | --- |
| `/auth` | Register, login, logout (public) |
| `/users` | User admin (`ADMIN`, partly `MANAGER`) |
| `/customers` | Customer CRUD + search |
| `/leads` | Lead CRUD + assign + status change |
| `/deals` | Deal CRUD + assign + stage won/lost |
| `/dashboard` | Metrics (some restricted to `ADMIN`, `MANAGER`) |
| `/activities` | Activity history |
| `/conversations` | Conversations + nested `/conversations/:id/messages` |
| `/followups` | Follow-up CRUD + complete/cancel |
| `/notes` | Notes CRUD |
| `/search` | Cross-entity search |
| `/notifications` | List / mark read / delete |

Full method tables are in `ROUTES.md`.

Note: `src/routes/message.routes.js` is currently not mounted, so its standalone endpoints are inactive — use the nested conversation message endpoints instead.

## Roles

- `ADMIN` — full access, user management
- `MANAGER` — manage leads/deals/conversations assignment, view reports
- `SALES_AGENT` — scoped to assigned customers/leads/deals/conversations

## Error Handling

Central error middleware in `src/app.js` returns:

```json
{
  "status": "error",
  "message": "..."
}
```

Controllers use `Async_Wrapper` + `AppError` for consistent error propagation.
