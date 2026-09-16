# Bohiiic

Private movie library with a React/Vite frontend, Sass styling, Express API,
and SQLite database.

## Features

- React interface for the private movie library
- Admin-only movie uploads and deletion
- Authenticated video streaming
- SQLite persistence for users and movies
- bcrypt password hashing
- HTTP-only signed session cookies
- Login rate limiting and security headers
- MP4, WebM, and MOV upload support

## Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env` before starting the server:

```env
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
ADMIN_USERNAME=bohiiic
ADMIN_PASSWORD=bohiiicbohiiic
```

The application intentionally does not commit admin passwords to GitHub.
`ADMIN_USERNAME` defaults to `bohiiic`, and the first admin account is created
from the environment variables when the API starts. The current security
policy requires an admin password with at least 12 characters, so
`986532op` cannot be used as-is; use a longer version instead.
After the first admin account exists, restarts do not require
`ADMIN_PASSWORD` again unless you create a new admin username.

If `JWT_SECRET` is missing in local development, the API will generate a
temporary in-memory secret so startup still succeeds (existing sessions will be
invalidated on restart). In production, `JWT_SECRET` is always required.

Start the development frontend and API:

```bash
npm run dev
```

Open <http://localhost:5173>.

## Production

Build the frontend:

```bash
npm run build
```

Start the API:

```bash
NODE_ENV=production \
COOKIE_SECURE=true \
JWT_SECRET='your-long-random-secret' \
ADMIN_USERNAME='bohiiic' \
ADMIN_PASSWORD='bohiiicbohiiic' \
npm start
```

Use HTTPS in production. Keep `data/`, `uploads/`, and `.env` on the API
server; do not publish them through GitHub Pages or commit them to Git.

## GitHub Pages

GitHub Pages can host the built React frontend, but it cannot run the
Express/SQLite backend. Host the API separately over HTTPS and configure the
GitHub repository variable `VITE_API_URL` with its public origin, for example:

```text
https://api.example.com
```

For this project, set `VITE_API_URL` to your real backend URL (for example a
Render service URL) in **Settings → Secrets and variables → Actions → Variables**.

Set the API's `CLIENT_ORIGIN` to:

```text
https://bohiiic.tech
```

The included Pages workflow builds `dist/` and preserves the custom domain in
`CNAME`.

### Automatic backend deploy from GitHub

GitHub cannot keep the Express server running by itself. To keep your backend
running, host it on a platform like Render/Railway/Fly and trigger deploys
automatically from GitHub Actions.

1. Create a backend web service on your host.
2. Copy the host's deploy hook URL.
3. Add GitHub repository secret `BACKEND_DEPLOY_HOOK` with that URL.
4. Push to `main`; the workflow below will call the hook and redeploy backend.

If the repository is configured to publish the `main` branch root instead of
GitHub Actions, the root page redirects to the committed `dist/` fallback.
Prefer setting **Settings → Pages → Source → GitHub Actions** so the workflow
builds a fresh artifact on every push.

## Validation

```bash
npm run build
npm audit --omit=dev --audit-level=moderate
```
