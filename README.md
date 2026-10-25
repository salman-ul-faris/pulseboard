# PulseBoard — Precision Productivity & Task Intelligence Platform

PulseBoard is an enterprise-grade, full-stack productivity web application designed with a deep-navy aesthetic, electric-mint accents, persistent PostgreSQL data storage, secure session authentication, and serverless Cloudinary image uploads.

The codebase is organized as a unified monorepo optimized for **Netlify Serverless Deployment**:
- **Frontend**: High-speed CDN edge hosting built with **React 18 + Vite** (`client/dist`)
- **Backend API**: Serverless Express API running on **Netlify Functions** (`netlify/functions/api.js`)
- **Database**: Managed persistent **PostgreSQL** (Neon, Supabase, Render Postgres, AWS RDS)
- **Profile Picture Storage**: Direct-signed cloud uploads via **Cloudinary**

---

## 1. Project Structure

```
pulseboard/
├── client/                     # Frontend (React 18 + Vite)
│   ├── src/
│   │   ├── components/         # Logo, BackgroundWave, Header, Sidebar, TaskCard, TaskModal, SummaryCards
│   │   ├── context/            # AuthContext (session, user, settings)
│   │   ├── pages/              # LoginPage, RegisterPage, DashboardPage, SettingsPage
│   │   ├── services/           # API fetch client (same-origin /api + credentials: 'include')
│   │   ├── App.jsx             # Shell & view orchestrator
│   │   ├── index.css           # Design tokens, variables, & reduced-motion support
│   │   └── main.jsx
│   ├── index.html
│   ├── vercel.json             # Vercel SPA rewrites & security headers (retained for compatibility)
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
├── netlify/                    # Netlify Serverless Architecture
│   └── functions/
│       └── api.js              # Serverless Express entrypoint (serverless-http adapter + DB pool caching)
├── server/                     # Backend Logic & Database Layer
│   ├── src/
│   │   ├── db/                 # DB connection pool (serverless tuned), schema, migrations
│   │   ├── middleware/         # Auth guard, Zod validation, upload security, error handler
│   │   ├── routes/             # Auth, Tasks, Settings, Health
│   │   ├── services/           # Storage service (Cloudinary signed uploads & fallback)
│   │   ├── app.js              # Express app factory, Helmet, CORS, Session Store, CSRF Origin check
│   │   └── index.js            # Standalone server entry point (for local development)
│   ├── migrations/             # SQL schema migrations (users, tasks, user_settings, session)
│   ├── tests/                  # Automated test suite (31 comprehensive tests)
│   ├── .env.example
│   └── package.json
├── netlify.toml                # Netlify build, routing redirects (/api/*), and CDN headers
├── render.yaml                 # Render Blueprint configuration (retained for backward compatibility)
├── .gitignore
├── .env.example
├── package.json                # Root orchestrator scripts & serverless dependencies
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

Run the full automated test suite verifying all 31 critical acceptance criteria across platform, security, profile pictures, and serverless runtime:
```bash
npm test
```

### Verified Test Cases (31 Passing Tests):

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

**Netlify Serverless Architecture & Cloudinary Tests (`server/tests/serverless.test.js`):**
24. `Netlify handler successfully handles GET /api/health and normalizes path`
25. `Netlify handler handles registration, login, and issues same-origin Lax cookie`
26. `Session persists across separate serverless function invocations via shared store`
27. `CSRF & origin verification rejects state-changing requests from untrusted origins`
28. `Direct upload signature endpoint produces valid signature parameters`
29. `Direct upload commit strictly enforces ownership and rejects cross-user asset tampering`
30. `Direct upload commit rejects untrusted image domains`
31. `Concurrent requests succeed without exhausting connection pool`

---

## 7. Netlify Serverless Deployment (Recommended)

PulseBoard is designed for seamless deployment on Netlify with same-origin frontend hosting and serverless functions:

### Step 1: Provision Persistent PostgreSQL Database
1. Provision a PostgreSQL 14+ database using your preferred cloud provider (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), or Render PostgreSQL).
2. Copy your pooled connection URL (e.g., `postgresql://user:password@ep-xyz.neon.tech/pulseboard?sslmode=require`).
3. Run the initial database migration from your local terminal:
   ```bash
   DATABASE_URL="<your_postgres_connection_url>" npm run migrate
   ```

### Step 2: Deploy Site on Netlify
1. Log into your [Netlify Dashboard](https://app.netlify.com).
2. Click **Add new site** > **Import an existing project**.
3. Select **GitHub** and authorize access to `salman-ul-faris/pulseboard`.
4. In the build settings:
   - **Branch**: `main`
   - **Base directory**: *(Leave empty - project root)*
   - **Build command**: `npm run build`
   - **Publish directory**: `client/dist`
   - **Functions directory**: `netlify/functions` *(automatically detected from `netlify.toml`)*
5. Click **Site configuration** > **Environment variables** > **Add a variable**, and configure:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your persistent PostgreSQL connection string)*
   - `SESSION_SECRET`: *(A secure 32+ character random string)*
   - `COOKIE_SECURE`: `true`
   - `COOKIE_SAMESITE`: `lax`
   - `DB_POOL_MAX`: `2`
   - `CLOUDINARY_CLOUD_NAME`: *(Your Cloudinary cloud name)*
   - `CLOUDINARY_API_KEY`: *(Your Cloudinary API key)*
   - `CLOUDINARY_API_SECRET`: *(Your Cloudinary API secret)*
6. Click **Deploy Site**. Netlify will build the Vite frontend, bundle the serverless Express API function, and deploy to your live URL (e.g. `https://pulseboard.netlify.app`).

### Memory & Cold-Start Optimizations
- **PGlite Disabled in Production**: Prevents loading a 400MB+ WebAssembly linear memory heap inside functions.
- **Connection Pool Tuning**: `DB_POOL_MAX=2` prevents connection exhaustion across concurrent function instances.
- **Direct Cloudinary Uploads**: Images are signed on the backend and uploaded directly to Cloudinary's global CDN from the client, avoiding Lambda's 6 MB payload limits and Sharp binary overhead in serverless execution.
- **Event Loop Management**: `context.callbackWaitsForEmptyEventLoop = false` ensures sub-second response times while preserving PostgreSQL connection pools between warm invocations.

---

## 8. Alternative Deployments (Render & Vercel)

Configuration files for Render (`render.yaml`) and Vercel (`client/vercel.json`) remain intact in the repository for legacy environments.

