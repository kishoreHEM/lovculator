/**
 * 🚀 Lovculator - Optimized & Fixed Server.js (Production + Local Friendly)
 * Author: Kishore M
 */

import express from "express";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";

import analyticsRoutesFactory from "./routes/analytics.js";
import { trackPageVisit } from "./middleware/trackVisit.js";
import questionsRouter from "./routes/questions.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import storiesRoutes from "./routes/stories.js";

// =====================================================
// 🌍 Environment Setup
// =====================================================
dotenv.config();
const app = express();
const { Pool } = pg;
const PgSession = connectPgSimple(session);

// =====================================================
// 📂 Path Resolution
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleFrontendPaths = [
  path.join(__dirname, "../frontend"),
  path.join(process.cwd(), "frontend"),
  "/app/frontend",
];

let frontendPath = possibleFrontendPaths.find((p) => {
  try {
    return fs.existsSync(path.join(p, "index.html"));
  } catch {
    return false;
  }
});

if (!frontendPath) {
  console.warn("⚠️ No frontend folder found in expected paths. Using fallback /frontend");
  frontendPath = "/frontend";
} else {
  console.log(`🌍 Frontend served from: ${frontendPath}`);
}

// =====================================================
// 💽 Database Setup
// =====================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL database"))
  .catch((err) => console.error("❌ Database connection failed:", err.message));

// =====================================================
// 🧠 Core Middleware Order (CORS + Session + Helmet)
// =====================================================
app.set("trust proxy", 1);

app.use(cors({
  origin: [
    "https://lovculator.com",
    "https://www.lovculator.com",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgStore = new PgSession({ pool, tableName: "session_store" });

app.use(
  session({
    store: PgStore,
    secret: process.env.SESSION_SECRET || "lovculator_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true only on HTTPS
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      domain: process.env.NODE_ENV === "production" ? ".lovculator.com" : undefined,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

console.log("✅ Session configured with CORS and SameSite=None");

// Helmet AFTER session to avoid blocking cookies
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.disable("x-powered-by");

// =====================================================
// 🛡️ Security Filters
// =====================================================
const BLOCKED_IPS = new Set([
  "62.60.131.162",
  "159.89.127.165",
  "162.241.224.32",
  "122.45.51.68",
]);

const MALICIOUS_USER_AGENTS = ["Go-http-client", "l9scan"];
const SENSITIVE_PATHS = [".env", ".json", "/config/", "/.git", "/swagger", "/graphql", ".php"];

app.use((req, res, next) => {
  const clientIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "";
  const reqPath = req.path.toLowerCase();

  if (BLOCKED_IPS.has(clientIP)) {
    console.log(`🚨 BLOCKED IP: ${clientIP}`);
    return res.status(403).send("Access denied");
  }

  if (MALICIOUS_USER_AGENTS.some((ua) => userAgent.includes(ua))) {
    console.log(`🚨 BLOCKED UA: ${userAgent}`);
    return res.status(404).send("Not found");
  }

  if (SENSITIVE_PATHS.some((s) => reqPath.includes(s))) {
    console.log(`🚨 BLOCKED PATH: ${req.path}`);
    return res.status(404).send("Not found");
  }

  next();
});

// =====================================================
// 🔁 HTTPS Redirect (Production)
// =====================================================
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// =====================================================
// 🧩 API Routes
// =====================================================
app.use(express.static(frontendPath));

// ✅ Serve uploaded files (user avatars, images, etc.)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/analytics", analyticsRoutesFactory(pool));
app.use(trackPageVisit);
app.use("/api/questions", questionsRouter(pool));

// Handle missing API routes gracefully
app.use("/api/*", (req, res) => res.status(404).json({ error: "API route not found" }));

// =====================================================
// 📊 Analytics Logging
// =====================================================
app.use(async (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.match(/\.(js|css|png|jpg|svg|json|ico)$/i)) {
    return next();
  }

  const timestamp = new Date().toISOString();
  const clientIP = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "Unknown device";
  console.log(`📖 [${timestamp}] Page View: ${req.path} | IP: ${clientIP} | UA: ${userAgent}`);

  try {
    await pool.query(
      "INSERT INTO page_visits (path, ip_address, user_agent) VALUES ($1, $2, $3)",
      [req.path, clientIP, userAgent]
    );
  } catch (err) {
    console.error("⚠️ Analytics error:", err.message);
  }

  next();
});

// =====================================================
// 🌐 Frontend Page Routes
// =====================================================
const validPages = [
  "index",
  "login",
  "signup",
  "profile",
  "love-calculator",
  "about",
  "contact",
  "privacy",
  "terms",
  "record",
  "admin-analytics",
];

validPages.forEach((page) => {
  const routePath = page === "index" ? "/" : `/${page}`;
  app.get(routePath, (req, res) => {
    res.sendFile(path.join(frontendPath, `${page}.html`));
  });
});

// 🧠 Serve SEO-friendly question page (like Quora)
app.get("/questions/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "question.html"));
});

// =====================================================
// 🚫 404 Fallback
// =====================================================
app.use((req, res) => {
  const file404 = path.join(frontendPath, "404.html");
  if (fs.existsSync(file404)) {
    res.status(404).sendFile(file404);
  } else {
    res.status(404).send("404 - Page Not Found");
  }
});

// =====================================================
// 🚀 Start Server
// =====================================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${pool ? "Connected" : "Not connected"}`);
  console.log(`🌍 Frontend served from: ${frontendPath}`);
});
