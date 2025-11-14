/**
 * backend/server.js — FINAL PRODUCTION SERVER (Lovculator)
 * Fully compatible with:
 * - Node 24 ESM
 * - ws@8.x (correct WebSocketServer import)
 * - PostgreSQL session store
 * - Avatar uploads, Stories, Users, Auth, Messages
 * - WebSockets (real-time messages)
 */

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

// ⭐ Correct WebSocket import for ws@8 + Node 24 + ESM ⭐
import * as ws from "ws";
const WebSocketServer = ws.WebSocketServer;





// Load environment variables
dotenv.config();

// Database pool
import pool from "./db.js";

// Import routes
import analyticsRoutesFactory from "./routes/analytics.js";
import { trackPageVisit } from "./middleware/trackVisit.js";
import questionsRouter from "./routes/questions.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import storiesRoutes from "./routes/stories.js";
import messageRoutes from "./routes/messages.js";

// Path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend detection
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

console.log(`🌍 Frontend served from: ${frontendPath}`);

// Express app & HTTP server
const app = express();
const server = http.createServer(app);

// CORS
app.set("trust proxy", 1);
app.use(
  cors({
    origin: [
      "https://lovculator.com",
      "https://www.lovculator.com",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// SESSION STORE
const PgSession = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({ pool, tableName: "session_store" }),
  secret: process.env.SESSION_SECRET || "lovculator_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.NODE_ENV === "production" ? ".lovculator.com" : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});
app.use(sessionMiddleware);

console.log("✅ Session middleware configured");

// Helmet CSP
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://lovculator.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://lovculator.com",
          "ws://localhost:3001",
          "wss://lovculator.com",
        ],
      },
    },
  })
);

// Security filters
const BLOCKED_IPS = new Set([]);
const BAD_UA = ["Go-http-client", "l9scan"];
app.use((req, res, next) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"] || "";

  if (BLOCKED_IPS.has(ip)) return res.status(403).send("Access denied");
  if (BAD_UA.some((b) => ua.includes(b))) return res.status(404).send("Not found");

  next();
});

// Force HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Static frontend
app.use(express.static(frontendPath));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/analytics", analyticsRoutesFactory(pool));
app.use("/api/questions", questionsRouter(pool));
app.use("/api/messages", messageRoutes); // conversations + messages

// Page View Analytics
app.use(trackPageVisit);

// Unknown API
app.use("/api/*", (req, res) => res.status(404).json({ error: "API route not found" }));

// Frontend pages
const pages = [
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
pages.forEach((p) =>
  app.get(p === "index" ? "/" : `/${p}`, (req, res) =>
    res.sendFile(path.join(frontendPath, `${p}.html`))
  )
);
app.get("/questions/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "question.html"));
});

// 404 fallback
app.use((req, res) => {
  const f = path.join(frontendPath, "404.html");
  if (fs.existsSync(f)) return res.status(404).sendFile(f);
  res.status(404).send("404 - Not Found");
});

//
// =====================================================
// 🔥 WEBSOCKET SERVER — FINAL WORKING VERSION
// =====================================================

const wss = new WebSocketServer({ noServer: true });


const userSockets = new Map();

function registerSocket(userId, ws) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);
  ws.userId = userId;
}

function unregisterSocket(ws) {
  const uid = ws.userId;
  const set = userSockets.get(uid);
  if (set) {
    set.delete(ws);
    if (set.size === 0) userSockets.delete(uid);
  }
}

wss.on("connection", (ws, req) => {
  const userId = req.session?.user?.id;
  if (!userId) return ws.close();

  registerSocket(userId, ws);

  ws.on("message", async (raw) => {
    const data = JSON.parse(raw.toString());

    if (data.type === "send_message") {
      const { conversationId, targetUserId, message_text } = data;

      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, message_text, created_at, is_read)
         VALUES ($1,$2,$3,NOW(),false)
         RETURNING *`,
        [conversationId, userId, message_text.trim()]
      );

      const payload = { type: "new_message", message: result.rows[0] };

      userSockets.get(userId)?.forEach((s) => s.readyState === WebSocket.OPEN && s.send(JSON.stringify(payload)));
      userSockets.get(targetUserId)?.forEach((s) => s.readyState === WebSocket.OPEN && s.send(JSON.stringify(payload)));
    }
  });

  ws.on("close", () => unregisterSocket(ws));
});

server.on("upgrade", (req, socket, head) => {
  sessionMiddleware(req, {}, () => {
    if (!req.session?.user?.id) return socket.destroy();

    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
});



// --------------------------------------------------------
// Start Server
// --------------------------------------------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
  console.log(`🚀 Lovculator server is running on port ${PORT}`)
);
