/**
 * backend/ws.js — Lovculator Real-Time Layer (WebSocket + Optional Redis)
 * 
 * ENHANCED VERSION with:
 * - Fixed broadcast function signatures
 * - Enhanced connection tracking and debugging
 * - Better error handling and logging
 * - WebSocket stats exposure for debugging
 */

import * as ws from "ws";
import { createClient } from "redis"; // npm install redis
import pool from "./db.js";

const WebSocketServer = ws.WebSocketServer;

const WS_CHANNEL = "lovculator:ws:broadcast";

function createNodeId() {
  return `node-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initWebSocketLayer({ app, server, sessionMiddleware }) {
  console.log("⚡ Initializing ENHANCED WebSocket layer...");

  const nodeId = createNodeId();

  //
  // 1️⃣ CORE WSS SETUP
  //
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024,
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 10,
    },
  });

  // Maps & stats used by realtime layer
  const userSockets = new Map(); // userId -> Set<WebSocket>
  /**
   * onlineUsers map:
   *   key: userId
   *   value: { connectionCount: number, lastSeen: Date, isOnline: boolean }
   */
  const onlineUsers = new Map();
  const connectionDebug = new Map(); // Enhanced: userId -> { connectedAt, lastActivity, userAgent, ip }
  
  const connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    maxConcurrent: 0,
    totalMessages: 0,
  };

  //
  // 2️⃣ OPTIONAL REDIS PUB/SUB FOR CLUSTERING
  //
  let redisPub = null;
  let redisSub = null;
  let redisReady = false;

  async function setupRedis() {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.log("📡 Redis URL not set. WebSocket clustering disabled (single-node mode).");
      return;
    }

    try {
      redisPub = createClient({ url });
      redisSub = createClient({ url });

      redisPub.on("error", (err) =>
        console.error("❌ Redis PUB error (WS):", err.message)
      );
      redisSub.on("error", (err) =>
        console.error("❌ Redis SUB error (WS):", err.message)
      );

      await redisPub.connect();
      await redisSub.connect();

      await redisSub.subscribe(WS_CHANNEL, (raw) => {
        try {
          const msg = JSON.parse(raw);
          if (!msg || msg.origin === nodeId) return;

          if (msg.target === "ALL") {
            localBroadcastToAll(msg.payload);
          } else if (msg.target === "USERS" && Array.isArray(msg.userIds)) {
            localBroadcastToUsers(msg.userIds, msg.payload);
          }
        } catch (err) {
          console.error("❌ Redis WS message parse error:", err.message);
        }
      });

      redisReady = true;
      console.log("✅ Redis Pub/Sub connected for WebSocket scaling");
    } catch (err) {
      console.error("❌ Failed to init Redis for WebSocket:", err.message);
      redisReady = false;
    }
  }

  // Fire & forget (don't block startup if Redis fails)
  setupRedis();

  //
  // 3️⃣ RATE LIMITING FOR WS CONNECTIONS
  //
  const wsConnectionAttempts = new Map();
  const MAX_WS_CONNECTIONS_PER_MINUTE = 15;

  function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 60000;

    if (!wsConnectionAttempts.has(ip)) {
      wsConnectionAttempts.set(ip, []);
    }

    const attempts = wsConnectionAttempts.get(ip);
    const recent = attempts.filter((time) => now - time < windowMs);

    if (recent.length >= MAX_WS_CONNECTIONS_PER_MINUTE) {
      return false;
    }

    recent.push(now);
    wsConnectionAttempts.set(ip, recent);
    return true;
  }

  // Periodic cleanup of old rate-limit entries
  setInterval(() => {
    const now = Date.now();
    const windowMs = 60000;

    for (const [ip, attempts] of wsConnectionAttempts.entries()) {
      const recent = attempts.filter((time) => now - time < windowMs);
      if (recent.length === 0) {
        wsConnectionAttempts.delete(ip);
      } else {
        wsConnectionAttempts.set(ip, recent);
      }
    }
  }, 30000);

  //
  // 4️⃣ LOCAL BROADCAST HELPERS (DO NOT USE REDIS HERE)
  //
  function localBroadcastToAll(payload) {
    const str = JSON.stringify(payload);
    let sentCount = 0;
    let errorCount = 0;

    userSockets.forEach((sockets, userId) => {
      sockets.forEach((wsSocket) => {
        if (wsSocket.readyState === ws.OPEN) {
          try {
            wsSocket.send(str);
            sentCount++;
          } catch (error) {
            errorCount++;
            console.error(`Error broadcasting to user ${userId}:`, error.message);
          }
        }
      });
    });

    return sentCount;
  }

  function localBroadcastToUsers(userIds, payload) {
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    const str = JSON.stringify(payload);
    let sentCount = 0;
    let errorCount = 0;

    console.log(`📡 LOCAL BROADCAST: Type ${payload.type} to ${userIdArray.length} users:`, userIdArray);

    userIdArray.forEach((userId) => {
      const sockets = userSockets.get(Number(userId));
      if (sockets) {
        console.log(`✅ User ${userId} has ${sockets.size} active socket(s)`);
        sockets.forEach((wsSocket) => {
          if (wsSocket.readyState === ws.OPEN) {
            try {
              wsSocket.send(str);
              sentCount++;
              console.log(`✅ Sent to user ${userId} (socket ready)`);
            } catch (error) {
              errorCount++;
              console.error(`❌ Error sending to user ${userId}:`, error.message);
            }
          } else {
            console.log(`⚠️ User ${userId} socket not OPEN (state: ${wsSocket.readyState})`);
          }
        });
      } else {
        console.log(`❌ User ${userId} not connected (no sockets in userSockets map)`);
      }
    });

    console.log(`📊 LOCAL BROADCAST COMPLETE: ${sentCount} sent, ${errorCount} errors, ${userIdArray.length} targets`);
    
    // Log currently connected users for debugging
    if (sentCount === 0 && userIdArray.length > 0) {
      console.log(`🔍 Currently connected users:`, Array.from(userSockets.keys()));
    }

    return sentCount;
  }

  //
  // 5️⃣ CLUSTER-AWARE BROADCAST HELPERS
  //
  function broadcastToAll(payload) {
    // Always send locally
    const sent = localBroadcastToAll(payload);

    // If Redis available, replicate to other instances
    if (redisReady && redisPub) {
      const envelope = {
        target: "ALL",
        origin: nodeId,
        payload,
      };
      redisPub
        .publish(WS_CHANNEL, JSON.stringify(envelope))
        .catch((err) =>
          console.error("❌ Redis publish ALL error:", err.message)
        );
    }

    return sent;
  }

  function broadcastToUsers(userIds, payload) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  
  console.log(`🎯 BROADCAST DEBUG: Type ${payload.type} to ${ids.length} users:`, {
    userIds: ids,
    messageId: payload.message?.id,
    conversationId: payload.conversationId
  });

  // Local delivery
  const sent = localBroadcastToUsers(ids, payload);

  // Cluster delivery via Redis
  if (redisReady && redisPub) {
    const envelope = {
      target: "USERS",
      origin: nodeId,
      userIds: ids,
      payload,
    };
    redisPub
      .publish(WS_CHANNEL, JSON.stringify(envelope))
      .catch((err) =>
        console.error("❌ Redis publish USERS error:", err.message)
      );
  }

  return sent;
}

  //
  // 6️⃣ PRESENCE & SOCKET REGISTRATION (ENHANCED)
  //
  function registerSocket(userId, wsSocket, req) {
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }

    const userSocketsSet = userSockets.get(userId);
    userSocketsSet.add(wsSocket);

    wsSocket.userId = userId;
    wsSocket.connectedAt = Date.now();
    wsSocket.isAlive = true;
    wsSocket.userAgent = req.headers['user-agent'];

    // Enhanced debug tracking
    connectionDebug.set(userId, {
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      userAgent: wsSocket.userAgent,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    // Online map
    const userData =
      onlineUsers.get(userId) || {
        connectionCount: 0,
        lastSeen: null,
        isOnline: false,
      };
    userData.connectionCount++;
    userData.lastSeen = new Date();
    userData.isOnline = true;
    onlineUsers.set(userId, userData);

    // Connection stats
    connectionStats.totalConnections++;
    connectionStats.activeConnections++;
    connectionStats.maxConcurrent = Math.max(
      connectionStats.maxConcurrent,
      connectionStats.activeConnections
    );

    console.log(
      `🔗 User ${userId} connected. Active: ${connectionStats.activeConnections}, Total Sockets: ${userSocketsSet.size}`
    );

    // Notify others this user is online
    broadcastPresence(userId, true);

    // Send initial presence data (who is online among their contacts)
    sendInitialPresenceData(wsSocket, userId);
  }

  function unregisterSocket(wsSocket) {
    const userId = wsSocket.userId;
    if (!userId) return;

    const userSocketsSet = userSockets.get(userId);
    if (!userSocketsSet) return;

    userSocketsSet.delete(wsSocket);
    connectionStats.activeConnections--;

    console.log(
      `🔌 User ${userId} disconnected. Active: ${connectionStats.activeConnections}`
    );

    // Clean up debug info if no more sockets
    if (userSocketsSet.size === 0) {
      userSockets.delete(userId);
      connectionDebug.delete(userId);
    }

    const userData =
      onlineUsers.get(userId) || {
        connectionCount: 0,
        lastSeen: null,
        isOnline: false,
      };
    userData.connectionCount = Math.max(0, userData.connectionCount - 1);
    userData.lastSeen = new Date();

    if (userData.connectionCount <= 0) {
      userData.isOnline = false;
    }
    onlineUsers.set(userId, userData);

    // Broadcast offline (but lastSeen preserved in map)
    if (!userData.isOnline) {
      broadcastPresence(userId, false);
    }
  }

  async function sendInitialPresenceData(wsSocket, userId) {
    try {
      // Get people from user's conversations
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

      const presenceData = rows.map((user) => {
        const data = onlineUsers.get(user.id);
        return {
          userId: user.id,
          isOnline: !!data?.isOnline,
          lastSeen: data?.lastSeen || null,
        };
      });

      if (presenceData.length > 0 && wsSocket.readyState === ws.OPEN) {
        // Send both event types for compatibility
        wsSocket.send(
          JSON.stringify({
            type: "BULK_PRESENCE",
            users: presenceData,
          })
        );
        
        // Also send as PRESENCE_INITIAL for broader compatibility
        wsSocket.send(
          JSON.stringify({
            type: "PRESENCE_INITIAL", 
            users: presenceData,
          })
        );
        
        console.log(`📊 Sent initial presence data to user ${userId}: ${presenceData.length} contacts`);
      }
    } catch (error) {
      console.error("Error sending initial presence data:", error);
    }
  }

  function broadcastPresence(userId, isOnline) {
    const data = onlineUsers.get(userId);
    const lastSeen = data?.lastSeen || new Date();

    broadcastToAll({
      type: "PRESENCE",
      userId,
      isOnline,
      lastSeen,
      timestamp: new Date().toISOString(),
    });
  }

  //
  // 7️⃣ HEARTBEAT / PING-PONG
  //
  function setupHeartbeat(wsSocket) {
    wsSocket.isAlive = true;

    wsSocket.on("pong", () => {
      wsSocket.isAlive = true;
    });

    wsSocket.pingInterval = setInterval(() => {
      if (wsSocket.isAlive === false) {
        console.log(`💔 Terminating dead connection for user ${wsSocket.userId}`);
        return wsSocket.terminate();
      }

      wsSocket.isAlive = false;
      try {
        if (wsSocket.readyState === ws.OPEN) {
          wsSocket.ping();
        } else {
          clearInterval(wsSocket.pingInterval);
        }
      } catch (error) {
        console.log(
          `Ping failed for user ${wsSocket.userId}:`,
          error.message
        );
        clearInterval(wsSocket.pingInterval);
      }
    }, 30000);
  }

  //
  // 8️⃣ REAL-TIME EVENT EXPORTS (FIXED SIGNATURES)
  //
  
  // 🟢 FIXED: Correct function signatures for routes compatibility
  app.set("broadcastNewMessage", (data, recipients) => {
    connectionStats.totalMessages++;
    console.log(`🎯 WebSocket: Broadcasting NEW_MESSAGE to ${recipients.length} recipients`, {
      messageId: data.id,
      conversationId: data.conversation_id,
      recipients: recipients
    });
    return broadcastToUsers(recipients, {
      type: "NEW_MESSAGE",
      message: data, // Keep as 'message' for frontend compatibility
      conversationId: data.conversation_id,
    });
  });

  app.set("broadcastEditedMessage", (data, recipients) => {
    console.log(`🎯 WebSocket: Broadcasting MESSAGE_EDITED to ${recipients.length} recipients`);
    return broadcastToUsers(recipients, {
      type: "MESSAGE_EDITED",
      message: data,
      conversationId: data.conversation_id,
    });
  });

  app.set("broadcastDeletedMessage", (messageId, recipients) => {
    console.log(`🎯 WebSocket: Broadcasting MESSAGE_DELETED to ${recipients.length} recipients`);
    return broadcastToUsers(recipients, {
      type: "MESSAGE_DELETED",
      messageId: messageId,
    });
  });

  app.set("broadcastSeenMessage", (conversationId, messageIds, toUserId) => {
    console.log(`🎯 WebSocket: Broadcasting MESSAGE_SEEN to user ${toUserId}`);
    return broadcastToUsers([toUserId], {
      type: "MESSAGE_SEEN",
      conversationId,
      messageIds,
      seenAt: new Date().toISOString(),
    });
  });

  /**
   * 🔔 Notifications broadcast
   * Used by: routes/notifications.js
   * Signature expected there:
   *   const broadcast = req.app.get("broadcastNotification");
   *   if (broadcast) broadcast([targetUserId], { message: notification.message });
   */
  app.set("broadcastNotification", (recipients, payload) => {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    console.log(
      "🔔 Broadcasting notification to:",
      recipientArray,
      "Payload type:",
      payload?.type
    );

    return broadcastToUsers(recipientArray, {
      type: "NEW_NOTIFICATION",
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * ❤️ Likes broadcast
   * In posts.js:
   *   const broadcast = req.app.get("broadcastLike");
   *   if (broadcast) broadcast({ postId, like_count: newCount });
   */
  app.set("broadcastLike", ({ postId, like_count }) =>
    broadcastToAll({
      type: "LIKE_UPDATE",
      data: { postId, like_count },
    })
  );

  /**
   * 💬 Comments broadcast
   * In comments.js:
   *   const broadcast = req.app.get("broadcastComment");
   *   if (broadcast) broadcast(commentData);
   */
  app.set("broadcastComment", (commentData) =>
    broadcastToAll({
      type: "NEW_COMMENT",
      data: commentData,
    })
  );

  //
  // 9️⃣ WEBSOCKET CONNECTION HANDLER (ENHANCED)
  //
  wss.on("connection", (wsSocket, req) => {
    const uid = req.session?.user?.id;
    if (!uid) {
      console.log("❌ WebSocket connection rejected: No user session");
      return wsSocket.close(1008, "Authentication required");
    }

    registerSocket(uid, wsSocket, req);
    setupHeartbeat(wsSocket);

    // In the ws.js message handler (around line 300), update the switch statement:

wsSocket.on("message", (raw) => {
  let data;
  try {
    data = JSON.parse(raw.toString());
    connectionStats.totalMessages++;
    
    // Update last activity
    if (connectionDebug.has(uid)) {
      const debugInfo = connectionDebug.get(uid);
      debugInfo.lastActivity = new Date().toISOString();
      connectionDebug.set(uid, debugInfo);
    }
  } catch (error) {
    console.log("❌ Invalid WebSocket message format from user", uid, "Raw:", raw.toString());
    return;
  }

  // Any message = still alive
  wsSocket.isAlive = true;

  console.log(`📨 WebSocket message from user ${uid}:`, data);

  switch (data.type) {
    case "TYPING":
      if (data.toUserId && data.conversationId) {
        console.log(`⌨️ Typing indicator from ${uid} to ${data.toUserId}`);
        broadcastToUsers([data.toUserId], {
          type: "TYPING",
          conversationId: data.conversationId,
          isTyping: data.isTyping,
          fromUserId: uid,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      } else {
        console.log(`⚠️ Invalid TYPING message format from ${uid}:`, data);
      }
      break;

    case "PONG":
      wsSocket.isAlive = true;
      console.log(`❤️ PONG received from user ${uid}`);
      break;

    case "PRESENCE_UPDATE": {
      console.log(`👤 Presence update from user ${uid}`);
      const userData = onlineUsers.get(uid) || {
        connectionCount: 0,
        lastSeen: null,
        isOnline: false,
      };
      userData.lastSeen = new Date();
      onlineUsers.set(uid, userData);
      
      // Broadcast presence to all users in conversations with this user
      broadcastPresence(uid, true);
      break;
    }

    case "DEBUG_REQUEST":
      console.log(`🔍 Debug request from user ${uid}`);
      if (wsSocket.readyState === ws.OPEN) {
        wsSocket.send(JSON.stringify({
          type: "DEBUG_RESPONSE",
          userId: uid,
          connectionCount: userSockets.get(uid)?.size || 0,
          online: onlineUsers.get(uid)?.isOnline || false,
          onlineUsers: Array.from(onlineUsers.keys()),
          totalConnections: connectionStats.activeConnections,
          timestamp: new Date().toISOString()
        }));
      }
      break;

    case "MESSAGE_SEEN":
      console.log(`👀 Message seen from user ${uid}:`, data);
      if (data.conversationId && data.messageIds && data.toUserId) {
        broadcastToUsers([data.toUserId], {
          type: "MESSAGE_SEEN",
          conversationId: data.conversationId,
          messageIds: data.messageIds,
          seenAt: data.timestamp || new Date().toISOString(),
          fromUserId: uid
        });
      }
      break;

    default:
      console.log(`❓ Unknown WebSocket message type from user ${uid}:`, data.type);
  }
});

    wsSocket.on("close", (code, reason) => {
      console.log(`WebSocket closed for user ${uid}: ${code} - ${reason}`);
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });

    wsSocket.on("error", (error) => {
      console.error(`WebSocket error for user ${uid}:`, error);
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });
  });

  //
  // 🔟 HTTP → WS UPGRADE HANDLER (Fixed for rolling sessions)
  //
  server.on("upgrade", (req, socket, head) => {
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (!checkRateLimit(clientIp)) {
      console.log(`🚫 WebSocket rate limit exceeded for IP: ${clientIp}`);
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      return socket.destroy();
    }

    // ✅ FIX: Create a mock Response object so 'rolling: true' doesn't crash
    const responseWrapper = {
      setHeader: () => {},
      getHeader: () => {},
      on: () => {},
      writeHead: () => {},
      end: () => {}
    };

    sessionMiddleware(req, responseWrapper, () => {
      if (!req.session?.user?.id) {
        console.log(`❌ Unauthenticated WebSocket attempt from ${clientIp}`);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        return socket.destroy();
      }

      wss.handleUpgrade(req, socket, head, (wsSocket) => {
        wss.emit("connection", wsSocket, req);
      });
    });
  });

  //
  // 1️⃣1️⃣ PERIODIC WS CLEANUP & MONITORING (ENHANCED)
  //
  setInterval(() => {
    wss.clients.forEach((wsSocket) => {
      if (wsSocket.isAlive === false) {
        console.log(
          `Cleaning up dead WebSocket connection for user ${wsSocket.userId}`
        );
        return wsSocket.terminate();
      }
    });
  }, 30000);

  // Enhanced WebSocket stats function
  function getWebSocketStats() {
    return {
      activeConnections: connectionStats.activeConnections,
      totalConnections: connectionStats.totalConnections,
      maxConcurrent: connectionStats.maxConcurrent,
      totalMessages: connectionStats.totalMessages,
      onlineUsers: Array.from(onlineUsers.entries()).map(([userId, data]) => ({
        userId,
        isOnline: data.isOnline,
        connectionCount: data.connectionCount,
        lastSeen: data.lastSeen
      })),
      userSockets: Array.from(userSockets.entries()).map(([userId, sockets]) => ({
        userId,
        socketCount: sockets.size,
        connectionInfo: connectionDebug.get(userId) || null
      })),
      totalWebSocketClients: wss.clients.size,
      redisEnabled: redisReady,
      nodeId: nodeId,
      timestamp: new Date().toISOString()
    };
  }

  // Expose WebSocket stats to the app
  app.set("getWebSocketStats", getWebSocketStats);

  // Monitoring endpoint for WebSocket stats
  app.get("/api/ws/stats", (req, res) => {
    if (process.env.NODE_ENV !== "development" && !req.session?.user?.isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stats = getWebSocketStats();
    res.json(stats);
  });

  // Enhanced WebSocket health check
  app.get("/api/ws/health", (req, res) => {
    res.json({
      status: "healthy",
      nodeId: nodeId,
      activeConnections: connectionStats.activeConnections,
      onlineUsers: onlineUsers.size,
      redis: redisReady ? "connected" : "disabled",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Log comprehensive WS stats every minute
  setInterval(() => {
    if (connectionStats.activeConnections > 0) {
      console.log(
        `📊 ENHANCED WS Stats - Active: ${connectionStats.activeConnections}, ` +
        `Online Users: ${onlineUsers.size}, ` +
        `Total Clients: ${wss.clients.size}, ` +
        `Total Messages: ${connectionStats.totalMessages}, ` +
        `Redis: ${redisReady ? '✅' : '❌'}`
      );
      
      // Log connected users for debugging
      if (userSockets.size > 0) {
        console.log(`👥 Connected users:`, Array.from(userSockets.keys()));
      }
    }
  }, 60000);

  //
  // 1️⃣2️⃣ GRACEFUL SHUTDOWN HANDLING
  //
  function gracefulShutdown() {
    console.log("🛑 Starting graceful shutdown...");

    // Tell clients we're restarting
    const shutdownMsg = {
      type: "SERVER_SHUTDOWN",
      message: "Server is restarting, please reconnect in a moment",
      timestamp: new Date().toISOString(),
      reconnectDelay: 5000,
    };

    broadcastToAll(shutdownMsg);

    // Stop HTTP (server is captured from closure)
    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    // Close WS connections
    wss.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.close(1001, "Server restarting");
      }
      if (client.pingInterval) {
        clearInterval(client.pingInterval);
      }
    });

    // Close WS server
    wss.close(() => {
      console.log("✅ WebSocket server closed");
    });

    // Close Redis
    if (redisReady) {
      if (redisSub) redisSub.quit().catch(() => {});
      if (redisPub) redisPub.quit().catch(() => {});
    }

    // Force quit after timeout
    setTimeout(() => {
      console.log("⚠️ Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  process.on("uncaughtException", (error) => {
    console.error("🆘 Uncaught Exception:", error);
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("🆘 Unhandled Rejection at:", promise, "reason:", reason);
  });

  console.log("✅ ENHANCED WebSocket layer initialized (node:", nodeId, ")");
  console.log("🔧 Features: Fixed signatures, Enhanced debugging, Better error handling");
}