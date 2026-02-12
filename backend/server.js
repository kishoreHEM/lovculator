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
import adminRoutes from "./routes/admin.js";
import storyPage from "./pages/story.page.js";
import sitemapRoutes from "./routes/sitemap.js";
import optionalAuth from "./middleware/auth.js";

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
const usePgSessionStore =
  process.env.SESSION_STORE === "postgres" ||
  (process.env.NODE_ENV === "production" &&
    process.env.SESSION_STORE !== "memory");

const sessionStore = usePgSessionStore
  ? new PgSession({
      pool,
      tableName: "session_store",
      // Avoid startup DDL on every boot; this query is the source of repeated
      // ECONNRESET noise on flaky remote DB links.
      createTableIfMissing:
        process.env.SESSION_CREATE_TABLE_IF_MISSING === "true",
      // Disable automatic prune timer in app process; run cleanup via DB job/cron.
      pruneSessionInterval: false,
    })
  : undefined;

if (sessionStore && typeof sessionStore.on === "function") {
  sessionStore.on("error", (err) => {
    console.error("❌ Session store error:", err.code || err.message);
  });
}

if (usePgSessionStore) {
  console.log("🗄️ Session store: postgres");
} else {
  console.log("🗄️ Session store: memory (development mode)");
}

const sessionMiddleware = session({
  ...(sessionStore ? { store: sessionStore } : {}),
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
          "https://www.google-analytics.com",
          "https://www.googletagmanager.com" // ✅ Already here, good!
        ],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://lovculator.com",
          "https://www.lovculator.com",
          "http://localhost:3001",
          "https://www.googletagmanager.com", // ✅ Already here, good!
          "https://www.google-analytics.com",
          "https://cdn.jsdelivr.net",
        ],

        scriptSrcAttr: ["'self'", "'unsafe-inline'"],

        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],

        styleSrcAttr: ["'self'", "'unsafe-inline'"],

        fontSrc: ["'self'", "https://fonts.gstatic.com"],

        connectSrc: [
          "'self'",
          "https://lovculator.com",
          "https://www.lovculator.com",
          "wss://lovculator.com",
          "ws://localhost:3001",
          process.env.FRONTEND_URL,
          "https://cdn.jsdelivr.net",
          "https://www.google-analytics.com",
          "https://region1.google-analytics.com",
          "https://www.googletagmanager.com" // ✅ ADD THIS - THIS IS WHAT'S MISSING!
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

// 🔥 Redirect *.html → clean URL (EXCEPT components)
app.get("/*.html", (req, res, next) => {
  // 🛑 STOP: Do not redirect component files!
  if (req.path.includes("/components/")) {
    return next(); // Pass to static middleware to serve the file
  }

  // Remove .html extension
  const cleanPath = req.path.replace(".html", "");
  
  // ✅ FIX: Preserve Query String (e.g. ?token=xyz or ?email=abc)
  const queryString = req.url.indexOf('?') !== -1 ? req.url.substring(req.url.indexOf('?')) : "";
  
  return res.redirect(301, (cleanPath || "/") + queryString);
});


//
// 🔟 STATIC FILES (Frontend & Uploads)
//
// 🧩 View Engine (EJS for SEO pages)
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "backend/views"));

// 🔴 SEO / SSR pages FIRST
app.use(storyPage);

app.use(
  express.static(frontendPath, {
    maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  })
);

// Serve /uploads (avatars, posts, etc.)
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
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

// 🔐 Admin static assets (CSS / JS)
app.use(
  "/admin-assets",
  express.static(path.join(process.cwd(), "public/admin"))
);

// 🔐 Admin UI (HTML)
app.get("/admin", async (req, res) => {
  // 1. Check Session
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.redirect("/login?redirect=/admin");
  }

  try {
    // 2. Verify Admin Status
    const { rows } = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [userId]
    );

    if (!rows[0]?.is_admin) {
      return res.status(403).send("Forbidden: Admins only.");
    }

    // 3. Locate admin.html (Prioritize public/admin, fallback to frontend)
    const adminPathPublic = path.join(process.cwd(), "public/admin/admin.html");
    const adminPathFrontend = path.join(frontendPath, "admin.html");

    if (fs.existsSync(adminPathPublic)) {
       return res.sendFile(adminPathPublic);
    } else if (fs.existsSync(adminPathFrontend)) {
       return res.sendFile(adminPathFrontend);
    } else {
       // Graceful error if file is missing everywhere
       return res.status(404).send("Error: admin.html not found. Please ensure it is in the 'frontend' folder.");
    }

  } catch (err) {
    console.error("Admin route error:", err);
    res.status(500).send("Server Error");
  }
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
app.use("/admin", adminRoutes);
app.use("/", sitemapRoutes);
app.use(optionalAuth);

//
// 1️⃣2️⃣ FRONTEND PAGES (AUTO-MAPPED CLEAN URLS)
//

// Get all .html files inside /frontend directory
const htmlFiles = fs
  .readdirSync(frontendPath)
  .filter((file) => file.endsWith(".html"));

// Example: "profile.html" → "profile"
htmlFiles.forEach((file) => {
  const routePath =
    file === "index.html"
      ? "/"                       // index → /
      : "/" + file.replace(".html", "");  // "profile.html" → "/profile"

  app.get(routePath, (req, res) => {
    res.sendFile(path.join(frontendPath, file));
  });
});

// SEO-friendly question page
app.get("/question/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "question.html"));
});

// 🆕 Clean profile slug route
app.get("/profile/:username", (req, res) => {
  res.sendFile(path.join(frontendPath, "profile.html"));
});
// ✅ NEW: Route for Shared Love Stories (slug only)
app.get("/stories/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "love-stories.html"));
});

// ✅ NEW: Route for Shared Posts
// Serves index.html (feed) when visiting /post/123
app.get("/post/:id", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
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
