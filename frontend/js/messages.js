/**
 * frontend/js/messages.js — Lovculator 💖
 * COMPLETE UPDATED VERSION with all real-time features:
 * 1. Real-time typing indicators ✓
 * 2. Instant message delivery without refresh ✓
 * 3. Last seen with precise time ✓
 * 4. Message status ticks (✓, ✓✓) ✓
 * 5. File sharing (images, PDFs, docs) ✓
 */

/* ======================================================
   1) GLOBAL MANAGER (for all pages except messages.html)
====================================================== */
class MessagesManager {
  constructor() {
    this.API_BASE =
      window.API_BASE ||
      (window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api");

    this.currentConversation = null;
    this.isLoggedIn = false;
    this.currentUser = null;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;

    this.init();
  }

  async init() {
    await this.checkAuthentication();
    this.attachGlobalHandlers();

    if (this.isLoggedIn) {
      this.updateUnreadCount();
      this.connectWebSocket();
    }
  }

  async checkAuthentication() {
    try {
      const response = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        this.currentUser = await response.json();
        this.isLoggedIn = true;
        window.currentUser = this.currentUser;
        console.log("✅ User authenticated:", this.currentUser.username);
        return true;
      } else {
        this.isLoggedIn = false;
        console.log("⚠️ User not authenticated");
        return false;
      }
    } catch (error) {
      console.error("❌ Auth check failed:", error);
      this.isLoggedIn = false;
      return false;
    }
  }

  /* 🔌 WebSocket for real-time notifications */
  connectWebSocket() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener("open", () => {
        console.log("✅ Global WS connected");
        this.reconnectAttempts = 0;
        this.updateConnectionStatus("connected");
        
        // Send presence update
        this.sendPresenceUpdate();
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleRealtimeEvent(msg);
        } catch (error) {
          console.error("❌ Failed to parse WS message:", error);
        }
      });

      this.ws.addEventListener("close", (event) => {
        console.log("❌ Global WS closed:", event.code, event.reason);
        this.updateConnectionStatus("disconnected");
        this.reconnectWebSocket();
      });

      this.ws.addEventListener("error", (error) => {
        console.error("Global WS error:", error);
        this.updateConnectionStatus("error");
      });

      // Setup heartbeat
      setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "PONG" }));
        }
      }, 25000);

    } catch (err) {
      console.error("Global WS init error:", err);
    }
  }

  reconnectWebSocket() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      this.showReconnectNotification("Connection lost. Please refresh the page.", 0);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connectWebSocket();
    }, delay);
  }

  sendPresenceUpdate() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "PRESENCE_UPDATE",
        timestamp: new Date().toISOString()
      }));
    }
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById("connectionStatus");
    if (statusElement) {
      const statusConfig = {
        connected: { text: "Connected", class: "connected" },
        disconnected: { text: "Disconnected", class: "disconnected" },
        error: { text: "Connection Error", class: "error" },
        reconnecting: { text: "Reconnecting...", class: "reconnecting" }
      };

      const config = statusConfig[status];
      if (config) {
        statusElement.textContent = config.text;
        statusElement.className = `connection-status ${config.class}`;
      }
    }
  }

  handleRealtimeEvent(msg) {
    switch (msg.type) {
      case "NEW_MESSAGE":
        this.handleNewMessageNotification(msg);
        break;
      case "PRESENCE":
        this.handlePresenceUpdate(msg);
        break;
      case "SERVER_SHUTDOWN":
        this.handleServerShutdown(msg);
        break;
      case "TYPING":
        this.handleTypingNotification(msg);
        break;
      case "MESSAGE_SEEN":
        this.handleMessageSeen(msg);
        break;
      default:
        console.log("Unknown WS event type:", msg.type);
    }
  }

  handleNewMessageNotification({ message, conversationId }) {
    // Update unread count
    this.updateUnreadCount();
    
    // Show desktop notification if permitted
    if (this.shouldShowNotification() && message.sender_id !== this.currentUser?.id) {
      this.showDesktopNotification(message);
    }
    
    // Update badge immediately
    this.incrementUnreadBadge();
  }

  handleTypingNotification({ fromUserId, conversationId, isTyping }) {
    // Update typing indicators across the app
    this.updateTypingIndicator(fromUserId, conversationId, isTyping);
  }

  handleMessageSeen({ conversationId, messageIds, seenAt }) {
    // Update message status to seen (✓✓)
    this.updateMessageStatus(messageIds, 'seen', seenAt);
  }

  handlePresenceUpdate({ userId, isOnline, lastSeen, timestamp }) {
    // Update online status indicators
    this.updateUserPresence(userId, isOnline, lastSeen);
  }

  handleServerShutdown({ message, reconnectDelay }) {
    console.log("Server shutdown notification:", message);
    this.showReconnectNotification(message, reconnectDelay);
  }

  updateUserPresence(userId, isOnline, lastSeen) {
    const presenceIndicators = document.querySelectorAll(`[data-user-id="${userId}"] .presence-indicator`);
    presenceIndicators.forEach(indicator => {
      if (isOnline) {
        indicator.className = 'presence-indicator online';
        indicator.title = 'Online now';
      } else {
        indicator.className = 'presence-indicator offline';
        if (lastSeen) {
          const timeAgo = this.formatLastSeen(lastSeen);
          indicator.title = `Last seen ${timeAgo}`;
        }
      }
    });
  }

  updateTypingIndicator(userId, conversationId, isTyping) {
    const indicators = document.querySelectorAll(`[data-conversation-id="${conversationId}"] .typing-indicator`);
    indicators.forEach(indicator => {
      indicator.style.display = isTyping ? 'block' : 'none';
    });
  }

  updateMessageStatus(messageIds, status, timestamp) {
    messageIds.forEach(messageId => {
      const statusEl = document.querySelector(`[data-message-id="${messageId}"] .message-status`);
      if (statusEl) {
        if (status === 'seen') {
          statusEl.innerHTML = '✓✓';
          statusEl.className = 'message-status seen';
          statusEl.title = `Seen at ${new Date(timestamp).toLocaleTimeString()}`;
        } else if (status === 'delivered') {
          statusEl.innerHTML = '✓✓';
          statusEl.className = 'message-status delivered';
        }
      }
    });
  }

  formatLastSeen(timestamp) {
    const now = new Date();
    const lastSeen = new Date(timestamp);
    const diffMs = now - lastSeen;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return lastSeen.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  shouldShowNotification() {
    return (
      "Notification" in window &&
      Notification.permission === "granted" &&
      !document.hasFocus()
    );
  }

  showDesktopNotification(message) {
    const notification = new Notification("New Message 💌", {
      body: `${message.sender_display_name || message.sender_username}: ${this.truncateMessage(message.message_text || 'Sent an attachment', 50)}`,
      icon: message.sender_avatar_url || "/images/default-avatar.png",
      tag: `message-${message.conversation_id}`,
      badge: '/images/favicon-32x32.png'
    });

    notification.onclick = () => {
      window.focus();
      this.openMessagesModal(null, message.conversation_id);
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }

  showReconnectNotification(message, delay = 5000) {
    const notification = document.createElement("div");
    notification.className = "reconnect-notification";
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    if (delay > 0) {
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, delay);
    }
  }

  showLoginPrompt() {
    if (confirm("You need to log in to send messages. Go to login page?")) {
      window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
    }
  }

  async openMessagesModal(targetUserId = null, conversationId = null) {
    console.log("🎯 Opening messages, target user:", targetUserId, "conversation:", conversationId);

    if (!this.isLoggedIn) {
      this.showLoginPrompt();
      return;
    }

    try {
      let url = "/messages.html";
      const params = new URLSearchParams();
      
      if (targetUserId) params.append("user", targetUserId);
      if (conversationId) params.append("conversation", conversationId);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      window.location.href = url;
    } catch (error) {
      console.error("❌ Error opening messages:", error);
      this.showError("Failed to open messages. Please try again.");
    }
  }

  async updateUnreadCount() {
    if (!this.isLoggedIn) return;

    try {
      const response = await fetch(`${this.API_BASE}/messages/unread-count`, {
        credentials: "include",
        cache: "no-cache"
      });

      if (response.ok) {
        const { count } = await response.json();
        this.updateUnreadBadge(count);
      }
    } catch (error) {
      console.error("Update unread count error:", error);
    }
  }

  incrementUnreadBadge() {
    const currentBadge = document.getElementById("messagesBadge");
    if (currentBadge) {
      const currentCount = parseInt(currentBadge.textContent) || 0;
      this.updateUnreadBadge(currentCount + 1);
    } else {
      this.updateUnreadBadge(1);
    }
  }

  updateUnreadBadge(count) {
    let badge = document.getElementById("messagesBadge");
    
    if (!badge && count > 0) {
      const messagesLink = document.querySelector('a[href*="messages"]');
      if (messagesLink) {
        badge = document.createElement("span");
        badge.id = "messagesBadge";
        badge.className = "nav-badge";
        messagesLink.appendChild(badge);
      }
    }

    if (badge) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = count > 0 ? "flex" : "none";
      
      // Add animation for new messages
      if (count > 0) {
        badge.classList.add("pulse");
        setTimeout(() => badge.classList.remove("pulse"), 1000);
      }
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "global-error-message";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }

  truncateMessage(text, length = 30) {
    return text && text.length > length ? text.substring(0, length) + "..." : text;
  }

  formatTime(timestamp) {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  attachGlobalHandlers() {
    console.log("🔧 Attaching global message handlers...");

    // Message button handlers
    document.addEventListener("click", (e) => {
      const messageButton = e.target.closest(
        "#messageUserBtn, .message-user-btn, [data-action='message-user']"
      );

      if (messageButton) {
        e.preventDefault();
        e.stopPropagation();

        const userId = messageButton.dataset.userId;
        const conversationId = messageButton.dataset.conversationId;
        
        console.log("💌 Message button clicked for user:", userId, "conversation:", conversationId);

        if (!userId && !conversationId) return;

        if (!this.isLoggedIn) {
          this.showLoginPrompt();
        } else {
          this.openMessagesModal(userId, conversationId);
        }
        return;
      }
    });

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      setTimeout(() => {
        if (this.isLoggedIn && document.visibilityState === "visible") {
          Notification.requestPermission().then(permission => {
            console.log("📢 Notification permission:", permission);
          });
        }
      }, 3000);
    }

    // Update unread count when page becomes visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.isLoggedIn) {
        this.updateUnreadCount();
        this.sendPresenceUpdate();
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "PRESENCE_UPDATE",
          status: "away",
          timestamp: new Date().toISOString()
        }));
      }
    });

    console.log("✅ Global message handlers attached");
  }

  // Cleanup method
  destroy() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }
}

