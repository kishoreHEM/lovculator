/**
 * backend/ws.js — Lovculator Real-Time Layer (FINAL FIX)
 * * FIXED:
 * - Changed readyState check to use integer 1 (Fixes "Sent: 0" bug)
 * - Enhanced logging
 */

import { WebSocketServer } from "ws"; // ✅ Changed import style
import { createClient } from "redis";
import pool from "./db.js";

const WS_CHANNEL = "lovculator:ws:broadcast";
const WS_OPEN = 1; // ✅ Explicit constant for stability

function createNodeId() {
  return `node-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initWebSocketLayer({ app, server, sessionMiddleware }) {
  console.log("⚡ Initializing FIXED WebSocket layer...");

  const nodeId = createNodeId();

  // 1️⃣ CORE WSS SETUP
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
      zlibInflateOptions: { chunkSize: 10 * 1024 },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 10,
    },
  });

  const userSockets = new Map();
  const onlineUsers = new Map();
  const connectionDebug = new Map();
  
  const connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    maxConcurrent: 0,
    totalMessages: 0,
  };

  // 2️⃣ REDIS PUB/SUB
  let redisPub = null;
  let redisSub = null;
  let redisReady = false;

  async function setupRedis() {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.log("📡 Redis URL not set. Single-node mode.");
      return;
    }
    try {
      redisPub = createClient({ url });
      redisSub = createClient({ url });
      redisPub.on("error", (err) => console.error("❌ Redis PUB error:", err.message));
      redisSub.on("error", (err) => console.error("❌ Redis SUB error:", err.message));
      await redisPub.connect();
      await redisSub.connect();

      await redisSub.subscribe(WS_CHANNEL, (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (!msg || msg.origin === nodeId) return;
          if (msg.target === "ALL") localBroadcastToAll(msg.payload);
          else if (msg.target === "USERS" && Array.isArray(msg.userIds)) localBroadcastToUsers(msg.userIds, msg.payload);
        } catch (err) {
          console.error("❌ Redis WS parse error:", err.message);
        }
      });
      redisReady = true;
      console.log("✅ Redis Pub/Sub connected");
    } catch (err) {
      console.error("❌ Failed to init Redis:", err.message);
      redisReady = false;
    }
  }
  setupRedis().catch(console.error);

  // 3️⃣ RATE LIMITING
  const wsConnectionAttempts = new Map();
  function checkRateLimit(ip) {
    const now = Date.now();
    if (!wsConnectionAttempts.has(ip)) wsConnectionAttempts.set(ip, []);
    const attempts = wsConnectionAttempts.get(ip);
    const recent = attempts.filter((time) => now - time < 60000);
    if (recent.length >= 15) return false;
    recent.push(now);
    wsConnectionAttempts.set(ip, recent);
    return true;
  }

  // 4️⃣ LOCAL BROADCAST HELPERS
  function localBroadcastToAll(payload) {
    const str = JSON.stringify(payload);
    let sentCount = 0;
    userSockets.forEach((sockets) => {
      sockets.forEach((wsSocket) => {
        // ✅ FIX: Use WS_OPEN (1) instead of ws.OPEN
        if (wsSocket.readyState === WS_OPEN) {
          try { wsSocket.send(str); sentCount++; } catch (e) {}
        }
      });
    });
    return sentCount;
  }

  function localBroadcastToUsers(userIds, payload) {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    const str = JSON.stringify(payload);
    let sentCount = 0;

    userIdArray.forEach((userId) => {
      const sockets = userSockets.get(Number(userId));
      if (sockets) {
        sockets.forEach((wsSocket) => {
          // ✅ FIX: Use WS_OPEN (1)
          if (wsSocket.readyState === WS_OPEN) {
            try {
              wsSocket.send(str);
              sentCount++;
            } catch (error) {
              console.error(`Failed sending to ${userId}:`, error.message);
            }
          } else {
            console.log(`⚠️ Socket for user ${userId} is not OPEN (State: ${wsSocket.readyState})`);
          }
        });
      }
    });
    return sentCount;
  }

  // 5️⃣ CLUSTER BROADCAST
  function broadcastToUsers(userIds, payload) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    console.log(`🚀 [BROADCAST] Type: ${payload.type}, Targets:`, ids);
    
    const sent = localBroadcastToUsers(ids, payload);
    console.log(`📊 [BROADCAST RESULT] Sent: ${sent}, Targets: ${ids.length}`);

    if (redisReady && redisPub) {
      redisPub.publish(WS_CHANNEL, JSON.stringify({
        target: "USERS", origin: nodeId, userIds: ids, payload
      })).catch(() => {});
    }
    return sent;
  }

  function broadcastToAll(payload) {
    const sent = localBroadcastToAll(payload);
    if (redisReady && redisPub) {
      redisPub.publish(WS_CHANNEL, JSON.stringify({
        target: "ALL", origin: nodeId, payload
      })).catch(() => {});
    }
    return sent;
  }

  // 6️⃣ REGISTRATION
  function registerSocket(userId, wsSocket, req) {
    const numericId = Number(userId);
    if (!userSockets.has(numericId)) userSockets.set(numericId, new Set());
    
    userSockets.get(numericId).add(wsSocket);
    wsSocket.userId = numericId;
    wsSocket.isAlive = true;

    const userData = onlineUsers.get(numericId) || { connectionCount: 0, isOnline: false };
    userData.connectionCount++;
    userData.isOnline = true;
    userData.lastSeen = new Date();
    onlineUsers.set(numericId, userData);

    connectionStats.activeConnections++;
    console.log(`🔗 User ${userId} connected. Sockets: ${userSockets.get(numericId).size}`);

    broadcastPresence(numericId, true);
    // Send initial presence immediately
    if (wsSocket.readyState === WS_OPEN) {
       wsSocket.send(JSON.stringify({ type: "PRESENCE_INITIAL", users: [] }));
    }
  }

  function unregisterSocket(wsSocket) {
    const userId = wsSocket.userId;
    if (!userId) return;

    const userSocketsSet = userSockets.get(userId);
    if (userSocketsSet) {
      userSocketsSet.delete(wsSocket);
      if (userSocketsSet.size === 0) userSockets.delete(userId);
    }
    
    connectionStats.activeConnections--;

    const userData = onlineUsers.get(userId);
    if (userData) {
      userData.connectionCount = Math.max(0, userData.connectionCount - 1);
      userData.lastSeen = new Date();
      if (userData.connectionCount === 0) {
        userData.isOnline = false;
        broadcastPresence(userId, false);
      }
      onlineUsers.set(userId, userData);
    }
    console.log(`🔌 User ${userId} disconnected.`);
  }

  function broadcastPresence(userId, isOnline) {
    broadcastToAll({
      type: "PRESENCE",
      userId,
      isOnline,
      lastSeen: new Date().toISOString()
    });
  }

  // 7️⃣ HEARTBEAT
  function setupHeartbeat(wsSocket) {
    wsSocket.on("pong", () => { wsSocket.isAlive = true; });
    wsSocket.pingInterval = setInterval(() => {
      if (wsSocket.isAlive === false) return wsSocket.terminate();
      wsSocket.isAlive = false;
      if (wsSocket.readyState === WS_OPEN) wsSocket.ping();
    }, 30000);
  }

  // 8️⃣ EXPORTS
  app.set("broadcastNewMessage", (data, recipients) => {
    return broadcastToUsers(recipients, { type: "NEW_MESSAGE", message: data, conversationId: data.conversation_id });
  });
  
  app.set("broadcastSeenMessage", (conversationId, messageIds, toUserId) => {
    return broadcastToUsers([toUserId], { type: "MESSAGE_SEEN", conversationId, messageIds, seenAt: new Date().toISOString() });
  });

  app.set("broadcastTyping", (data, recipients) => {
    return broadcastToUsers(recipients, { ...data, type: "TYPING" });
  });

  // 9️⃣ WS HANDLER
  wss.on("connection", (wsSocket, req) => {
    const uid = req.session?.user?.id;
    if (!uid) return wsSocket.close(1008, "Auth required");

    registerSocket(uid, wsSocket, req);
    setupHeartbeat(wsSocket);

    wsSocket.on("message", (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      wsSocket.isAlive = true;

      if (data.type === "TYPING") {
        // Broadcast typing to other participants
        // Note: For simplicity, the frontend sends 'toUserId' or conversationId
        // Ideally we query DB here, but if we trust frontend for typing events:
         if (data.conversationId) {
             // We need to know WHO to send to. 
             // Option 1: Query DB (Safest)
             pool.query('SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2', [data.conversationId, uid])
               .then(res => {
                  const ids = res.rows.map(r => r.user_id);
                  if(ids.length) broadcastToUsers(ids, { type: "TYPING", conversationId: data.conversationId, isTyping: data.isTyping, fromUserId: uid });
               });
         }
      } else if (data.type === "PONG") {
        wsSocket.isAlive = true;
      } else if (data.type === "PRESENCE_UPDATE") {
        const u = onlineUsers.get(uid);
        if(u) { u.lastSeen = new Date(); onlineUsers.set(uid, u); }
        broadcastPresence(uid, true);
      }
    });

    wsSocket.on("close", () => {
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });
    
    wsSocket.on("error", () => {
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });
  });

  // 🔟 UPGRADE
  server.on("upgrade", (req, socket, head) => {
    if (!checkRateLimit(req.connection.remoteAddress)) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      return socket.destroy();
    }
    sessionMiddleware(req, {}, () => {
      if (!req.session?.user?.id) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    });
  });
}