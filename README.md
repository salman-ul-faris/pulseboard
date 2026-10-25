# PulseBoard — Precision Productivity & Task Intelligence Platform

PulseBoard is an enterprise-grade, full-stack productivity web application designed with a deep-navy aesthetic, electric-mint accents, real PostgreSQL persistence, and secure session authentication.

The codebase is organized as a unified monorepo for dual deployment:
- **Frontend** deployed on **Vercel** (`client/` root)
- **Backend** deployed on **Render** (`server/` root) with managed **PostgreSQL**

---

## 1. Project Structure

```
pulseboard/
├── client/                     # Frontend (React + Vite) — Deployed to Vercel
│   ├── src/
│   │   ├── components/         # Logo, BackgroundWave, Header, Sidebar, TaskCard, TaskModal, SummaryCards
│   │   ├── context/            # AuthContext (session, user, settings)
│   │   ├── pages/              # LoginPage, RegisterPage, DashboardPage, SettingsPage
│   │   ├── services/           # API fetch client (VITE_API_URL + credentials: 'include')
│   │   ├── App.jsx             # Shell & view orchestrator
│   │   ├── index.css           # Design tokens, variables, & reduced-motion support
│   │   └── main.jsx
│   ├── index.html
│   ├── vercel.json             # Vercel SPA rewrites & security headers
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── server/                     # Backend (Node.js + Express) — Deployed to Render
│   ├── src/
│   │   ├── db/                 # DB connection pool (PostgreSQL + PGlite fallback), migrations
│   │   ├── middleware/         # Auth guard, Zod validation, error handler
│   │   ├── routes/             # Auth, Tasks, Settings, Health
│   │   ├── app.js              # Express app, Helmet, CORS, Session Store, CSRF Origin check
│   │   └── index.js            # Server entry point, DB auto-migration bootstrapper
│   ├── migrations/             # SQL schema migrations (users, tasks, user_settings, session)
│   ├── tests/                  # Automated test suite (12 critical acceptance tests)
│   ├── .env.example
│   └── package.json
├── render.yaml                 # Render Blueprint configuration
├── .gitignore
├── .env.example
├── package.json                # Root orchestrator scripts
└── README.md
```

---

## 2. Brand Identity & UI Direction

- **Curated Palette**:
  - Primary Background: `#070B12` (Deep Space Navy)
  - Secondary Background: `#0B1220` (Sidebar / Sections)
  - Card & Modal Background: `#101A2B`
  - Primary Accent: `#38F2A5` (Electric Mint)
  - Secondary Accent: `#54C8E8` (Cyan Highlights)
  - Warning / Danger: `#FF5C5C` (Coral)
  - Text: `#F3F7FC` (Primary), `#9BA9BB` (Secondary), `#5E6D82` (Muted)
- **Original Logo**: Geometric 2x2 board grid motif intersected by a mint-cyan pulse wave line, with refined typography.
- **Wave Background**: Lightweight SVG path animation with subtle glow. Fully respects `prefers-reduced-motion` and user setting toggle.

---

## 3. Database Schema

The database runs on PostgreSQL (and embedded PGlite for zero-config local runs):

### `users`
- `id` (UUID, Primary Key)
- `name` (VARCHAR 255)
- `email` (VARCHAR 255, Unique, Indexed)
- `password_hash` (VARCHAR 255, bcrypt 12 salt rounds)
- `avatar_url` (TEXT, Nullable — Persistent image URL)
- `avatar_key` (VARCHAR 255, Nullable — Storage object identifier for secure lifecycle management)
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

### `session`
- `sid` (VARCHAR, Primary Key)
- `sess` (JSON)
- `expire` (TIMESTAMP(6), Indexed)

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

### Settings & Profile Picture
- `GET /api/settings` — Returns user profile, avatar URL, and persistent settings.
- `PATCH /api/settings` — Persists updates to user profile name and preferences (e.g. `reducedMotion`).
- `POST /api/settings/profile-picture` — Securely uploads or replaces authenticated user's avatar. Enforces authentication, magic byte signature validation, raster-only allowlist (JPEG, PNG, WebP), SVG/executable rejection, 5 MB file size limit, dimension safety & decompression-bomb limits, safe re-encoding to 400x400 WebP via Sharp, rate limiting, and failure-safe database updates and atomic cleanup.
- `DELETE /api/settings/profile-picture` — Removes the authenticated user's picture, safely destroys the stored object, resets database fields to null, and restores default initials.

