/**
 * 🚀 Lovculator - Production Server.js (Railway Ready)
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

// =====================================================
// 🌍 Environment Setup
// =====================================================
dotenv.config();
const app = express();
const { Pool } = pg;
const PgSession = connectPgSimple(session);

// =====================================================
// 📂 Path Resolution (ESM Safe)
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect frontend path
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
// 💽 Database Setup (PostgreSQL)
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
// 🔒 CORS Configuration (Frontend Communication)
// =====================================================
app.use(
  cors({
    origin: [
      "https://lovculator.com",  // ✅ Production site
      "http://localhost:3000",   // ✅ Local dev React
      "http://localhost:5173",   // ✅ Local Vite
    ],
    credentials: true, // ✅ allow cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =====================================================
// 🧱 Security & Performance Middleware
// =====================================================
app.use(helmet());
app.use(compression());
app.disable("x-powered-by");

// =====================================================
// 🔁 HTTPS Redirect (Production Only)
// =====================================================
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// =====================================================
// 🍪 Session Store (PostgreSQL)
// =====================================================
app.use(
  session({
    store: new PgSession({
      pool: pool,
      tableName: "session_store",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "lovculator_secret_key_2025",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // ✅ true only in production
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);
console.log("✅ Session store configured successfully");

// =====================================================
// 🧩 Core Middleware
// =====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontendPath));

// =====================================================
// 🧠 API Routes
// =====================================================
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import storiesRoutes from "./routes/stories.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/analytics", analyticsRoutesFactory(pool));

// Catch-all for invalid API endpoints
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// =====================================================
// 📊 Page View Logger (Analytics)
// =====================================================
app.use(async (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.includes("/js/") ||
    req.path.includes("/css/") ||
    req.path.includes("/images/")
  ) {
    return next();
  }

  const timestamp = new Date().toISOString();
  const clientIP =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "Unknown device";

  console.log(`📖 [${timestamp}] Page View: ${req.path} | IP: ${clientIP} | Device: ${userAgent}`);

  try {
    await pool.query(
      `INSERT INTO page_visits (path, ip_address, user_agent) VALUES ($1, $2, $3)`,
      [req.path, clientIP, userAgent]
    );
  } catch (err) {
    console.error("⚠️ Failed to log page visit:", err.message);
  }

  next();
});

// =====================================================
// 🌐 Static Frontend Routes (Clean URLs)
// =====================================================
const validPages = [
  "index",
  "login",
  "signup",
  "profile",
  "love-stories",
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
    const file = path.join(frontendPath, `${page}.html`);
    res.sendFile(file);
  });
});

// =====================================================
// 🚫 404 Fallback for Other Routes
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
