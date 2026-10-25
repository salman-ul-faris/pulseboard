# PulseBoard — Precision Productivity & Task Intelligence Platform

PulseBoard is a full-stack task management and productivity application engineered with a deep-navy aesthetic, electric-mint accents, real PostgreSQL persistence, and secure session-based authentication.

---

## 1. System Architecture

PulseBoard uses a unified monorepo architecture designed for local development and single-service deployment to **Render** (or Vercel):

```
pulseboard/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── components/         # Logo, BackgroundWave, Header, Sidebar, TaskCard, TaskModal, SummaryCards
│   │   ├── context/            # AuthContext (session, user, settings)
│   │   ├── pages/              # LoginPage, RegisterPage, DashboardPage, SettingsPage
│   │   ├── services/           # API fetch client with credentials support
│   │   ├── App.jsx             # Shell & view orchestrator
│   │   ├── index.css           # Design tokens, variables, & reduced-motion support
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── db/                 # DB connection pool (PostgreSQL + embedded PGlite fallback), migrations
│   │   ├── middleware/         # Auth guard, Zod validation, error handler
│   │   ├── routes/             # Auth, Tasks, Settings, Health
│   │   ├── app.js              # Express app, Helmet, CORS, Sessions, Rate limits
│   │   └── index.js            # Server entry point, DB migration bootstrapper
│   ├── migrations/             # SQL migration files
│   ├── tests/                  # Automated test suite (12 critical acceptance tests)
│   └── package.json
├── render.yaml                 # Render Blueprint deployment config
├── .env.example
├── .gitignore
├── package.json                # Root orchestrator scripts
└── README.md
```

---

## 2. Brand Identity & UI Direction

- **Palette**:
  - Primary Background: `#070B12` (Deep Space Navy)
  - Secondary / Sidebar Background: `#0B1220`
  - Card & Modal Background: `#101A2B`
  - Primary Accent: `#38F2A5` (Electric Mint)
  - Secondary Accent: `#54C8E8` (Cyan)
  - Coral / Warning: `#FF5C5C`
  - Text: `#F3F7FC` (Primary), `#9BA9BB` (Secondary), `#5E6D82` (Muted)
- **Original Logo**: Geometric 2x2 board/grid motif intersected by a dynamic mint-cyan pulse wave line, with refined typography.
- **Wave Background**: Lightweight SVG path animation with subtle glow; fully disables when `prefers-reduced-motion` is active or when user toggles Reduced Motion in Settings.

---

## 3. Database Schema

The database runs on PostgreSQL (and embedded PGlite for zero-config local runs):

### `users`
- `id` (UUID, Primary Key)
- `name` (VARCHAR 255)
- `email` (VARCHAR 255, Unique, Indexed)
- `password_hash` (VARCHAR 255, bcrypt 12 salt rounds)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### `tasks`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key to `users.id` ON DELETE CASCADE, Indexed)
- `title` (VARCHAR 255, Required)
- `description` (TEXT)
- `completed` (BOOLEAN, Default `false`, Indexed)
- `priority` (VARCHAR 20, Check: `low`, `medium`, `high`)
- `due_date` (TIMESTAMPTZ, Nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### `user_settings`
- `user_id` (UUID, Primary Key & Foreign Key to `users.id`)
- `theme` (VARCHAR 50, Default `'dark'`)
- `reduced_motion` (BOOLEAN, Default `false`)
- `task_reminders_enabled` (BOOLEAN, Default `true`)
- `completion_notifications_enabled` (BOOLEAN, Default `true`)
- `updated_at` (TIMESTAMPTZ)

---

## 4. API Endpoints

### Authentication
- `POST /api/auth/register` — Validates credentials, hashes password with bcrypt, initializes settings, returns user object & creates session.
- `POST /api/auth/login` — Authenticates credentials, regenerates session ID to prevent fixation, sets `pulseboard.sid` cookie.
- `POST /api/auth/logout` — Destroys session, clears cookie.
- `GET /api/auth/me` — Returns safe authenticated user object or 401.

### Tasks
- `GET /api/tasks` — List tasks for current user. Supports query parameters `filter=active|completed`, `search=<string>`, `priority=low|medium|high`.
- `POST /api/tasks` — Create task for current user.
- `GET /api/tasks/:id` — Get task (strictly scoped to owner).
- `PATCH /api/tasks/:id` — Update allowed fields (`title`, `description`, `completed`, `priority`, `dueDate`).
- `DELETE /api/tasks/:id` — Delete task (strictly scoped to owner).

### Settings
- `GET /api/settings` — Returns user profile and preference settings.
- `PATCH /api/settings` — Persists updates to user profile name and preferences (e.g. `reducedMotion`).

### System Health
- `GET /api/health` — Returns JSON with service uptime and database connection status without leaking credentials or stack traces.

---

## 5. Local Setup & Running

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone <repo-url> pulseboard
cd pulseboard

# Install all dependencies (root, server, client)
npm run postinstall
```

### Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default variables:
```ini
NODE_ENV=development
PORT=5000
DATABASE_URL=
SESSION_SECRET=pulseboard_secret_encryption_key_change_in_production
CLIENT_ORIGIN=http://localhost:5173
```
*Note: If `DATABASE_URL` is omitted, PulseBoard automatically boots an embedded PostgreSQL engine (PGlite) storing data in `./data/pglite/`.*

### Running in Development
```bash
# Starts both Express API (:5000) and Vite (:5173) with proxying
npm run dev
```

### Running in Production Locally
```bash
npm run build
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 6. Automated Testing

Run the automated test suite verifying all 12 critical acceptance criteria:
```bash
npm test
```

### Verified Test Cases:
1. `Registration creates a user with a password hash and safe user object`
2. `Duplicate email registration is rejected`
3. `Valid login succeeds and sets session cookie`
4. `Invalid login fails with generic error`
5. `Logout invalidates the session`
6. `Unauthenticated task requests are rejected with 401`
7. `Authenticated users can create, retrieve, update, and delete their own tasks`
8. `One user cannot read or modify another user's tasks`
9. `Invalid task inputs are rejected with 400`
10. `Settings persist correctly`
11. `Dashboard metrics match actual task records`
12. `Database errors and health endpoint do not expose secrets or stack traces`

---

## 7. Render Deployment

PulseBoard includes a ready-to-deploy `render.yaml` blueprint.

### Deployment Steps:
1. Push this repository to GitHub or GitLab.
2. Log into [Render](https://render.com) and click **New + > Blueprint**.
3. Select your repository.
4. Render will automatically provision:
   - **PostgreSQL Database** (`pulseboard-db`)
   - **Node.js Web Service** (`pulseboard`)
5. The build command will execute `npm install && npm run build` and start with `npm start`.
6. Health checks will automatically monitor `/api/health`.
