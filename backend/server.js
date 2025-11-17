/**
 * backend/server.js — Lovculator Real-Time Server (UPDATED ENHANCED VERSION)
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

// Enhanced CORS configuration
app.use(cors({
  origin: [
    "https://lovculator.com",
    "https://www.lovculator.com",
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Enhanced middleware stack
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression({
  level: 6,
  threshold: 1024
}));

// Enhanced SESSION STORE
const PgSession = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgSession({ 
    pool, 
    tableName: "session_store",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || "lovculator_secret_key_change_in_production",
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset maxAge on every request
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.NODE_ENV === "production" ? ".lovculator.com" : undefined,
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  },
});
app.use(sessionMiddleware);

// Enhanced SECURITY
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "blob:", "data:", "https://lovculator.com", "https://www.lovculator.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://lovculator.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: [
        "'self'",
        "https://lovculator.com",
        "wss://lovculator.com",
        "ws://localhost:3001",
        process.env.FRONTEND_URL
      ].filter(Boolean),
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));

// Enhanced HTTPS redirect (production only)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production" && 
      req.headers["x-forwarded-proto"] !== "https" &&
      !req.originalUrl.includes('/health')) {
    return res.redirect(301, "https://" + req.headers.host + req.url);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV
  });
});

// STATIC FILES
app.use(express.static(frontendPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: '7d',
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.set('Content-Type', 'application/pdf');
    }
  }
}));

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
  "about","contact","privacy","terms","admin-analytics", "messages"
];

pages.forEach((p) =>
  app.get(p === "index" ? "/" : `/${p}`, (req, res) =>
    res.sendFile(path.join(frontendPath, `${p}.html`))
  )
);

// 🧠 Serve SEO-friendly question page (like Quora)
app.get("/questions/:slug", (req, res) => {
  res.sendFile(path.join(frontendPath, "question.html"));
});

// 404 Handler
app.use((req, res) => {
  const f = path.join(frontendPath, "404.html");
  if (fs.existsSync(f)) return res.status(404).sendFile(f);
  res.status(404).json({ error: "Route not found", code: "ROUTE_NOT_FOUND" });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🆘 Global error handler:', error);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: "INTERNAL_SERVER_ERROR"
  });
});

//
// =====================================================
// 🔥 ENHANCED REAL-TIME SERVER (WebSocket)
// =====================================================
//
const wss = new WebSocketServer({ 
  noServer: true,
  clientTracking: true,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    concurrencyLimit: 10
  }
});

// Enhanced connection management
const userSockets = new Map(); // userId -> Set(sockets)
const onlineUsers = new Map(); // userId -> { lastSeenTime, connectionCount }
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  maxConcurrent: 0,
  totalMessages: 0
};

// Connection rate limiting
const wsConnectionAttempts = new Map();
const MAX_WS_CONNECTIONS_PER_MINUTE = 15;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  
  if (!wsConnectionAttempts.has(ip)) {
    wsConnectionAttempts.set(ip, []);
  }
  
  const attempts = wsConnectionAttempts.get(ip);
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= MAX_WS_CONNECTIONS_PER_MINUTE) {
    return false;
  }
  
  recentAttempts.push(now);
  wsConnectionAttempts.set(ip, recentAttempts);
  return true;
}

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  const windowMs = 60000;
  
  for (const [ip, attempts] of wsConnectionAttempts.entries()) {
    const recent = attempts.filter(time => now - time < windowMs);
    if (recent.length === 0) {
      wsConnectionAttempts.delete(ip);
    } else {
      wsConnectionAttempts.set(ip, recent);
    }
  }
}, 30000);

function broadcastToAll(payload) {
  const str = JSON.stringify(payload);
  let sentCount = 0;
  
  userSockets.forEach((sockets, userId) => {
    sockets.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(str);
          sentCount++;
        } catch (error) {
          console.error(`Error broadcasting to user ${userId}:`, error.message);
        }
      }
    });
  });
  
  return sentCount;
}

function broadcastToUsers(userIds, payload) {
  const str = JSON.stringify(payload);
  let sentCount = 0;
  
  userIds.forEach(userId => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(str);
            sentCount++;
          } catch (error) {
            console.error(`Error sending to user ${userId}:`, error.message);
          }
        }
      });
    }
  });
  
  return sentCount;
}

function registerSocket(userId, ws) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  
  const userSocketsSet = userSockets.get(userId);
  userSocketsSet.add(ws);

  ws.userId = userId;
  ws.connectedAt = Date.now();
  ws.isAlive = true;

  // Update online users
  const userData = onlineUsers.get(userId) || { connectionCount: 0, lastSeen: null };
  userData.connectionCount++;
  userData.lastSeen = new Date();
  onlineUsers.set(userId, userData);

  // Update connection stats
  connectionStats.totalConnections++;
  connectionStats.activeConnections++;
  connectionStats.maxConcurrent = Math.max(
    connectionStats.maxConcurrent, 
    connectionStats.activeConnections
  );

  console.log(`🔗 User ${userId} connected. Active: ${connectionStats.activeConnections}`);

  // Send initial presence data
  broadcastPresence(userId, true);
  
  // Send current online status of user's contacts
  sendInitialPresenceData(ws, userId);
}

function unregisterSocket(ws) {
  const userId = ws.userId;
  if (!userId) return;

  const userSocketsSet = userSockets.get(userId);
  if (!userSocketsSet) return;

  userSocketsSet.delete(ws);
  connectionStats.activeConnections--;

  console.log(`🔌 User ${userId} disconnected. Active: ${connectionStats.activeConnections}`);

  // Update online users
  const userData = onlineUsers.get(userId);
  if (userData) {
    userData.connectionCount--;
    userData.lastSeen = new Date();
    
    if (userData.connectionCount <= 0) {
      onlineUsers.delete(userId);
      broadcastPresence(userId, false);
    } else {
      onlineUsers.set(userId, userData);
    }
  }

  if (userSocketsSet.size === 0) {
    userSockets.delete(userId);
  }
}

async function sendInitialPresenceData(ws, userId) {
  try {
    // Get user's recent conversation partners
    const { rows } = await pool.query(
      `
      SELECT DISTINCT u.id, u.username, u.display_name
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id IN (
        SELECT conversation_id 
        FROM conversation_participants 
        WHERE user_id = $1
      ) AND u.id != $1
      LIMIT 50
      `,
      [userId]
    );

    const presenceData = rows.map(user => ({
      type: "PRESENCE_INITIAL",
      userId: user.id,
      isOnline: userSockets.has(user.id),
      lastSeen: onlineUsers.get(user.id)?.lastSeen
    }));

    if (presenceData.length > 0 && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: "BULK_PRESENCE",
        users: presenceData
      }));
    }
  } catch (error) {
    console.error("Error sending initial presence data:", error);
  }
}

function broadcastPresence(userId, isOnline) {
  const lastSeen = onlineUsers.get(userId)?.lastSeen;

  broadcastToAll({
    type: "PRESENCE",
    userId,
    isOnline,
    lastSeen,
    timestamp: new Date().toISOString()
  });
}

// Heartbeat system
function setupHeartbeat(ws) {
  ws.isAlive = true;
  
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.pingInterval = setInterval(() => {
    if (ws.isAlive === false) {
      console.log(`💔 Terminating dead connection for user ${ws.userId}`);
      return ws.terminate();
    }
    
    ws.isAlive = false;
    try {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(ws.pingInterval);
      }
    } catch (error) {
      console.log(`Ping failed for user ${ws.userId}:`, error.message);
      clearInterval(ws.pingInterval);
    }
  }, 30000); // 30 seconds
}

// EVENT EXPORTS FOR MESSAGE ROUTES (Enhanced)
app.set("broadcastNewMessage", (message, recipients) => {
  connectionStats.totalMessages++;
  return broadcastToUsers(recipients, { 
    type: "NEW_MESSAGE", 
    message,
    conversationId: message.conversation_id
  });
});

app.set("broadcastEditedMessage", (message, recipients) =>
  broadcastToUsers(recipients, { 
    type: "MESSAGE_EDITED", 
    message,
    conversationId: message.conversation_id
  })
);

app.set("broadcastDeletedMessage", (messageId, recipients) =>
  broadcastToUsers(recipients, { 
    type: "MESSAGE_DELETED", 
    messageId 
  })
);

app.set("broadcastSeenMessage", (conversationId, messageIds, toUserId) =>
  broadcastToUsers([toUserId], { 
    type: "MESSAGE_SEEN", 
    conversationId, 
    messageIds,
    seenAt: new Date().toISOString()
  })
);

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  const uid = req.session?.user?.id;
  if (!uid) {
    console.log("❌ WebSocket connection rejected: No user session");
    return ws.close(1008, "Authentication required");
  }

  registerSocket(uid, ws);
  setupHeartbeat(ws);

  ws.on("message", raw => {
    let data;
    try { 
      data = JSON.parse(raw.toString()); 
      connectionStats.totalMessages++;
    } catch (error) { 
      console.log("❌ Invalid WebSocket message format");
      return; 
    }

    // Reset heartbeat on any message
    ws.isAlive = true;

    switch (data.type) {
      case "TYPING":
        if (data.toUserId && data.conversationId) {
          broadcastToUsers([data.toUserId], {
            type: "TYPING",
            conversationId: data.conversationId,
            isTyping: data.isTyping,
            fromUserId: uid,
            timestamp: new Date().toISOString()
          });
        }
        break;
        
      case "PONG":
        ws.isAlive = true;
        break;
        
      case "PRESENCE_UPDATE":
        // Update user's last active time
        const userData = onlineUsers.get(uid);
        if (userData) {
          userData.lastSeen = new Date();
          onlineUsers.set(uid, userData);
        }
        break;
        
      default:
        console.log(`Unknown WebSocket message type: ${data.type}`);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`WebSocket closed for user ${uid}: ${code} - ${reason}`);
    clearInterval(ws.pingInterval);
    unregisterSocket(ws);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for user ${uid}:`, error);
    clearInterval(ws.pingInterval);
    unregisterSocket(ws);
  });
});

// Enhanced upgrade handler with rate limiting
server.on("upgrade", (req, socket, head) => {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  
  // Rate limiting check
  if (!checkRateLimit(clientIp)) {
    console.log(`🚫 WebSocket rate limit exceeded for IP: ${clientIp}`);
    socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
    return socket.destroy();
  }

  sessionMiddleware(req, {}, () => {
    if (!req.session?.user?.id) {
      console.log(`❌ Unauthenticated WebSocket attempt from ${clientIp}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit("connection", ws, req);
    });
  });
});

// WebSocket monitoring and cleanup
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      console.log(`Cleaning up dead WebSocket connection for user ${ws.userId}`);
      return ws.terminate();
    }
  });
}, 30000);

// Monitoring endpoints
app.get("/api/ws/stats", (req, res) => {
  // Basic protection - only allow in development or with admin auth
  if (process.env.NODE_ENV !== 'development' && !req.session?.user?.isAdmin) {
    return res.status(403).json({ error: "Access denied" });
  }

  const stats = {
    ...connectionStats,
    onlineUsers: onlineUsers.size,
    userSockets: userSockets.size,
    totalWebSocketClients: wss.clients.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.json(stats);
});

// Periodic stats logging
setInterval(() => {
  if (connectionStats.activeConnections > 0) {
    console.log(`📊 WS Stats - Active: ${connectionStats.activeConnections}, Online Users: ${onlineUsers.size}, Total Clients: ${wss.clients.size}, Total Messages: ${connectionStats.totalMessages}`);
  }
}, 60000); // Log every minute

// Graceful shutdown handler
function gracefulShutdown() {
  console.log('🛑 Starting graceful shutdown...');
  
  // Notify all clients
  const shutdownMsg = {
    type: "SERVER_SHUTDOWN",
    message: "Server is restarting, please reconnect in a moment",
    timestamp: new Date().toISOString(),
    reconnectDelay: 5000
  };
  
  broadcastToAll(shutdownMsg);

  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Close all WebSocket connections
  wss.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.close(1001, "Server restarting");
    }
    if (client.pingInterval) {
      clearInterval(client.pingInterval);
    }
  });

  // Close WebSocket server
  wss.close(() => {
    console.log('✅ WebSocket server closed');
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Process event handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
  console.error('🆘 Uncaught Exception:', error);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🆘 Unhandled Rejection at:', promise, 'reason:', reason);
});

//
// START SERVER
//
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Lovculator server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Frontend path: ${frontendPath}`);
});