### System Health
- `GET /api/health` — Returns JSON with service uptime, database connection status, and storage provider mode (`cloudinary` vs local persistent fallback) without leaking credentials or stack traces.

---

## 5. Local Setup & Running

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone <your-repo-url> pulseboard
cd pulseboard

# Install dependencies for root, server, and client
npm run postinstall
```

### Running in Development
```bash
# Starts Express API (:5000) and Vite (:5173) with automatic proxying
npm run dev
```

### Running the Production Server Locally
```bash
npm run build
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 6. Automated Testing

Run the full automated test suite verifying all 23 critical acceptance criteria (Core Platform + Security & Profile Picture):
```bash
npm test
```

### Verified Test Cases (23 Passing Tests):

**Platform & Security Tests (`server/tests/api.test.js`):**
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

**Profile Picture Security Tests (`server/tests/avatar.test.js`):**
13. `Authenticated user can upload a valid PNG profile picture`
14. `Stored avatar URL persists across subsequent GET /api/settings calls`
15. `Authenticated user can replace an existing avatar with a new image`
16. `Authenticated user can remove their avatar, clearing URL and deleting storage object`
17. `Unauthenticated upload request is rejected with 401 Unauthorized`
18. `Fake image payload with valid extension is rejected by signature validation`
19. `SVG files and active content are strictly rejected`
20. `Files exceeding the 5 MB size limit are rejected with 400 Bad Request`
21. `Cross-user isolation: User B cannot delete User A's avatar`
22. `Upload and storage errors do not leak stack traces or server paths`
23. `Failure-safe replacement: DB failure leaves the previous avatar intact without orphan destruction`

---

## 7. GitHub Repository Setup

To push your local repository to GitHub:

1. Create a new empty repository on [GitHub](https://github.com/new) named `pulseboard`. Do not initialize it with a README, license, or .gitignore (these already exist locally).
2. In your terminal at the root of `pulseboard`, run:
   ```bash
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/pulseboard.git
   git push -u origin main
   ```

---

## 8. Deployment: Render (Backend + PostgreSQL)

### Step 1: Create PostgreSQL Database on Render
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **PostgreSQL**.
3. Name: `pulseboard-db`
4. Database: `pulseboard`
5. User: `pulseboard_user`
6. Region: Choose the region closest to you.
7. Click **Create Database**.
8. Once provisioned, copy the **Internal Database URL** (or External if connecting remotely).

### Step 2: Deploy Backend Web Service on Render
1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect your GitHub repository `pulseboard`.
3. Configure the service:
   - **Name**: `pulseboard-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
4. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Paste the PostgreSQL connection string from Step 1)*
   - `SESSION_SECRET`: *(A random 32+ character secret string)*
   - `CLIENT_ORIGIN`: `https://<YOUR_VERCEL_APP>.vercel.app`
   - `COOKIE_SECURE`: `true`
   - `COOKIE_SAMESITE`: `none`
   - `CLOUDINARY_CLOUD_NAME`: *(Your Cloudinary Cloud Name)*
   - `CLOUDINARY_API_KEY`: *(Your Cloudinary API Key)*
   - `CLOUDINARY_API_SECRET`: *(Your Cloudinary API Secret)*
5. Click **Deploy Web Service**.
6. Note your backend URL (e.g., `https://pulseboard-api.onrender.com`).

*(Alternatively, use the included [`render.yaml`](file:///e:/ai-project%20(riafy)/pulseboard/render.yaml) by creating a **Blueprint** on Render).*

---

## 9. Deployment: Vercel (Frontend)

1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository `pulseboard`.
4. In the Project Configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `client`
   - **Build Command**: `npm run build` (or leave default)
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://pulseboard-api.onrender.com` *(Your Render backend URL)*
6. Click **Deploy**.
7. Vercel will build and deploy the frontend. Single-page navigation and URL refreshes are automatically handled via [`client/vercel.json`](file:///e:/ai-project%20(riafy)/pulseboard/client/vercel.json).
8. Copy your live Vercel domain (e.g. `https://pulseboard.vercel.app`) and ensure it matches the `CLIENT_ORIGIN` variable in your Render backend settings.
