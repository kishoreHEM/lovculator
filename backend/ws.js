/**
 * backend/ws.js — Lovculator Real-Time Layer (WebSocket + Optional Redis)
 * 
 * COMPLETELY UPDATED VERSION with:
 * - Fixed broadcast function signatures
 * - Enhanced debugging and logging
 * - Fixed typing indicator handling
 * - Fixed message broadcasting
 * - Better error handling and reconnection logic
 */

import * as ws from "ws";
import { createClient } from "redis";
import pool from "./db.js";

const WebSocketServer = ws.WebSocketServer;

const WS_CHANNEL = "lovculator:ws:broadcast";

function createNodeId() {
  return `node-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initWebSocketLayer({ app, server, sessionMiddleware }) {
  console.log("⚡ Initializing UPDATED WebSocket layer...");

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

  // Maps & stats
  const userSockets = new Map(); // userId -> Set<WebSocket>
  const onlineUsers = new Map();
  const connectionDebug = new Map();
  
  const connectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    maxConcurrent: 0,
    totalMessages: 0,
  };

  //
  // 2️⃣ REDIS PUB/SUB (Optional)
  //
  let redisPub = null;
  let redisSub = null;
  let redisReady = false;

  async function setupRedis() {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.log("📡 Redis URL not set. WebSocket clustering disabled.");
      return;
    }

    try {
      redisPub = createClient({ url });
      redisSub = createClient({ url });

      redisPub.on("error", (err) =>
        console.error("❌ Redis PUB error:", err.message)
      );
      redisSub.on("error", (err) =>
        console.error("❌ Redis SUB error:", err.message)
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
      console.error("❌ Failed to init Redis:", err.message);
      redisReady = false;
    }
  }

  setupRedis().catch(console.error);

  //
  // 3️⃣ RATE LIMITING
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
  // 4️⃣ LOCAL BROADCAST HELPERS
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
    let offlineCount = 0;

    userIdArray.forEach((userId) => {
      const sockets = userSockets.get(Number(userId));
      if (sockets) {
        sockets.forEach((wsSocket) => {
          if (wsSocket.readyState === ws.OPEN) {
            try {
              wsSocket.send(str);
              sentCount++;
            } catch (error) {
              errorCount++;
              console.error(`Failed sending to ${userId}:`, error.message);
            }
          } else {
            offlineCount++;
          }
        });
      } else {
        console.log(`📭 User ${userId} not connected (no sockets)`);
      }
    });

    return sentCount;
  }

  //
  // 5️⃣ CLUSTER-AWARE BROADCAST HELPERS
  //
  function broadcastToAll(payload) {
    const sent = localBroadcastToAll(payload);

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
    
    // ✅ ENHANCED LOGGING
    console.log(`🚀 [BROADCAST] Type: ${payload.type}, Targets:`, ids);
    if (payload.message) {
      console.log(`   Message ID: ${payload.message.id}, Sender: ${payload.message.sender_id}`);
    }

    const sent = localBroadcastToUsers(ids, payload);
    
    console.log(`📊 [BROADCAST RESULT] Sent: ${sent}, Targets: ${ids.length}`);

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
  // 6️⃣ PRESENCE & SOCKET REGISTRATION
  //
  function registerSocket(userId, wsSocket, req) {
    const numericId = Number(userId);

    if (!userSockets.has(numericId)) {
      userSockets.set(numericId, new Set());
    }

    const userSocketsSet = userSockets.get(numericId);
    userSocketsSet.add(wsSocket);

    wsSocket.userId = numericId;
    wsSocket.connectedAt = Date.now();
    wsSocket.isAlive = true;
    wsSocket.userAgent = req.headers['user-agent'];

    connectionDebug.set(numericId, {
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      userAgent: wsSocket.userAgent,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    const userData = onlineUsers.get(numericId) || {
      connectionCount: 0,
      lastSeen: null,
      isOnline: false,
    };
    userData.connectionCount++;
    userData.lastSeen = new Date();
    userData.isOnline = true;
    onlineUsers.set(numericId, userData);

    connectionStats.totalConnections++;
    connectionStats.activeConnections++;
    connectionStats.maxConcurrent = Math.max(
      connectionStats.maxConcurrent,
      connectionStats.activeConnections
    );

    console.log(
      `🔗 User ${userId} connected. Active: ${connectionStats.activeConnections}, Sockets: ${userSocketsSet.size}`
    );

    broadcastPresence(numericId, true);
    sendInitialPresenceData(wsSocket, numericId);
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

    if (!userData.isOnline) {
      broadcastPresence(userId, false);
    }
  }

  async function sendInitialPresenceData(wsSocket, userId) {
    try {
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
        wsSocket.send(
          JSON.stringify({
            type: "BULK_PRESENCE",
            users: presenceData,
          })
        );
        
        wsSocket.send(
          JSON.stringify({
            type: "PRESENCE_INITIAL", 
            users: presenceData,
          })
        );
        
        console.log(`📊 Sent initial presence to user ${userId}: ${presenceData.length} contacts`);
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
  
  // ✅ FIXED: Correct broadcast functions
  app.set("broadcastNewMessage", (data, recipients) => {
    connectionStats.totalMessages++;
    
    // ✅ CRITICAL: Enhanced logging
    console.log(`🎯 [NEW_MESSAGE] Broadcasting message ID ${data.id} to recipients:`, recipients);
    console.log(`   Conversation: ${data.conversation_id}, Sender: ${data.sender_id}`);
    console.log(`   Message text: ${data.message_text?.substring(0, 50)}...`);
    
    return broadcastToUsers(recipients, {
      type: "NEW_MESSAGE",
      message: data,
      conversationId: data.conversation_id,
    });
  });

  app.set("broadcastEditedMessage", (data, recipients) => {
    console.log(`🎯 [MESSAGE_EDITED] Broadcasting to:`, recipients);
    return broadcastToUsers(recipients, {
      type: "MESSAGE_EDITED",
      message: data,
      conversationId: data.conversation_id,
    });
  });

  app.set("broadcastDeletedMessage", (messageId, recipients) => {
    console.log(`🎯 [MESSAGE_DELETED] Broadcasting to:`, recipients);
    return broadcastToUsers(recipients, {
      type: "MESSAGE_DELETED",
      messageId: messageId,
    });
  });

  app.set("broadcastSeenMessage", (conversationId, messageIds, toUserId) => {
    console.log(`🎯 [MESSAGE_SEEN] Broadcasting to user ${toUserId}`);
    return broadcastToUsers([toUserId], {
      type: "MESSAGE_SEEN",
      conversationId,
      messageIds,
      seenAt: new Date().toISOString(),
    });
  });

  app.set("broadcastNotification", (recipients, payload) => {
    const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
    console.log(
      "🔔 [NOTIFICATION] Broadcasting to:",
      recipientArray,
      "Type:",
      payload?.type
    );

    return broadcastToUsers(recipientArray, {
      type: "NEW_NOTIFICATION",
      ...payload,
      timestamp: new Date().toISOString(),
    });
  });

  app.set("broadcastLike", ({ postId, like_count }) => {
    console.log(`❤️ [LIKE_UPDATE] Broadcasting for post ${postId}`);
    return broadcastToAll({
      type: "LIKE_UPDATE",
      data: { postId, like_count },
    });
  });

  app.set("broadcastComment", (commentData) => {
    console.log(`💬 [NEW_COMMENT] Broadcasting for post ${commentData.post_id}`);
    return broadcastToAll({
      type: "NEW_COMMENT",
      data: commentData,
    });
  });

  //
  // 9️⃣ WEBSOCKET MESSAGE HANDLER (FIXED TYPING)
  //
  wss.on("connection", (wsSocket, req) => {
    const uid = req.session?.user?.id;
    if (!uid) {
      console.log("❌ WebSocket connection rejected: No user session");
      return wsSocket.close(1008, "Authentication required");
    }

    registerSocket(uid, wsSocket, req);
    setupHeartbeat(wsSocket);

    wsSocket.on("message", (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
        connectionStats.totalMessages++;
        
        if (connectionDebug.has(uid)) {
          const debugInfo = connectionDebug.get(uid);
          debugInfo.lastActivity = new Date().toISOString();
          connectionDebug.set(uid, debugInfo);
        }
      } catch (error) {
        console.log("❌ Invalid WebSocket message from user", uid, "Raw:", raw.toString());
        return;
      }

      wsSocket.isAlive = true;

      console.log(`📨 WebSocket message from user ${uid}:`, data.type);

      switch (data.type) {
        case "TYPING":
          // ✅ FIXED: Handle both old and new format
          const conversationId = data.conversationId;
          const isTyping = data.isTyping;
          
          if (conversationId !== undefined && isTyping !== undefined) {
            console.log(`⌨️ [TYPING] User ${uid} ${isTyping ? "started" : "stopped"} typing in conversation ${conversationId}`);
            
            // Get conversation participants to broadcast to
            pool.query(
              `SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id != $2`,
              [conversationId, uid]
            ).then(({ rows }) => {
              const participants = rows.map(r => r.user_id);
              if (participants.length > 0) {
                broadcastToUsers(participants, {
                  type: "TYPING",
                  conversationId,
                  isTyping,
                  fromUserId: uid,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
                console.log(`📤 [TYPING] Broadcasted to participants:`, participants);
              }
            }).catch(err => {
              console.error("Error getting conversation participants:", err);
            });
          } else {
            console.log(`⚠️ [TYPING] Invalid format from ${uid}:`, data);
          }
          break;

        case "PONG":
          wsSocket.isAlive = true;
          console.log(`❤️ PONG received from user ${uid}`);
          break;

        case "PRESENCE_UPDATE": {
          console.log(`👤 [PRESENCE] Update from user ${uid}`);
          const userData = onlineUsers.get(uid) || {
            connectionCount: 0,
            lastSeen: null,
            isOnline: false,
          };
          userData.lastSeen = new Date();
          onlineUsers.set(uid, userData);
          broadcastPresence(uid, true);
          break;
        }

        case "DEBUG_REQUEST":
          console.log(`🔍 [DEBUG] Request from user ${uid}:`, data.message || 'No message');
          if (wsSocket.readyState === ws.OPEN) {
            // Test message to confirm WebSocket is working
            wsSocket.send(JSON.stringify({
              type: "DEBUG_RESPONSE",
              userId: uid,
              serverTime: new Date().toISOString(),
              connectionCount: userSockets.get(uid)?.size || 0,
              online: onlineUsers.get(uid)?.isOnline || false,
              totalConnections: connectionStats.activeConnections,
              message: "WebSocket server is working!"
            }));
            
            // Also send a test NEW_MESSAGE to verify message delivery
            if (data.testMessage === true) {
              setTimeout(() => {
                wsSocket.send(JSON.stringify({
                  type: "NEW_MESSAGE",
                  conversationId: "test",
                  message: {
                    id: 999999,
                    conversation_id: "test",
                    sender_id: "server",
                    sender_username: "System",
                    message_text: "Test message from WebSocket server",
                    created_at: new Date().toISOString(),
                    is_read: false
                  }
                }));
                console.log(`✅ Sent test NEW_MESSAGE to user ${uid}`);
              }, 100);
            }
          }
          break;

        case "MESSAGE_SEEN":
          console.log(`👀 [SEEN] Message seen from user ${uid}:`, data);
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
          console.log(`❓ [UNKNOWN] Message type from user ${uid}:`, data.type, data);
      }
    });

    wsSocket.on("close", (code, reason) => {
      console.log(`🔌 WebSocket closed for user ${uid}: ${code} - ${reason}`);
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });

    wsSocket.on("error", (error) => {
      console.error(`❌ WebSocket error for user ${uid}:`, error);
      clearInterval(wsSocket.pingInterval);
      unregisterSocket(wsSocket);
    });
  });

  //
  // 🔟 HTTP → WS UPGRADE HANDLER
  //
  server.on("upgrade", (req, socket, head) => {
    const clientIp =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    if (!checkRateLimit(clientIp)) {
      console.log(`🚫 WebSocket rate limit exceeded for IP: ${clientIp}`);
      socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
      return socket.destroy();
    }

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

      console.log(`🔗 WebSocket upgrade for user ${req.session.user.id} from ${clientIp}`);
      
      wss.handleUpgrade(req, socket, head, (wsSocket) => {
        wss.emit("connection", wsSocket, req);
      });
    });
  });

  //
  // 1️⃣1️⃣ PERIODIC CLEANUP & MONITORING
  //
  setInterval(() => {
    wss.clients.forEach((wsSocket) => {
      if (wsSocket.isAlive === false) {
        console.log(
          `🧹 Cleaning up dead WebSocket for user ${wsSocket.userId}`
        );
        wsSocket.terminate();
      }
    });
  }, 30000);

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

  app.set("getWebSocketStats", getWebSocketStats);

  app.get("/api/ws/stats", (req, res) => {
    if (process.env.NODE_ENV !== "development" && !req.session?.user?.isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stats = getWebSocketStats();
    res.json(stats);
  });

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

  // Log stats every minute
  setInterval(() => {
    if (connectionStats.activeConnections > 0) {
      console.log(
        `📊 WS Stats - Active: ${connectionStats.activeConnections}, ` +
        `Online Users: ${onlineUsers.size}, ` +
        `Total Clients: ${wss.clients.size}, ` +
        `Total Messages: ${connectionStats.totalMessages}, ` +
        `Redis: ${redisReady ? '✅' : '❌'}`
      );
      
      // Log connected users
      if (userSockets.size > 0) {
        console.log(`👥 Connected users:`, Array.from(userSockets.keys()));
      }
    }
  }, 60000);

  //
  // 1️⃣2️⃣ GRACEFUL SHUTDOWN
  //
  function gracefulShutdown() {
    console.log("🛑 Starting graceful shutdown...");

    const shutdownMsg = {
      type: "SERVER_SHUTDOWN",
      message: "Server is restarting, please reconnect in a moment",
      timestamp: new Date().toISOString(),
      reconnectDelay: 5000,
    };

    broadcastToAll(shutdownMsg);

    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    wss.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.close(1001, "Server restarting");
      }
      if (client.pingInterval) {
        clearInterval(client.pingInterval);
      }
    });

    wss.close(() => {
      console.log("✅ WebSocket server closed");
    });

    if (redisReady) {
      if (redisSub) redisSub.quit().catch(() => {});
      if (redisPub) redisPub.quit().catch(() => {});
    }

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

  console.log("✅ UPDATED WebSocket layer initialized (node:", nodeId, ")");
  console.log("🔧 Enhanced with: Fixed typing, Better logging, Message broadcasting");
}