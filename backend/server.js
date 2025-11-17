/**
 * backend/server.js — Lovculator Real-Time Server (UPDATED FINAL)
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
import * as ws from "ws";
const WebSocketServer = ws.WebSocketServer;

dotenv.config();
import pool from "./db.js";

// ROUTES
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

const possibleFrontendPaths = [
  path.join(__dirname, "../frontend"),
  path.join(process.cwd(), "frontend"),
  "/app/frontend"
];

let frontendPath =
  possibleFrontendPaths.find((p) => {
    try { return fs.existsSync(path.join(p, "index.html")); }
    catch { return false; }
  }) || path.join(process.cwd(), "frontend");

console.log(`🌍 Serving frontend from: ${frontendPath}`);

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

// CORS
app.use(cors({
  origin: [
    "https://lovculator.com",
    "https://www.lovculator.com",
    "http://localhost:3000"
  ],
  credentials: true,
}));

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
    maxAge: 1000 * 60 * 60 * 24 * 7
  },
});
app.use(sessionMiddleware);

// SECURITY
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "blob:", "data:", "https://lovculator.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        "https://lovculator.com",
        "wss://lovculator.com",
        "ws://localhost:3001"
      ],
    },
  },
}));

// Force HTTPS (prod only)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// STATIC FILES
app.use(express.static(frontendPath));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stories", storiesRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/analytics", analyticsRoutesFactory(pool));
app.use("/api/questions", questionsRouter(pool));
app.use(trackPageVisit);

// FRONTEND PAGES
const pages = [
  "index","login","signup","profile","love-calculator","record",
  "about","contact","privacy","terms","admin-analytics"
];

pages.forEach((p) =>
  app.get(p === "index" ? "/" : `/${p}`, (req, res) =>
    res.sendFile(path.join(frontendPath, `${p}.html`))
  )
);

// 404
app.use((req, res) => {
  const f = path.join(frontendPath, "404.html");
  if (fs.existsSync(f)) return res.status(404).sendFile(f);
  res.status(404).send("404 - Not Found");
});

//
// =====================================================
// 🔥 REAL-TIME SERVER (WebSocket)
// =====================================================
//
const wss = new WebSocketServer({ noServer: true });

const userSockets = new Map(); // userId -> Set(sockets)
const onlineUsers = new Map(); // userId -> lastSeenTime

function broadcastToAll(payload) {
  const str = JSON.stringify(payload);
  [...userSockets.values()].forEach(set => {
    set.forEach(sock => sock.readyState === ws.OPEN && sock.send(str));
  });
}

function broadcastToUsers(userIds, payload) {
  const str = JSON.stringify(payload);
  userIds.forEach(id => {
    const set = userSockets.get(id);
    if (set) set.forEach(ws => ws.readyState === ws.OPEN && ws.send(str));
  });
}

function registerSocket(userId, ws) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);

  ws.userId = userId;
  onlineUsers.set(userId, new Date());

  broadcastPresence(userId, true);
}

function unregisterSocket(ws) {
  const userId = ws.userId;
  if (!userId) return;

  const set = userSockets.get(userId);
  if (!set) return;

  set.delete(ws);

  if (set.size === 0) {
    onlineUsers.set(userId, new Date());
    broadcastPresence(userId, false);
  }
}

function broadcastPresence(userId, isOnline) {
  const lastSeen = onlineUsers.get(userId);

  broadcastToAll({
    type: "PRESENCE",
    userId,
    isOnline,
    lastSeen,
  });
}

// EVENT EXPORTS FOR MESSAGE ROUTES
app.set("broadcastNewMessage", (message, recipients) =>
  broadcastToUsers(recipients, { type: "NEW_MESSAGE", message })
);

app.set("broadcastEditedMessage", (message, recipients) =>
  broadcastToUsers(recipients, { type: "MESSAGE_EDITED", message })
);

app.set("broadcastDeletedMessage", (messageId, recipients) =>
  broadcastToUsers(recipients, { type: "MESSAGE_DELETED", messageId })
);

app.set("broadcastSeenMessage", (conversationId, messageId, toUserId) =>
  broadcastToUsers([toUserId], { type: "MESSAGE_SEEN", conversationId, messageId })
);

// TYPING
wss.on("connection", (ws, req) => {
  const uid = req.session?.user?.id;
  if (!uid) return ws.close();

  registerSocket(uid, ws);

  ws.on("message", raw => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { return; }

    if (data.type === "TYPING") {
      broadcastToUsers([data.toUserId], {
        type: "TYPING",
        conversationId: data.conversationId,
        isTyping: data.isTyping,
        fromUserId: uid
      });
    }
  });

  ws.on("close", () => unregisterSocket(ws));
});

// UPGRADE
server.on("upgrade", (req, socket, head) => {
  sessionMiddleware(req, {}, () => {
    if (!req.session?.user?.id) return socket.destroy();
    wss.handleUpgrade(req, socket, head, ws =>
      wss.emit("connection", ws, req)
    );
  });
});

//
// START SERVER
//
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Lovculator running on port ${PORT}`));
