import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProduction) {
    throw new Error("JWT_SECRET must be set in .env and be at least 32 characters long. Copy .env.example to .env.");
  }
  jwtSecret = crypto.randomBytes(48).toString("hex");
  console.warn("JWT_SECRET is missing or too short; using an in-memory development secret for this run.");
}
const secureCookies = process.env.COOKIE_SECURE === "true";
if (isProduction && !secureCookies) {
  throw new Error("COOKIE_SECURE=true is required when NODE_ENV=production.");
}

const db = new Database(path.join(dataDir, "bohiiic.db"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const adminUsername = process.env.ADMIN_USERNAME || "Admin";
const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUsername);
if (!existingAdmin) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be set in .env and be at least 12 characters long.");
  }
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
    .run(adminUsername, bcrypt.hashSync(adminPassword, 12));
}

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigin = process.env.CLIENT_ORIGIN;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin, credentials: true }));
}
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.disable("x-powered-by");
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7" }));

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many login attempts. Try again later." }
});

const invalidPasswordHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.V4k0HnQJ4n4JjA9f9hYQqM7G1qjQv3K";

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, jwtSecret, {
    expiresIn: "8h",
    issuer: "bohiiic"
  });
}

function requireAuth(req, res, next) {
  const token = req.cookies.bohiiic_session;
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try {
    req.user = jwt.verify(token, jwtSecret, { issuer: "bohiiic" });
    next();
  } catch {
    res.clearCookie("bohiiic_session", { httpOnly: true, sameSite: "lax", secure: secureCookies, path: "/" });
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.mimetype)) {
      return callback(new Error("Only MP4, WebM, and MOV videos are supported."));
    }
    callback(null, true);
  }
});

app.post("/api/auth/login", loginLimit, (req, res) => {
  const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!bcrypt.compareSync(password, user?.password_hash || invalidPasswordHash)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  res.cookie("bohiiic_session", signToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies,
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  });
  res.json({ user: { username: user.username, role: user.role } });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("bohiiic_session", { httpOnly: true, sameSite: "lax", secure: secureCookies, path: "/" });
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

app.get("/api/movies", requireAuth, (_req, res) => {
  res.set("Cache-Control", "no-store");
  const movies = db.prepare("SELECT id, title, description, filename, original_name, mime_type, size, created_at FROM movies ORDER BY created_at DESC").all();
  res.json({ movies: movies.map((movie) => ({ ...movie, url: `/uploads/${movie.filename}` })) });
});

app.post("/api/movies", requireAuth, requireAdmin, upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A video file is required." });
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  if (!title || title.length > 160) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: "A title between 1 and 160 characters is required." });
  }
  let result;
  try {
    result = db.prepare("INSERT INTO movies (title, description, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)")
      .run(title, description.slice(0, 2000), req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);
  } catch (error) {
    fs.rmSync(req.file.path, { force: true });
    throw error;
  }
  res.status(201).json({ id: result.lastInsertRowid, title, description, url: `/uploads/${req.file.filename}` });
});

app.delete("/api/movies/:id", requireAuth, requireAdmin, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid movie id." });
  const movie = db.prepare("SELECT filename FROM movies WHERE id = ?").get(id);
  if (!movie) return res.status(404).json({ error: "Movie not found." });
  db.prepare("DELETE FROM movies WHERE id = ?").run(id);
  fs.rmSync(path.join(uploadDir, movie.filename), { force: true });
  res.status(204).end();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/uploads", requireAuth, (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
}, express.static(uploadDir, { fallthrough: false }));
app.use(express.static(path.join(root, "dist")));
app.use((_req, res) => res.sendFile(path.join(root, "dist", "index.html")));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError || error.message?.includes("Only MP4")) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON request body." });
  }
  console.error(error);
  res.status(500).json({ error: "Unexpected server error." });
});

const server = app.listen(port, () => console.log(`Bohiiic is running at http://localhost:${port}`));

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the other process or set a different PORT.`);
    process.exit(1);
  }
  if (error?.code === "EACCES") {
    console.error(`Insufficient privileges to bind to port ${port}.`);
    process.exit(1);
  }
  throw error;
});

let isShuttingDown = false;
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Received ${signal}. Shutting down...`);
  server.close((serverError) => {
    if (serverError) {
      console.error("Error while closing HTTP server:", serverError);
      process.exitCode = 1;
    }
    try {
      db.close();
    } catch (dbError) {
      console.error("Error while closing database:", dbError);
      process.exitCode = 1;
    }
    process.exit();
  });
  setTimeout(() => {
    console.error("Force exiting after shutdown timeout.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
