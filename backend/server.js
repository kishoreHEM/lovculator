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
    origin: ["https://lovculator.com", "http://localhost:3000"],
    credentials: true, // allow cookies to be sent
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
// 🛡️ SECURITY BLOCKER MIDDLEWARE (NEW SECTION)
// =====================================================

// NOTE: It is generally not recommended to block common crawlers (like CCBot)
// unless they are causing a severe performance issue, as this hurts general SEO/indexing.
// I have removed the CCBot IP and User Agent from the lists below.

const BLOCKED_IPS = new Set([
  '62.60.131.162',  // Config scanner
  '159.89.127.165', // API/Swagger scanner
  '162.241.224.32', // xmlrpc scanner
  '122.45.51.68',   // xmlrpc scanner
]);

const MALICIOUS_USER_AGENTS = [
  'Go-http-client',
  'l9scan',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:85.0)' 
];

// Block sensitive file patterns
const SENSITIVE_PATHS = [
  // Block common config/leakage paths
  '.env', '.json', '/config/', '/appsettings', '/.git', '/.docker',
  // Block API/dev tool discovery
  '/swagger', '/graphql', '/actuator', '/v2/api-docs', '/v3/api-docs',
  // Block exploit paths
  '/xmlrpc', '.php', '/server-status'
];


app.use((req, res, next) => {
  // Use the established method for getting the client IP from the proxy
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path.toLowerCase();

  // 🚫 Block by IP
  if (BLOCKED_IPS.has(clientIP)) {
    console.log(`🚨 BLOCKED: Malicious IP ${clientIP} accessing ${req.path}`);
    return res.status(403).send('Access denied');
  }

  // 🚫 Block by User Agent
  if (MALICIOUS_USER_AGENTS.some(ua => userAgent.includes(ua))) {
    console.log(`🚨 BLOCKED: Suspicious User Agent "${userAgent}" from IP ${clientIP}`);
    // Use 404/Not Found for the User Agent block as a non-committal response
    return res.status(404).send('Not found'); 
  }

  // 🚫 Block sensitive file access
  if (SENSITIVE_PATHS.some(sensitivePath => path.includes(sensitivePath))) {
    console.log(`🚨 BLOCKED: Sensitive path access ${req.path} from IP ${clientIP}`);
    return res.status(404).send('Not found'); // Return 404 to hide existence
  }

  // ✅ Allow legitimate requests
  next();
});

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
app.set("trust proxy", 1); // ✅ Important for Railway behind HTTPS proxy

app.use(
  session({
    store: new PgSession({ pool, tableName: "session_store" }),
    secret: process.env.SESSION_SECRET || "lovculator_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true in prod (HTTPS)
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // ⚡ critical fix
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);


console.log("✅ Session configured with trust proxy and SameSite=None");

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
    // 1. Core exclusions (API, assets)
    req.path.startsWith("/api") ||
    req.path.includes("/js/") ||
    req.path.includes("/css/") ||
    req.path.includes("/images/") ||
    
    // 2. Added exclusions for malicious scanning 🛡️
    req.path.includes(".json") ||         // Filter attempts to grab config files (appsettings.json, angular.json)
    req.path.includes(".env") ||          // Filter attempts to grab environment files
    req.path.includes("/xmlrpc.php") ||   // Filter common WordPress/exploit attempts
    req.path.includes("/robots.txt") ||   // Filter standard bot checks
    req.path.includes("/swagger") ||      // Filter API discovery attempts
    req.path.includes("/api-docs") ||
    req.path.includes("/graphql") ||
    req.path.includes("/actuator")
  ) {
    return next();
  }

  const timestamp = new Date().toISOString();
  const clientIP =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"] || "Unknown device";

  // Only log if it passes all filters
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
