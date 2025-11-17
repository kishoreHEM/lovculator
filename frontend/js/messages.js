/**
 * frontend/js/messages.js — Lovculator 💖
 * Enhanced Global Messaging Manager + Messages Page (WhatsApp-style)
 */

/* ======================================================
   1) GLOBAL MANAGER (for all pages except messages.html)
   - Handles:
     • "Message" button clicks on profiles
     • Unread badge in navbar
     • Real-time notifications
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
      } else {
        this.isLoggedIn = false;
        console.log("⚠️ User not authenticated");
      }
    } catch (error) {
      console.error("❌ Auth check failed:", error);
      this.isLoggedIn = false;
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
      });

      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        this.handleRealtimeEvent(msg);
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

    } catch (err) {
      console.error("Global WS init error:", err);
    }
  }

  reconnectWebSocket() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connectWebSocket();
    }, delay);
  }

  updateConnectionStatus(status) {
    // Could show a subtle connection indicator
    const statuses = {
      connected: "✅",
      disconnected: "❌", 
      error: "⚠️",
      reconnecting: "🔄"
    };
    console.log(`Connection: ${statuses[status] || status}`);
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
      default:
        break;
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

  handlePresenceUpdate({ userId, isOnline, lastSeen }) {
    // Update online status indicators across the app
    this.updateUserPresence(userId, isOnline, lastSeen);
  }

  handleServerShutdown({ message, reconnectDelay }) {
    console.log("Server shutdown notification:", message);
    this.showReconnectNotification(message, reconnectDelay);
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
      body: `${message.sender_display_name || message.sender_username}: ${this.truncateMessage(message.message_text, 50)}`,
      icon: message.sender_avatar_url || "/images/default-avatar.png",
      tag: `message-${message.conversation_id}`
    });

    notification.onclick = () => {
      window.focus();
      this.openMessagesModal(null, message.conversation_id);
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }

  updateUserPresence(userId, isOnline, lastSeen) {
    // Update presence indicators across the app
    const presenceIndicators = document.querySelectorAll(`[data-user-id="${userId}"] .online-indicator`);
    presenceIndicators.forEach(indicator => {
      if (isOnline) {
        indicator.style.display = "inline-block";
        indicator.style.background = "#4CAF50";
      } else {
        indicator.style.display = "none";
      }
    });
  }

  showReconnectNotification(message, delay = 5000) {
    // Show a user-friendly reconnection notification
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
    // Show user-friendly error message
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
          Notification.requestPermission();
        }
      }, 3000);
    }

    // Update unread count when page becomes visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.isLoggedIn) {
        this.updateUnreadCount();
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
   - Only used on messages.html (body.messages-page)
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

    this.init();
  }

  async init() {
    await this.checkAuth();
    await this.loadConversations();
    this.attachEventListeners();
    this.connectWebSocket();

    // Pre-select user from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get("user");
    const targetConversation = urlParams.get("conversation");
    
    if (targetConversation) {
      await this.openConversation(targetConversation);
    } else if (targetUser) {
      await this.startConversationWithUser(targetUser);
    }

    // Initialize notification permission
    this.initializeNotifications();
  }

  async checkAuth() {
    try {
      const response = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: "include",
      });
      
      if (response.ok) {
        this.currentUser = await response.json();
        console.log("✅ Messages page user:", this.currentUser.username);
      } else {
        window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      window.location.href = "/login.html?redirect=" + encodeURIComponent(window.location.pathname);
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
      });

      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        this.handleRealtimeEvent(msg);
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

      // Set up heartbeat
      this.heartbeatInterval = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "PONG" }));
        }
      }, 25000);

    } catch (err) {
      console.error("Messages WS init error:", err);
    }
  }

  reconnectWebSocket() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      this.showReconnectNotification("Connection lost. Please refresh the page.");
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
    }
  }

  /* 📡 Enhanced real-time event handling */
  handleRealtimeEvent(msg) {
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
        this.handlePresenceEvent(msg);
        break;
      case "PRESENCE_INITIAL":
        this.handlePresenceInitialEvent(msg);
        break;
      case "BULK_PRESENCE":
        this.handleBulkPresenceEvent(msg);
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
        console.log("Unknown message type:", msg.type);
    }
  }

  handleNewMessageEvent({ conversationId, message }) {
    if (this.currentConversation?.id === parseInt(conversationId)) {
      // Message for current conversation
      this.appendMessage(message);
      this.scrollToBottom();
      if (this.currentConversation.messages) {
        this.currentConversation.messages.push(message);
      }
      
      // Mark as read if we're viewing the conversation
      this.markConversationSeen(conversationId);
    } else {
      // Message for other conversation - show notification
      this.showMessageNotification(message, conversationId);
    }
    
    // Refresh conversation list
    this.loadConversations();
  }

  handleTypingEvent({ fromUserId, conversationId, isTyping }) {
    if (!this.currentConversation || this.currentConversation.id !== parseInt(conversationId)) return;
    if (fromUserId === this.currentUser.id) return;

    const statusEl = document.getElementById("currentChatStatus");
    if (!statusEl) return;

    if (isTyping) {
      statusEl.textContent = "Typing...";
      statusEl.classList.add("typing");
    } else {
      statusEl.classList.remove("typing");
      this.updateChatStatus(fromUserId);
    }
  }

  handleSeenEvent({ conversationId, messageIds, seenAt }) {
    if (!this.currentConversation || this.currentConversation.id !== parseInt(conversationId)) return;
    
    // Update message status in UI
    messageIds.forEach(messageId => {
      const messageEl = document.querySelector(`[data-message-id="${messageId}"] .message-status`);
      if (messageEl) {
        messageEl.innerHTML = "✓✓";
        messageEl.title = `Seen at ${new Date(seenAt).toLocaleTimeString()}`;
      }
    });
  }

  handlePresenceEvent({ userId, isOnline, lastSeen }) {
    this.updateUserPresence(userId, isOnline, lastSeen);
  }

  handlePresenceInitialEvent(msg) {
    this.updateUserPresence(msg.userId, msg.isOnline, msg.lastSeen);
  }

  handleBulkPresenceEvent({ users }) {
    users.forEach(user => {
      this.updateUserPresence(user.userId, user.isOnline, user.lastSeen);
    });
  }

  handleEditedEvent({ message }) {
    if (!this.currentConversation || this.currentConversation.id !== message.conversation_id) return;

    const el = document.querySelector(`[data-message-id="${message.id}"] .message-text`);
    if (el) {
      const safe = this.escapeHtml(message.message_text || "");
      el.innerHTML = `${safe} <small class="edited-tag">(edited)</small>`;
    }
  }

  handleDeletedEvent({ messageId }) {
    if (!this.currentConversation) return;

    const el = document.querySelector(`[data-message-id="${messageId}"] .message-text`);
    if (el) {
      el.textContent = "[deleted]";
      el.classList.add("deleted-message");
    }
  }

  handleServerShutdown({ message, reconnectDelay }) {
    console.log("Server shutdown:", message);
    this.showReconnectNotification(message, reconnectDelay);
  }

  updateUserPresence(userId, isOnline, lastSeen) {
    // Update in conversations list
    const conversationItem = document.querySelector(`[data-user-id="${userId}"]`);
    if (conversationItem) {
      const onlineIndicator = conversationItem.querySelector('.online-indicator');
      if (onlineIndicator) {
        onlineIndicator.style.display = isOnline ? 'inline-block' : 'none';
      }
    }

    // Update in current chat header
    if (this.currentConversation) {
      const conv = this.conversations.find(c => c.id === this.currentConversation.id);
      const otherParticipant = conv?.participants?.[0];
      if (otherParticipant && otherParticipant.id === userId) {
        this.updateChatStatus(userId, isOnline, lastSeen);
      }
    }
  }

  updateChatStatus(userId = null, isOnline = null, lastSeen = null) {
    const statusEl = document.getElementById("currentChatStatus");
    if (!statusEl) return;

    if (isOnline) {
      statusEl.innerHTML = `<span class="online-indicator"></span> Online`;
      return;
    }

    if (!lastSeen) {
      statusEl.textContent = "Last seen recently";
      return;
    }

    const last = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - last;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 5) {
      statusEl.textContent = "Last seen recently";
      return;
    }

    const sameDay = last.toDateString() === now.toDateString();
    const time = last.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (sameDay) {
      statusEl.textContent = `Last seen today at ${time}`;
    } else {
      const dateText = last.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      statusEl.textContent = `Last seen ${dateText} at ${time}`;
    }
  }

  showMessageNotification(message, conversationId) {
    if (this.shouldShowNotification()) {
      const notification = new Notification("New Message 💌", {
        body: `${message.sender_display_name || message.sender_username}: ${this.truncateMessage(message.message_text, 50)}`,
        icon: message.sender_avatar_url || "/images/default-avatar.png",
        tag: `message-${conversationId}`
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
        cache: "no-cache"
      });

      if (!response.ok) throw new Error("Failed to load conversations");

      this.conversations = await response.json();
      this.renderConversationsList();
    } catch (error) {
      console.error("Load conversations error:", error);
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

        return `
          <div class="conversation-item ${isActive ? "active" : ""} ${
          unreadCount > 0 ? "unread" : ""
        }" 
            data-conversation-id="${conv.id}" 
            data-user-id="${otherParticipant?.id || ""}">
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
                  ${lastMessage ? this.formatTime(lastMessage.created_at) : ""}
                </span>
              </div>
              <p class="conversation-preview">
                ${
                  lastMessage?.message_text
                    ? this.truncateMessage(lastMessage.message_text)
                    : "No messages yet"
                }
              </p>
              <div class="conversation-meta">
                ${
                  unreadCount > 0
                    ? `<span class="unread-badge">${unreadCount}</span>`
                    : ""
                }
                <div class="online-indicator" style="display: ${otherParticipant?.is_online ? 'inline-block' : 'none'}"></div>
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

  /* 🔁 Enhanced conversation opening with pagination */
  async openConversation(conversationId, options = {}) {
    if (this.isLoadingMessages) return;
    
    this.isLoadingMessages = true;
    const limit = options.limit || 30;
    const before = options.before || null;

    try {
      let url = `${this.API_BASE}/messages/conversations/${conversationId}/messages?limit=${limit}`;
      if (before) url += `&before=${before}`;

      const response = await fetch(url, { credentials: "include" });
      
      if (!response.ok) throw new Error("Failed to load messages");

      const data = await response.json();
      const messages = data.messages || data; // Handle both formats
      this.hasMoreMessages = data.pagination?.hasMore !== false;

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

      // Update active state in conversations list
      document.querySelectorAll(".conversation-item").forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.conversationId === String(conversationId)
        );
      });

      // Update mobile view
      const container = document.querySelector(".messages-container");
      const messagesMain = document.getElementById("messagesMain");
      if (messagesMain) messagesMain.classList.add("active");
      if (window.innerWidth <= 768 && container) container.classList.add("chat-open");

      // Mark as seen
      await this.markConversationSeen(conversationId);

      // Update URL without page reload
      this.updateURL(conversationId);

    } catch (err) {
      console.error("Open conversation error:", err);
      this.showError("Failed to load conversation");
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
        }
      );
      
      // Update local unread count
      const conv = this.conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        conv.unread_count = 0;
      }
      
      this.renderConversationsList();
    } catch (err) {
      console.error("mark seen error", err);
    }
  }

  renderConversation(messages) {
    const messagesList = document.getElementById("messagesList");
    const currentChatName = document.getElementById("currentChatName");
    const currentChatAvatar = document.getElementById("currentChatAvatar");

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
      if (currentChatName)
        currentChatName.textContent =
          otherParticipant.display_name || otherParticipant.username;
      if (currentChatAvatar) {
        currentChatAvatar.src = otherParticipant.avatar_url || "/images/default-avatar.png";
        currentChatAvatar.alt = otherParticipant.display_name || otherParticipant.username;
      }
      this.updateChatStatus(otherParticipant.id, otherParticipant.is_online);
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
    const isOwnMessage = message.sender_id === this.currentUser?.id;
    const deleted = !!message.deleted_at;
    const edited = !!message.edited_at;
    const hasAttachment = !!message.attachment_url;

    const safeText = deleted
      ? '<span class="deleted-message">[deleted]</span>'
      : this.escapeHtml(message.message_text || "");

    const editedTag = edited ? '<small class="edited-tag">(edited)</small>' : '';

    const attachmentHtml = hasAttachment
      ? `<div class="attachment">
          <a href="${message.attachment_url}" target="_blank" class="attachment-link">
            📎 Attachment
          </a>
        </div>`
      : '';

    const messageTime = this.formatTime(message.created_at);
    const messageStatus = isOwnMessage ? 
      (message.is_read ? 
        '<span class="message-status" title="Read">✓✓</span>' : 
        '<span class="message-status" title="Sent">✓</span>') : 
      '';

    return `
      <div class="message ${isOwnMessage ? "own-message" : "other-message"}" 
           data-message-id="${message.id}">
        <div class="message-bubble">
          ${attachmentHtml}
          <p class="message-text">${safeText} ${editedTag}</p>
          <div class="message-meta">
            <span class="message-time">${messageTime}</span>
            ${messageStatus}
          </div>
        </div>
      </div>
    `;
  }

  /* ✉️ Enhanced message sending */
  async sendMessage(attachmentMeta = null) {
    const input = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendMessageBtn");
    const messageText = input?.value.trim();
    
    if (!messageText && !attachmentMeta) return;
    if (!this.currentConversation) return;

    // Disable send button during sending
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<div class="loading-spinner"></div>';
    }

    const body = {
      message_text: messageText || null,
      message_type: attachmentMeta ? 'attachment' : 'text'
    };

    if (attachmentMeta) {
      body.attachment_type = attachmentMeta.type;
      body.attachment_url = attachmentMeta.url;
    }

    try {
      const response = await fetch(
        `${this.API_BASE}/messages/conversations/${this.currentConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) throw new Error("Failed to send message");

      const newMessage = await response.json();
      this.appendMessage(newMessage);
      
      if (input) {
        input.value = "";
        this.autoResizeTextarea(input);
      }
      
      this.scrollToBottom();
      
      if (this.currentConversation?.messages) {
        this.currentConversation.messages.push(newMessage);
      }

      // Refresh conversations list to update last message
      this.loadConversations();

    } catch (error) {
      console.error("Send message error:", error);
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
    if (inputContainer) inputContainer.style.display = "block";
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

    // Attachments
    const attachBtn = document.getElementById("attachBtn");
    const attachInput = document.getElementById("attachInput");
    if (attachBtn && attachInput) {
      attachBtn.addEventListener("click", () => {
        attachInput.click();
      });
      attachInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Show uploading state
        this.showUploadingState();
        
        const meta = await this.uploadAttachment(file);
        if (meta) {
          this.sendMessage(meta);
        }
        e.target.value = "";
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
      }
    });

    // Handle beforeunload
    window.addEventListener("beforeunload", () => {
      this.stopTypingIndicator();
    });
  }

  handleTyping() {
    if (!this.currentConversation) return;
    
    if (!this.isTyping) {
      this.isTyping = true;
      this.sendTypingIndicator(true);
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.sendTypingIndicator(false);
    }, 2000);
  }

  stopTypingIndicator() {
    if (this.isTyping) {
      this.isTyping = false;
      this.sendTypingIndicator(false);
    }
    clearTimeout(this.typingTimeout);
  }

  sendTypingIndicator(isTyping) {
    if (!this.currentConversation) return;

    const conv = this.conversations.find(
      (c) => c.id === this.currentConversation.id
    );
    const other = conv?.participants?.[0];
    
    if (other && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "TYPING",
        conversationId: this.currentConversation.id,
        isTyping: isTyping,
        toUserId: other.id
      }));
    }
  }

  autoResizeTextarea(textarea) {
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
      const response = await fetch(`${this.API_BASE}/messages/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId: userId }),
      });

      if (!response.ok) throw new Error("Failed to create conversation");

      const { conversationId } = await response.json();
      await this.openConversation(conversationId);
    } catch (error) {
      console.error("Start conversation error:", error);
      this.showError("Failed to start conversation");
    }
  }

  // Upload attachment (enhanced)
  async uploadAttachment(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${this.API_BASE}/messages/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      return { type: data.type, url: data.url };
    } catch (err) {
      console.error("Upload error", err);
      this.showError("Failed to upload attachment");
      return null;
    }
  }

  showUploadingState() {
    const inputContainer = document.getElementById("messageInputContainer");
    if (inputContainer) {
      const existing = inputContainer.querySelector('.uploading-indicator');
      if (existing) existing.remove();
      
      const indicator = document.createElement('div');
      indicator.className = 'uploading-indicator';
      indicator.textContent = 'Uploading...';
      inputContainer.appendChild(indicator);
      
      setTimeout(() => indicator.remove(), 3000);
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
  }

  initializeNotifications() {
    if ("Notification" in window && Notification.permission === "default") {
      // Request permission when user interacts with messages
      const messageInput = document.getElementById("messageInput");
      if (messageInput) {
        messageInput.addEventListener("focus", () => {
          Notification.requestPermission().then(permission => {
            console.log("Notification permission:", permission);
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
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  truncateMessage(text, length = 40) {
    return text && text.length > length ? text.substring(0, length) + "..." : text;
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