/* ======================================================
   2) ENHANCED MESSAGES PAGE (WhatsApp-style full chat)
====================================================== */
class MessagesPage {
  constructor() {
    this.API_BASE = window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api";

    this.currentConversation = null;
    this.conversations = [];
    this.currentUser = null;
    this.ws = null;
    this.typingTimeout = null;
    this.isTyping = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatInterval = null;
    this.isLoadingMessages = false;
    this.hasMoreMessages = true;
    this.messageQueue = [];
    this.presenceMap = new Map(); // Store user presence data
    this.typingUsers = new Map(); // Store typing status by conversation

    this.init();
  }

  // ✅ ENHANCED initialization
  async init() {
    console.log("⚡ Initializing MessagesPage...");
    
    const authSuccess = await this.checkAuth();
    if (!authSuccess) return;
    
    // Set currentUserId globally
    window.currentUserId = this.currentUser?.id;
    console.log("✅ Authentication successful. User ID:", window.currentUserId);
    
    // Initialize notifications
    this.initializeNotifications();
    
    // Load conversations
    await this.loadConversations();
    
    // Connect WebSocket
    this.connectWebSocket();
    
    // Attach event listeners
    this.attachEventListeners();
    
    // Pre-select from URL
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get("user");
    const targetConversation = urlParams.get("conversation");
    
    console.log("🎯 URL parameters:", { targetUser, targetConversation });
    
    if (targetConversation) {
      await this.openConversation(targetConversation);
    } else if (targetUser) {
      await this.startConversationWithUser(targetUser);
    }
    
    console.log("✅ MessagesPage fully initialized");
  }

