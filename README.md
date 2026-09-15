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
ADMIN_PASSWORD=choose-a-password-at-least-12-characters-long
```

The application intentionally does not commit admin passwords to GitHub.
`ADMIN_USERNAME` defaults to `bohiiic`, and the first admin account is created
from the environment variables when the API starts. The current security
policy requires an admin password with at least 12 characters, so
`986532op` cannot be used as-is; use a longer version instead.

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
ADMIN_PASSWORD='your-strong-admin-password' \
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

Set the API's `CLIENT_ORIGIN` to:

```text
https://bohiiic.tech
```

The included Pages workflow builds `dist/` and preserves the custom domain in
`CNAME`.

## Validation

```bash
npm run build
npm audit --omit=dev --audit-level=moderate
```
