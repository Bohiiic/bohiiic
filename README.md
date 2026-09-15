## Bohiiic

Private movie library built with React, Vite, Express, SQLite, and secure
HTTP-only sessions.

### Development

```bash
npm install
cp .env.example .env
# Replace JWT_SECRET and ADMIN_PASSWORD with your own values.
npm run dev
```

Open <http://localhost:5173>. The admin account is created on first server
start from `ADMIN_USERNAME` and `ADMIN_PASSWORD`; change those values before
deploying. Uploaded movies are stored outside the public client bundle.

### Stack

- React and Vite for the client
- Sass (`src/styles.scss`) for the UI
- Express for the API
- SQLite for SQL persistence
- bcrypt password hashing and signed, HTTP-only sessions
- Helmet security headers and login rate limiting

### Production notes

Set a unique `JWT_SECRET`, a strong admin password, HTTPS, and a reverse proxy
before exposing this server to the internet. The server validates upload types,
limits upload size, stores generated filenames, and keeps the upload directory
behind authentication.

Unauthenticated requests cannot read movie metadata or video files. The client
bundle still contains the login screen, which is required to let users sign in;
the library itself is rendered only after the authenticated API session is
validated.