  async checkAuth() {
    try {
      const response = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: "include",
        cache: "no-store"
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = data.user || data; // Handle both response formats
        window.currentUser = this.currentUser;

        if (!this.currentUser?.id) {
          throw new Error("User ID not found in response");
        }

        console.log("✅ Auth check passed. User:", this.currentUser.username, "ID:", this.currentUser.id);
        return true;
      }

      // Redirect to login if not authenticated
      const redirectUrl = "/login.html?redirect=" + 
        encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = redirectUrl;
      return false;

    } catch (error) {
      console.error("❌ Auth check failed:", error);
      window.location.href = "/login.html?redirect=" + 
        encodeURIComponent(window.location.pathname + window.location.search);
      return false;
    }
  }

  /* 🔌 Enhanced WebSocket connection */
  connectWebSocket() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener("open", () => {
        console.log("✅ Messages WS connected");
        this.reconnectAttempts = 0;
        this.updateConnectionStatus("connected");
        
        // Send initial presence
        this.sendPresenceUpdate();
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log("📨 WS message received:", msg.type, msg);
          this.handleRealtimeEvent(msg);
        } catch (error) {
          console.error("❌ Failed to parse WS message:", error, "Raw:", event.data);
        }
      });

      this.ws.addEventListener("close", (event) => {
        console.log("❌ Messages WS closed:", event.code, event.reason);
        this.updateConnectionStatus("disconnected");
        this.reconnectWebSocket();
      });

      this.ws.addEventListener("error", (error) => {
        console.error("Messages WS error:", error);
        this.updateConnectionStatus("error");
      });

      // Setup heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "PONG" }));
          this.sendPresenceUpdate();
        }
      }, 25000);

    } catch (err) {
      console.error("Messages WS init error:", err);
    }
  }

  sendPresenceUpdate() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "PRESENCE_UPDATE",
        timestamp: new Date().toISOString(),
        userId: this.currentUser?.id
      }));
    }
  }

  reconnectWebSocket() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      this.showReconnectNotification("Connection lost. Please refresh the page.", 0);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connectWebSocket();
    }, delay);
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById("connectionStatus");
    if (!statusElement) return;

    const statusConfig = {
      connected: { text: "Connected", class: "connected" },
      disconnected: { text: "Disconnected", class: "disconnected" },
      error: { text: "Connection Error", class: "error" },
      reconnecting: { text: "Reconnecting...", class: "reconnecting" }
    };

    const config = statusConfig[status];
    if (config) {
      statusElement.textContent = config.text;
      statusElement.className = `connection-status ${config.class}`;
      
      // Auto-hide after 3 seconds if connected
      if (status === 'connected') {
        setTimeout(() => {
          if (statusElement.classList.contains('connected')) {
            statusElement.style.opacity = '0';
            setTimeout(() => statusElement.style.display = 'none', 300);
          }
        }, 3000);
      }
    }
  }

  /* 📡 Enhanced real-time event handling */
  handleRealtimeEvent(msg) {
    console.log(`📡 Handling WS event: ${msg.type}`);
    
    switch (msg.type) {
      case "NEW_MESSAGE":
        this.handleNewMessageEvent(msg);
        break;
      case "TYPING":
        this.handleTypingEvent(msg);
        break;
      case "MESSAGE_SEEN":
        this.handleSeenEvent(msg);
        break;
      case "PRESENCE":
      case "PRESENCE_INITIAL":
      case "BULK_PRESENCE":
        this.handlePresenceEvent(msg);
        break;
      case "MESSAGE_EDITED":
        this.handleEditedEvent(msg);
        break;
      case "MESSAGE_DELETED":
        this.handleDeletedEvent(msg);
        break;
      case "SERVER_SHUTDOWN":
        this.handleServerShutdown(msg);
        break;
      default:
        console.log("Unknown WS event type:", msg.type, msg);
    }
  }

  handleNewMessageEvent({ conversationId, message }) {
    console.log(`📨 New message for conversation ${conversationId}:`, message.id);
    
    // If chat is open, append message
    if (this.currentConversation?.id === parseInt(conversationId)) {
      this.appendMessage(message);
      this.scrollToBottom();
      
      // Mark as read immediately
      this.markConversationSeen(conversationId);
      
      // Update message status
      if (message.sender_id !== this.currentUser?.id) {
        this.sendMessageSeen(conversationId, [message.id]);
      }
    } else {
      // Show notification
      this.showMessageNotification(message, conversationId);
    }
    
    // Update conversation list
    this.updateConversationPreview(conversationId, message);
  }

  updateConversationPreview(conversationId, message) {
    const convItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
    
    if (convItem) {
      const previewEl = convItem.querySelector(".conversation-preview");
      const timeEl = convItem.querySelector(".conversation-time");
      const unreadBadge = convItem.querySelector(".unread-badge");
      
      // Update preview text
      if (previewEl) {
        let previewText = '';
        
        if (message.message_type === 'image') {
          previewText = '📷 Photo';
        } else if (message.message_type === 'pdf' || message.message_type === 'doc') {
          previewText = '📎 Document';
        } else {
          previewText = this.truncateMessage(message.message_text || 'Sent a file', 40);
        }
        
        previewEl.textContent = previewText;
        previewEl.style.color = ""; // Reset typing color
      }
      
      // Update time
      if (timeEl) {
        timeEl.textContent = this.formatTimeShort(new Date());
      }
      
      // Update unread badge if not current chat
      if (this.currentConversation?.id !== parseInt(conversationId)) {
        convItem.classList.add("unread");
        
        if (unreadBadge) {
          const currentCount = parseInt(unreadBadge.textContent) || 0;
          unreadBadge.textContent = currentCount + 1;
        } else {
          const badge = document.createElement("span");
          badge.className = "unread-badge";
          badge.textContent = "1";
          convItem.querySelector(".conversation-meta")?.appendChild(badge);
        }
      }
      
      // Move to top
      const list = document.getElementById("conversationsList");
      if (list && convItem.parentNode === list) {
        list.prepend(convItem);
      }
    } else {
      // Conversation not in list, reload
      this.loadConversations();
    }
  }

  handleTypingEvent({ fromUserId, conversationId, isTyping, timestamp }) {
    console.log(`⌨️ Typing event from ${fromUserId} in ${conversationId}: ${isTyping}`);
    
    // Store typing state
    if (isTyping) {
      this.typingUsers.set(conversationId, {
        userId: fromUserId,
        timestamp: new Date(timestamp)
      });
    } else {
      this.typingUsers.delete(conversationId);
    }
    
    // Update current chat header
    if (this.currentConversation && this.currentConversation.id === parseInt(conversationId)) {
      this.updateChatTypingIndicator(fromUserId, isTyping);
    }
    
    // Update conversation list
    this.updateConversationTypingIndicator(conversationId, isTyping);
  }

  updateChatTypingIndicator(userId, isTyping) {
    const statusEl = document.getElementById("currentChatStatus");
    if (!statusEl) return;
    
    if (isTyping) {
      statusEl.innerHTML = `
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <span>Typing...</span>
      `;
      statusEl.classList.add('typing-active');
    } else {
      // Revert to presence status
      const userPresence = this.presenceMap.get(userId);
      if (userPresence?.isOnline) {
        statusEl.innerHTML = '<span class="online-dot"></span> Online';
      } else if (userPresence?.lastSeen) {
        statusEl.textContent = `Last seen ${this.formatLastSeen(userPresence.lastSeen)}`;
      } else {
        statusEl.textContent = 'Start chatting to connect';
      }
      statusEl.classList.remove('typing-active');
    }
  }

  updateConversationTypingIndicator(conversationId, isTyping) {
    const convItem = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
    if (!convItem) return;
    
    const previewEl = convItem.querySelector(".conversation-preview");
    if (previewEl) {
      if (isTyping) {
        previewEl.textContent = "Typing...";
        previewEl.classList.add('typing');
      } else {
        // Restore last message
        const conv = this.conversations.find(c => c.id === parseInt(conversationId));
        if (conv?.last_message) {
          let previewText = '';
          if (conv.last_message.message_type === 'image') {
            previewText = '📷 Photo';
          } else if (conv.last_message.message_type === 'pdf' || conv.last_message.message_type === 'doc') {
            previewText = '📎 Document';
          } else {
            previewText = this.truncateMessage(conv.last_message.message_text || '', 40);
          }
          previewEl.textContent = previewText;
        }
        previewEl.classList.remove('typing');
      }
    }
  }

  handleSeenEvent({ conversationId, messageIds, seenAt }) {
    console.log(`👀 Messages seen in ${conversationId}:`, messageIds);
    
    if (!this.currentConversation || this.currentConversation.id !== parseInt(conversationId)) return;
    
    // Update message status in UI
    messageIds.forEach(messageId => {
      const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
      if (messageEl) {
        const statusEl = messageEl.querySelector('.message-status');
        if (statusEl) {
          statusEl.innerHTML = '✓✓';
          statusEl.className = 'message-status seen';
          statusEl.title = `Seen at ${new Date(seenAt).toLocaleTimeString()}`;
        }
      }
    });
  }

  handlePresenceEvent(msg) {
    let users = [];
    
    if (msg.type === "BULK_PRESENCE" || msg.type === "PRESENCE_INITIAL") {
      users = msg.users || [];
    } else if (msg.type === "PRESENCE") {
      users = [{
        userId: msg.userId,
        isOnline: msg.isOnline,
        lastSeen: msg.lastSeen
      }];
    }
    
    users.forEach(user => {
      this.presenceMap.set(user.userId, {
        isOnline: user.isOnline,
        lastSeen: user.lastSeen ? new Date(user.lastSeen) : null,
        updatedAt: new Date()
      });
      
      // Update UI
      this.updateUserPresenceUI(user.userId, user.isOnline, user.lastSeen);
    });
  }

  updateUserPresenceUI(userId, isOnline, lastSeen) {
    // Update in conversations list
    const conversationItems = document.querySelectorAll(`.conversation-item[data-user-id="${userId}"]`);
    conversationItems.forEach(item => {
      const presenceEl = item.querySelector('.presence-indicator');
      if (presenceEl) {
        if (isOnline) {
          presenceEl.className = 'presence-indicator online';
          presenceEl.title = 'Online now';
        } else {
          presenceEl.className = 'presence-indicator offline';
          if (lastSeen) {
            presenceEl.title = `Last seen ${this.formatLastSeen(lastSeen)}`;
          }
        }
      }
    });
    
    // Update in current chat header
    if (this.currentConversation) {
      const conv = this.conversations.find(c => c.id === this.currentConversation.id);
      const otherParticipant = conv?.participants?.[0];
      
      if (otherParticipant && otherParticipant.id === userId) {
        const statusEl = document.getElementById("currentChatStatus");
        if (statusEl && !statusEl.classList.contains('typing-active')) {
          if (isOnline) {
            statusEl.innerHTML = '<span class="online-dot"></span> Online';
          } else if (lastSeen) {
            statusEl.textContent = `Last seen ${this.formatLastSeen(lastSeen)}`;
          }
        }
      }
    }
  }

  handleEditedEvent({ message }) {
    if (!this.currentConversation || this.currentConversation.id !== message.conversation_id) return;

    const messageEl = document.querySelector(`[data-message-id="${message.id}"]`);
    if (messageEl) {
      const textEl = messageEl.querySelector('.message-text');
      if (textEl) {
        const safeText = this.escapeHtml(message.message_text || "");
        textEl.innerHTML = `${safeText} <small class="edited-tag">(edited)</small>`;
      }
    }
  }

  handleDeletedEvent({ messageId }) {
    if (!this.currentConversation) return;

    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      const textEl = messageEl.querySelector('.message-text');
      if (textEl) {
        textEl.textContent = "[This message was deleted]";
        textEl.classList.add("deleted-message");
      }
    }
  }

  handleServerShutdown({ message, reconnectDelay }) {
    console.log("Server shutdown:", message);
    this.showReconnectNotification(message, reconnectDelay || 5000);
  }

  formatLastSeen(timestamp) {
    const lastSeen = new Date(timestamp);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastSeen.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTimeShort(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  showMessageNotification(message, conversationId) {
    if (this.shouldShowNotification()) {
      const senderName = message.sender_display_name || message.sender_username || 'Someone';
      let messageBody = '';
      
      if (message.message_type === 'image') {
        messageBody = '📷 Sent a photo';
      } else if (message.message_type === 'pdf' || message.message_type === 'doc') {
        messageBody = '📎 Sent a document';
      } else {
        messageBody = this.truncateMessage(message.message_text || 'Sent a message', 60);
      }
      
      const notification = new Notification(`${senderName}`, {
        body: messageBody,
        icon: message.sender_avatar_url || "/images/default-avatar.png",
        tag: `message-${conversationId}`,
        badge: '/images/favicon-32x32.png'
      });

      notification.onclick = () => {
        window.focus();
        this.openConversation(conversationId);
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    }
  }

  showReconnectNotification(message, delay = 5000) {
    const notification = document.createElement("div");
    notification.className = "reconnect-notification";
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, delay);
  }

  /* 📥 Enhanced conversations loading */
  async loadConversations() {
    const container = document.getElementById("conversationsList");
    if (!container) return;

    // Show loading skeleton
    container.innerHTML = this.getConversationsSkeleton();

    try {
      const response = await fetch(`${this.API_BASE}/messages/conversations`, {
        credentials: "include",
        cache: "no-cache",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) throw new Error(`Failed to load conversations: ${response.status}`);

      this.conversations = await response.json();
      console.log(`📋 Loaded ${this.conversations.length} conversations`);
      this.renderConversationsList();
    } catch (error) {
      console.error("❌ Load conversations error:", error);
      container.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">😔</div>
          <h3>Failed to load conversations</h3>
          <p>Please check your connection and try again</p>
          <button class="start-chatting-btn" onclick="window.messagesPage.loadConversations()">Retry</button>
        </div>
      `;
    }
  }

  getConversationsSkeleton() {
    return `
      <div class="loading-conversations">
        ${Array.from({ length: 5 }, () => `
          <div class="conversation-skeleton">
            <div class="avatar-skeleton"></div>
            <div class="info-skeleton">
              <div class="line-skeleton"></div>
              <div class="line-skeleton short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderConversationsList() {
    const container = document.getElementById("conversationsList");
    if (!container) return;

    if (!this.conversations || this.conversations.length === 0) {
      container.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">💬</div>
          <h3>No conversations yet</h3>
          <p>Start a conversation with someone to see it here</p>
          <button class="start-chatting-btn" onclick="window.location.href='/love-calculator'">Find Matches</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.conversations
      .map((conv) => {
        const otherParticipant = conv.participants?.[0];
        const lastMessage = conv.last_message;
        const unreadCount = conv.unread_count || 0;
        const isActive = this.currentConversation?.id === conv.id;
        const userPresence = this.presenceMap.get(otherParticipant?.id);
        const isTyping = this.typingUsers.get(conv.id.toString());

        // Format preview text
        let previewText = 'No messages yet';
        if (lastMessage) {
          if (lastMessage.message_type === 'image') {
            previewText = '📷 Photo';
          } else if (lastMessage.message_type === 'pdf' || lastMessage.message_type === 'doc') {
            previewText = '📎 Document';
          } else {
            previewText = this.truncateMessage(lastMessage.message_text || '', 40);
          }
        }

        // Check if user is typing
        if (isTyping) {
          previewText = 'Typing...';
        }

        return `
          <div class="conversation-item ${isActive ? "active" : ""} ${
          unreadCount > 0 ? "unread" : ""
        }" 
            data-conversation-id="${conv.id}" 
            data-user-id="${otherParticipant?.id || ""}">
            <div class="conversation-avatar-wrapper">
              <img src="${
                otherParticipant?.avatar_url || "/images/default-avatar.png"
              }" 
                alt="${
                  otherParticipant?.display_name ||
                  otherParticipant?.username ||
                  "User"
                }" 
                class="conversation-avatar" 
                onerror="this.src='/images/default-avatar.png'" />
              <span class="presence-indicator ${
                userPresence?.isOnline ? 'online' : 'offline'
              }" 
                title="${
                  userPresence?.isOnline 
                    ? 'Online now' 
                    : userPresence?.lastSeen 
                      ? `Last seen ${this.formatLastSeen(userPresence.lastSeen)}` 
                      : 'Offline'
                }"></span>
            </div>
            <div class="conversation-info">
              <div class="conversation-header-row">
                <h4 class="conversation-name">
                  ${
                    otherParticipant?.display_name ||
                    otherParticipant?.username ||
                    "Unknown User"
                  }
                </h4>
                <span class="conversation-time">
                  ${lastMessage ? this.formatTimeShort(new Date(lastMessage.created_at)) : ""}
                </span>
              </div>
              <p class="conversation-preview ${isTyping ? 'typing' : ''}">
                ${previewText}
              </p>
              <div class="conversation-meta">
                ${
                  unreadCount > 0
                    ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`
                    : ""
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Attach event listeners
    container.querySelectorAll(".conversation-item").forEach((item) => {
      item.addEventListener("click", () => {
        const conversationId = item.dataset.conversationId;
        this.openConversation(conversationId);
      });
    });
  }

  /* 🔁 Enhanced conversation opening */
  async openConversation(conversationId, options = {}) {
    if (this.isLoadingMessages) return;
    
    this.isLoadingMessages = true;
    const limit = options.limit || 30;
    const before = options.before || null;

    try {
      let url = `${this.API_BASE}/messages/conversations/${conversationId}/messages?limit=${limit}`;
      if (before) url += `&before=${before}`;

      console.log(`📥 Loading messages for conversation ${conversationId}`);
      const response = await fetch(url, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have access to this conversation");
        } else if (response.status === 404) {
          throw new Error("Conversation not found");
        } else {
          throw new Error(`Failed to load messages: ${response.status}`);
        }
      }

      const messages = await response.json();
      this.hasMoreMessages = messages.length >= limit;

      if (
        !this.currentConversation ||
        this.currentConversation.id !== parseInt(conversationId) ||
        !before
      ) {
        // New conversation or first load
        this.currentConversation = {
          id: parseInt(conversationId),
          messages: [...messages],
        };
        this.renderConversation(messages);
      } else {
        // Pagination: append older messages at top
        this.currentConversation.messages = [
          ...messages,
          ...this.currentConversation.messages,
        ];
        this.prependMessages(messages);
      }

      this.showMessageInput();

      // Update active state
      document.querySelectorAll(".conversation-item").forEach((item) => {
        const isActive = item.dataset.conversationId === String(conversationId);
        item.classList.toggle("active", isActive);
        
        // Remove unread badge
        if (isActive) {
          item.classList.remove("unread");
          const badge = item.querySelector(".unread-badge");
          if (badge) badge.remove();
        }
      });

      // Mark as seen
      await this.markConversationSeen(conversationId);

      // Update URL
      this.updateURL(conversationId);

      // Update mobile view
      if (window.innerWidth <= 768) {
        document.querySelector(".messages-container")?.classList.add("chat-open");
      }
      
      const messagesMain = document.getElementById("messagesMain");
      if (messagesMain) messagesMain.classList.add("active");

    } catch (err) {
      console.error("❌ Open conversation error:", err);
      this.showError(err.message || "Failed to load conversation");
    } finally {
      this.isLoadingMessages = false;
    }
  }

  updateURL(conversationId) {
    const url = new URL(window.location);
    url.searchParams.delete('user');
    url.searchParams.set('conversation', conversationId);
    window.history.replaceState({}, '', url);
  }

  async markConversationSeen(conversationId) {
    try {
      await fetch(
        `${this.API_BASE}/messages/conversations/${conversationId}/seen`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Update local unread count
      const conv = this.conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        conv.unread_count = 0;
      }
      
    } catch (err) {
      console.error("❌ Mark seen error:", err);
    }
  }

  async sendMessageSeen(conversationId, messageIds) {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "MESSAGE_SEEN",
          conversationId: conversationId,
          messageIds: messageIds,
          timestamp: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error("❌ Send message seen error:", err);
    }
  }

  renderConversation(messages) {
    const messagesList = document.getElementById("messagesList");
    const currentChatName = document.getElementById("currentChatName");
    const currentChatAvatar = document.getElementById("currentChatAvatar");
    const currentChatStatus = document.getElementById("currentChatStatus");

    if (!messagesList) return;

    if (!messages || messages.length === 0) {
      messagesList.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">💬</div>
          <h3>No messages yet</h3>
          <p>Start the conversation by sending a message!</p>
        </div>
      `;
      return;
    }

    const conv = this.conversations.find(
      (c) => c.id === this.currentConversation.id
    );
    const otherParticipant = conv?.participants?.[0];

    if (otherParticipant) {
      if (currentChatName) {
        currentChatName.textContent = otherParticipant.display_name || otherParticipant.username;
      }
      if (currentChatAvatar) {
        currentChatAvatar.src = otherParticipant.avatar_url || "/images/default-avatar.png";
        currentChatAvatar.alt = otherParticipant.display_name || otherParticipant.username;
      }
      
      // Update status
      const userPresence = this.presenceMap.get(otherParticipant.id);
      if (currentChatStatus) {
        if (userPresence?.isOnline) {
          currentChatStatus.innerHTML = '<span class="online-dot"></span> Online';
        } else if (userPresence?.lastSeen) {
          currentChatStatus.textContent = `Last seen ${this.formatLastSeen(userPresence.lastSeen)}`;
        } else {
          currentChatStatus.textContent = 'Start chatting to connect';
        }
      }
    }

    const groupedMessages = this.groupMessagesByDate(messages);
    const sortedDates = Object.keys(groupedMessages).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    messagesList.innerHTML = sortedDates
      .map((date) => {
        const dayMessages = groupedMessages[date].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        return `
          <div class="message-date-divider">
            <span class="date-label">${this.formatDate(date)}</span>
          </div>
          ${dayMessages.map((msg) => this.renderMessage(msg)).join("")}
        `;
      })
      .join("");

    this.scrollToBottom(true);
  }

  prependMessages(messages) {
    if (!messages.length) return;

    const messagesList = document.getElementById("messagesList");
    if (!messagesList) return;

    const oldScrollHeight = messagesList.scrollHeight;

    const grouped = this.groupMessagesByDate(messages);
    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    sortedDates.forEach((date) => {
      const dayMessages = grouped[date].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      const html = `
        <div class="message-date-divider">
          <span class="date-label">${this.formatDate(date)}</span>
        </div>
        ${dayMessages.map((msg) => this.renderMessage(msg)).join("")}
      `;

      messagesList.insertAdjacentHTML("afterbegin", html);
    });

    const newScrollHeight = messagesList.scrollHeight;
    messagesList.scrollTop = newScrollHeight - oldScrollHeight;
  }

  renderMessage(message) {
    const currentUserId = this.currentUser?.id;
    const isOwnMessage = parseInt(message.sender_id) === parseInt(currentUserId);
    const messageTime = this.formatMessageTime(message.created_at);
    
    // Message status ticks
    let messageStatus = '';
    if (isOwnMessage) {
      if (message.is_read) {
        messageStatus = '<span class="message-status seen" title="Seen">✓✓</span>';
      } else if (message.delivered_at) {
        messageStatus = '<span class="message-status delivered" title="Delivered">✓✓</span>';
      } else {
        messageStatus = '<span class="message-status sent" title="Sent">✓</span>';
      }
    }

    // Message content based on type
    let contentHtml = '';
    switch(message.message_type) {
      case 'image':
        contentHtml = this.renderImageMessage(message);
        break;
      case 'pdf':
      case 'doc':
      case 'docx':
      case 'txt':
        contentHtml = this.renderDocumentMessage(message);
        break;
      default:
        contentHtml = `<div class="message-text">${this.escapeHtml(message.message_text || "")}</div>`;
    }

    return `
      <div class="message ${isOwnMessage ? "own-message" : "other-message"}" 
           data-message-id="${message.id}"
           data-sender-id="${message.sender_id}">
        <div class="message-bubble">
          ${contentHtml}
          <div class="message-meta">
            <span class="message-time">${messageTime}</span>
            ${messageStatus}
          </div>
        </div>
      </div>
    `;
  }

  renderImageMessage(message) {
    return `
      <div class="message-attachment image">
        <img src="${message.attachment_url}" 
             alt="Image" 
             class="message-image" 
             onclick="window.open(this.src, '_blank')"
             loading="lazy"
             onerror="this.src='/images/image-error.png'">
        ${message.message_text && message.message_text !== 'Sent an image' ? 
          `<div class="image-caption">${this.escapeHtml(message.message_text)}</div>` : ''}
      </div>
    `;
  }

  renderDocumentMessage(message) {
    const icon = this.getDocumentIcon(message.message_type);
    const filename = message.filename || 'Document';
    const size = message.file_size ? this.formatFileSize(message.file_size) : '';
    
    return `
      <div class="message-attachment document">
        <a href="${message.attachment_url}" target="_blank" class="attachment-link" download>
          <span class="doc-icon">${icon}</span>
          <div class="doc-info">
            <div class="doc-name">${this.escapeHtml(filename)}</div>
            ${size ? `<div class="doc-size">${size}</div>` : ''}
          </div>
          <span class="download-btn">↓</span>
        </a>
        ${message.message_text ? 
          `<div class="document-caption">${this.escapeHtml(message.message_text)}</div>` : ''}
      </div>
    `;
  }

  getDocumentIcon(fileType) {
    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'txt': '📄',
      'default': '📎'
    };
    return icons[fileType] || icons.default;
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /* ✉️ Enhanced message sending */
  async sendMessage(attachmentMeta = null) {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");
    const messageText = input?.value.trim();
    
    if (!messageText && !attachmentMeta) {
      console.log("⚠️ Cannot send: No message text or attachment");
      return;
    }
    
    if (!this.currentConversation) {
      this.showError("Please select a conversation first");
      return;
    }

    console.log("🚀 Sending message to conversation:", this.currentConversation.id);

    // Disable send button during sending
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<div class="loading-spinner"></div>';
    }

    // Prepare message data
    const messageData = {
      message_text: messageText || null,
      message_type: attachmentMeta ? 'attachment' : 'text'
    };

    if (attachmentMeta) {
      messageData.message_type = attachmentMeta.type;
      messageData.attachment_url = attachmentMeta.url;
      messageData.filename = attachmentMeta.filename;
      messageData.file_size = attachmentMeta.file_size;
    }

    try {
      const response = await fetch(
        `${this.API_BASE}/messages/conversations/${this.currentConversation.id}/messages`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json" 
          },
          credentials: "include",
          body: JSON.stringify(messageData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const newMessage = await response.json();
      console.log("✅ Message sent successfully:", newMessage.id);
      
      // Clear input
      if (input) {
        input.value = "";
        this.autoResizeTextarea(input);
      }
      
      // Stop typing indicator
      this.stopTypingIndicator();
      
      // Refresh conversations to update last message
      this.loadConversations();

    } catch (error) {
      console.error("❌ Send message error:", error);
      this.showError("Failed to send message. Please try again.");
    } finally {
      // Re-enable send button
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span style="font-size: 18px;">➤</span>';
      }
    }
  }

  appendMessage(message) {
    const messagesList = document.getElementById("messagesList");
    if (!messagesList) return;

    const emptyState = messagesList.querySelector(".empty-conversations");
    if (emptyState) emptyState.remove();

    messagesList.insertAdjacentHTML("beforeend", this.renderMessage(message));
  }

  showMessageInput() {
    const inputContainer = document.getElementById("messageInputContainer");
    if (inputContainer) inputContainer.style.display = "flex";
  }

  scrollToBottom(force = false) {
    const messagesList = document.getElementById("messagesList");
    if (!messagesList) return;

    if (force) {
      messagesList.scrollTop = messagesList.scrollHeight;
      return;
    }

    setTimeout(() => {
      messagesList.scrollTop = messagesList.scrollHeight;
    }, 50);
  }

  /* 🎯 Enhanced event listeners */
  attachEventListeners() {
    console.log("🔧 Attaching event listeners...");

    // Send message button
    const sendBtn = document.getElementById("sendMessageBtn");
    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    // Message input handling
    const messageInput = document.getElementById("messageInput");
    if (messageInput) {
      messageInput.addEventListener("input", () => {
        this.handleTyping();
        this.autoResizeTextarea(messageInput);
      });
      
      messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize
      messageInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
      });
    }

    // Search conversations
    const searchInput = document.getElementById("searchConversations");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filterConversations(e.target.value);
        }, 300);
      });
    }

    // Back button (mobile)
    const backBtn = document.getElementById("backToList");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        this.closeChat();
      });
    }

    // Infinite scroll for older messages
    const messagesList = document.getElementById("messagesList");
    if (messagesList) {
      messagesList.addEventListener("scroll", () => {
        if (messagesList.scrollTop < 100 && 
            this.hasMoreMessages && 
            !this.isLoadingMessages &&
            this.currentConversation?.messages?.length) {
          
          const oldest = this.currentConversation.messages[0];
          if (!oldest) return;
          
          this.openConversation(this.currentConversation.id, {
            before: oldest.created_at,
            limit: 20,
          });
        }
      });
    }

    // File attachment
    const attachBtn = document.getElementById("attachBtn");
    const attachInput = document.getElementById("attachInput");
    if (attachBtn && attachInput) {
      attachBtn.addEventListener("click", () => {
        attachInput.click();
      });
      
      attachInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log("📎 File selected:", file.name, file.type, file.size);
        
        // Show uploading state
        const uploadId = this.showUploadingState(file.name);
        
        try {
          const meta = await this.uploadAttachment(file);
          if (meta) {
            await this.sendMessage(meta);
          }
        } catch (error) {
          console.error("❌ File upload failed:", error);
          this.showError("Failed to upload file");
        } finally {
          this.removeUploadingState(uploadId);
          e.target.value = "";
        }
      });
    }

    // Mic (voice note) placeholder
    const micBtn = document.getElementById("micBtn");
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        this.showFeatureComingSoon("Voice messages");
      });
    }

    // Emoji picker placeholder
    const emojiBtn = document.getElementById("emojiBtn");
    if (emojiBtn) {
      emojiBtn.addEventListener("click", () => {
        this.showFeatureComingSoon("Emoji picker");
      });
    }

    // Resize -> show both panes on desktop
    window.addEventListener("resize", () => {
      const container = document.querySelector(".messages-container");
      if (window.innerWidth > 768 && container) {
        container.classList.remove("chat-open");
      }
    });

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopTypingIndicator();
      } else {
        this.sendPresenceUpdate();
        this.loadConversations();
      }
    });

    // Handle beforeunload
    window.addEventListener("beforeunload", () => {
      this.stopTypingIndicator();
      this.sendPresenceUpdate();
    });

    // Handle offline/online events
    window.addEventListener('online', () => {
      console.log("✅ Connection restored");
      this.updateConnectionStatus("connected");
      this.loadConversations();
    });

    window.addEventListener('offline', () => {
      console.log("❌ Connection lost");
      this.updateConnectionStatus("disconnected");
    });

    console.log("✅ Event listeners attached");
  }

  handleTyping() {
    if (!this.currentConversation || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("⚠️ Typing indicator skipped: No conversation or WS not ready");
      return;
    }
    
    const conv = this.conversations.find(c => c.id === this.currentConversation.id);
    if (!conv || !conv.participants?.[0]) return;
    
    const otherUserId = conv.participants[0].id;
    
    if (!this.isTyping) {
      this.isTyping = true;
      console.log(`⌨️ Sending typing START to ${otherUserId}`);
      this.sendTypingIndicator(true, otherUserId);
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false;
        console.log(`⌨️ Sending typing STOP to ${otherUserId}`);
        this.sendTypingIndicator(false, otherUserId);
      }
    }, 2000);
  }

  stopTypingIndicator() {
    if (this.isTyping) {
      this.isTyping = false;
      const conv = this.conversations.find(c => c.id === this.currentConversation?.id);
      if (conv?.participants?.[0]) {
        this.sendTypingIndicator(false, conv.participants[0].id);
      }
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }

  sendTypingIndicator(isTyping, toUserId) {
    if (!this.currentConversation || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log("⚠️ Cannot send typing: WS not ready");
      return;
    }

    const payload = {
      type: "TYPING",
      conversationId: this.currentConversation.id,
      isTyping: isTyping,
      toUserId: toUserId,
      timestamp: new Date().toISOString()
    };
    
    console.log("📤 Sending typing event:", payload);
    
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error("❌ Failed to send typing event:", error);
    }
  }

  autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  filterConversations(searchTerm) {
    const items = document.querySelectorAll(".conversation-item");
    const search = searchTerm.toLowerCase().trim();
    
    if (!search) {
      items.forEach(item => item.style.display = "flex");
      return;
    }

    items.forEach((item) => {
      const name = item.querySelector(".conversation-name")?.textContent.toLowerCase() || "";
      const preview = item.querySelector(".conversation-preview")?.textContent.toLowerCase() || "";
      
      if (name.includes(search) || preview.includes(search)) {
        item.style.display = "flex";
      } else {
        item.style.display = "none";
      }
    });
  }

  async startConversationWithUser(userId) {
    try {
      console.log(`🤝 Starting conversation with user ${userId}`);
      
      const response = await fetch(`${this.API_BASE}/messages/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create conversation");
      }

      const { conversationId } = await response.json();
      console.log(`✅ Conversation created: ${conversationId}`);
      await this.openConversation(conversationId);
    } catch (error) {
      console.error("❌ Start conversation error:", error);
      this.showError(error.message || "Failed to start conversation");
    }
  }

  // Enhanced file upload
  async uploadAttachment(file) {
    // Validate file
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      this.showError('File too large (max 10MB)');
      throw new Error('File size exceeded');
    }
    
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      this.showError('File type not supported. Supported: Images, PDF, Word, Text');
      throw new Error('File type not supported');
    }
    
    // Determine file type category
    let messageType = 'text';
    if (file.type.startsWith('image/')) messageType = 'image';
    else if (file.type === 'application/pdf') messageType = 'pdf';
    else if (file.type.includes('word')) messageType = 'doc';
    else if (file.type === 'text/plain') messageType = 'txt';
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log(`📤 Uploading ${file.name} (${messageType})`);
      
      const response = await fetch(`${this.API_BASE}/messages/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${error}`);
      }
      
      const data = await response.json();
      console.log('✅ Upload successful:', data.url);
      
      return {
        url: data.url,
        type: messageType,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type
      };
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  }

  showUploadingState(filename) {
    const uploadId = 'upload-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = uploadId;
    indicator.className = 'upload-indicator';
    indicator.innerHTML = `
      <div class="upload-progress">
        <div class="upload-filename">Uploading: ${this.escapeHtml(filename)}</div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill"></div>
        </div>
      </div>
    `;
    
    const inputContainer = document.getElementById('messageInputContainer');
    if (inputContainer) {
      inputContainer.parentNode.insertBefore(indicator, inputContainer.nextSibling);
    }
    
    // Simulate progress animation
    const progressFill = indicator.querySelector('.upload-progress-fill');
    let width = 0;
    const interval = setInterval(() => {
      if (width < 80) {
        width += 5;
        progressFill.style.width = `${width}%`;
      }
    }, 200);
    
    indicator.dataset.intervalId = interval;
    
    return uploadId;
  }

  removeUploadingState(uploadId) {
    const indicator = document.getElementById(uploadId);
    if (indicator) {
      const intervalId = indicator.dataset.intervalId;
      if (intervalId) clearInterval(intervalId);
      
      // Complete animation
      const progressFill = indicator.querySelector('.upload-progress-fill');
      if (progressFill) {
        progressFill.style.width = '100%';
      }
      
      setTimeout(() => {
        if (indicator.parentElement) {
          indicator.remove();
        }
      }, 500);
    }
  }

  showFeatureComingSoon(feature) {
    this.showError(`${feature} coming soon!`);
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "message-error";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }

  closeChat() {
    const container = document.querySelector(".messages-container");
    const messagesMain = document.getElementById("messagesMain");
    
    if (container) container.classList.remove("chat-open");
    if (messagesMain) messagesMain.classList.remove("active");
    
    // Clear current conversation
    this.currentConversation = null;
    this.stopTypingIndicator();
    
    // Reset chat header
    const currentChatName = document.getElementById("currentChatName");
    const currentChatStatus = document.getElementById("currentChatStatus");
    const messagesList = document.getElementById("messagesList");
    
    if (currentChatName) currentChatName.textContent = "Select a conversation";
    if (currentChatStatus) currentChatStatus.textContent = "Start chatting to connect";
    if (messagesList) {
      messagesList.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">💌</div>
          <h3>No conversation selected</h3>
          <p>Choose a conversation from the list to start messaging</p>
        </div>
      `;
    }
    
    // Hide message input
    const inputContainer = document.getElementById("messageInputContainer");
    if (inputContainer) inputContainer.style.display = "none";

    // Update URL
    const url = new URL(window.location);
    url.searchParams.delete('conversation');
    window.history.replaceState({}, '', url);
    
    // Reload conversations to update badges
    this.loadConversations();
  }

  initializeNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
      // Request permission when user focuses message input
      const messageInput = document.getElementById("messageInput");
      if (messageInput) {
        messageInput.addEventListener("focus", () => {
          Notification.requestPermission().then(permission => {
            console.log("📢 Notification permission:", permission);
          });
        }, { once: true });
      }
    }
  }

  shouldShowNotification() {
    return (
      "Notification" in window &&
      Notification.permission === "granted" &&
      !document.hasFocus()
    );
  }

  // Utility methods
  groupMessagesByDate(messages) {
    const groups = {};
    messages.forEach((message) => {
      const date = new Date(message.created_at).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(message);
    });
    return groups;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  formatTime(timestamp) {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  }

  truncateMessage(text, length = 40) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + "..." : text;
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Cleanup method
  destroy() {
    this.stopTypingIndicator();
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }
}

/* ======================================================
   3) INITIALIZATION
====================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const isMessagesPage = document.body.classList.contains("messages-page");

  // Global manager for all pages except the main messages page
  if (!isMessagesPage) {
    window.messagesManager = new MessagesManager();
    console.log("✅ messagesManager initialized globally");
  }

  // Full chat experience only on messages.html
  if (isMessagesPage) {
    window.messagesPage = new MessagesPage();
    console.log("✅ messagesPage (WhatsApp-style) initialized");
  }
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessagesManager, MessagesPage };
}