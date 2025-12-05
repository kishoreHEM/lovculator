/**
 * backend/server.js — Lovculator HTTP Server (FINAL, SPLIT VERSION)
 *
 * Responsibilities:
 * - HTTP API server (Express)
 * - Session management + security (Helmet, CORS)
 * - Static frontend & uploads
 * - Attaches WebSocket layer from ./ws.js
 */

//
// 1️⃣ IMPORTS & BASIC SETUP
//
import express from "express";
import http from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { fileURLToPath } from "url";

dotenv.config();

import pool from "./db.js";
import { initWebSocketLayer } from "./ws.js";

//
// 2️⃣ ROUTES IMPORTS
//
import analyticsRoutesFactory from "./routes/analytics.js";
import { trackPageVisit } from "./middleware/trackVisit.js";
import questionsRouter from "./routes/questions.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import storiesRoutes from "./routes/stories.js";
import messageRoutes from "./routes/messages.js";
import notificationsRouter from "./routes/notifications.js";
import postsRouter from "./routes/posts.js";
import feedRouter from "./routes/feed.js";
import commentsRouter from "./routes/comments.js";
import followRoutes from "./routes/follow.js";

//
// 3️⃣ PATH RESOLUTION & FRONTEND ROOT
//
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleFrontendPaths = [
  path.join(__dirname, "../frontend"),
  path.join(process.cwd(), "frontend"),
  "/app/frontend",
];

let frontendPath =
  possibleFrontendPaths.find((p) => {
    try {
      return fs.existsSync(path.join(p, "index.html"));
    } catch {
      return false;
    }
  }) || path.join(process.cwd(), "frontend");

console.log(`🌍 Serving frontend from: ${frontendPath}`);

//
// 4️⃣ EXPRESS APP & HTTP SERVER
//
const app = express();
const server = http.createServer(app);

// Express will trust reverse proxy headers (for HTTPS, IP, etc.)
app.set("trust proxy", 1);

//
// 5️⃣ CORS CONFIGURATION
//
app.use(
  cors({
    origin: [
      "https://lovculator.com",
      "https://www.lovculator.com",
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

//
// 6️⃣ CORE MIDDLEWARES (body parser, compression)
//
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);

//
// 7️⃣ SESSION STORE (Postgres)
//
const PgSession = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: "session_store",
    createTableIfMissing: true,
  }),
  secret:
    process.env.SESSION_SECRET || "lovculator_secret_key_change_in_production",
  resave: false,
  saveUninitialized: false,
  rolling: true, // reset maxAge on every request
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain:
      process.env.NODE_ENV === "production" ? ".lovculator.com" : undefined,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
});
app.use(sessionMiddleware);

//
// 8️⃣ SECURITY (Helmet + HTTPS redirect)
//
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        imgSrc: [
          "'self'",
          "blob:",
          "data:",
          "https://lovculator.com",
          "https://www.lovculator.com",
          "http://localhost:3001",
          "https://lovculator.com/uploads",
        ],

        // Allow scripts from same origin + inline (for now) + prod host
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://lovculator.com",
          "https://www.lovculator.com",
          "http://localhost:3001",
        ],

        // ❗ Important: allow inline event handlers (onclick, etc.)
        // Otherwise you get: "script-src-attr 'none'" errors
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],

        // Allow inline style attributes set by JS
        styleSrcAttr: ["'self'", "'unsafe-inline'"],

        fontSrc: ["'self'", "https://fonts.gstatic.com"],

        connectSrc: [
          "'self'",
          "https://lovculator.com",
          "https://www.lovculator.com",
          "wss://lovculator.com",
          "ws://localhost:3001",
          process.env.FRONTEND_URL,
        ].filter(Boolean),

        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  })
);

// Force HTTPS in production (except /health)
app.use((req, res, next) => {
  if (
    process.env.NODE_ENV === "production" &&
    req.headers["x-forwarded-proto"] !== "https" &&
    !req.originalUrl.includes("/health")
  ) {
    return res.redirect(301, "https://" + req.headers.host + req.url);
  }
  next();
});

//
// 9️⃣ REQUEST LOGGING & HEALTH CHECK
//
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
  });
});

//
// 🔟 STATIC FILES (Frontend & Uploads)
//
app.use(
  express.static(frontendPath, {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
    etag: true,
    lastModified: true,
  })
);

// Serve /uploads (avatars, posts, etc.)
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "7d",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".pdf")) {
        res.set("Content-Type", "application/pdf");
      }
    },
  })
);
app.use((req, res, next) => {
  // For HTML pages that require authentication, prevent caching
  const protectedPages = [
    '/profile',
    '/messages',
    '/admin-analytics',
    '/stories'
  ];
  
  if (protectedPages.some(page => req.path.startsWith(page))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

//
// 1️⃣1️⃣ API ROUTES
//
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/analytics", analyticsRoutesFactory(pool));

// ✅ FIXED: Removed (pool) call since questionsRouter is now a standard router object
app.use("/api/questions", questionsRouter);

app.use("/api/notifications", notificationsRouter);
app.use("/api/posts/feed", feedRouter);
app.use("/api/posts", postsRouter);
app.use("/api/posts", commentsRouter);
app.use("/api/follow", followRoutes(pool));
app.use(trackPageVisit);

//
// 1️⃣2️⃣ FRONTEND PAGES (HTML files)
//
const pages = [
  "index",
  "login",
  "signup",
  "profile",
  "love-calculator",
  "record",
  "about",
  "contact",
  "privacy",
  "terms",
  "admin-analytics",
  "messages",
];

pages.forEach((p) =>
  app.get(p === "index" ? "/" : `/${p}`, (req, res) =>
    res.sendFile(path.join(frontendPath, `${p}.html`))
  )
);

// SEO-friendly question page, e.g. /questions/why-love-hurts
app.get("/questions/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "question.html"));
});

//
// 1️⃣3️⃣ 404 & GLOBAL ERROR HANDLER
//
app.use((req, res) => {
  const f = path.join(frontendPath, "404.html");
  if (fs.existsSync(f)) return res.status(404).sendFile(f);
  res.status(404).json({ error: "Route not found", code: "ROUTE_NOT_FOUND" });
});

app.use((error, req, res, next) => {
  console.error("🆘 Global error handler:", error);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message,
    code: "INTERNAL_SERVER_ERROR",
  });
});

//
// 1️⃣4️⃣ ATTACH REAL-TIME LAYER (WebSocket + Redis-ready)
//
initWebSocketLayer({
  app,
  server,
  sessionMiddleware,
});

//
// 1️⃣5️⃣ START SERVER
//
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Lovculator server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📁 Frontend path: ${frontendPath}`);
});