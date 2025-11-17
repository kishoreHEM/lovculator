/**
 * frontend/js/messages.js — Lovculator 💖
 * Unified messaging script:
 * - Global "Message" buttons + unread badge
 * - Full WhatsApp-style chat UI on messages.html
 */

class MessagesPage {
  constructor() {
    this.API_BASE =
      window.API_BASE ||
      (window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api");

    this.isMessagesPage = document.body.classList.contains("messages-page");

    // Shared state
    this.currentUser = null;
    this.isLoggedIn = false;

    // Chat-page specific state
    this.currentConversation = null;
    this.conversations = [];
    this.ws = null;
    this.typingTimeout = null;
    this.isTyping = false;

    this.init();
  }

  /* ======================================================
     INIT
  ====================================================== */
  async init() {
    await this.checkAuth();

    // Global handlers: "Message" buttons, unread badge
    this.attachGlobalHandlers();

    // Only run full chat logic on messages.html
    if (!this.isMessagesPage || !this.isLoggedIn) return;

    await this.loadConversations();
    this.attachChatEventListeners();
    this.connectWebSocket();

    // Auto-open ?user=ID
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get("user");
    if (targetUser) {
      await this.startConversationWithUser(targetUser);
    }
  }

  /* ======================================================
     AUTH
  ====================================================== */
  async checkAuth() {
    try {
      console.log("🌍 Using Root API Base URL:", this.API_BASE);
      const res = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: "include",
      });

      if (res.ok) {
        this.currentUser = await res.json();
        this.isLoggedIn = true;
        window.currentUser = this.currentUser;
        console.log("✅ User authenticated:", this.currentUser.username);
      } else {
        this.isLoggedIn = false;
        console.log("⚠️ User not authenticated");

        // If we're on messages page and not logged in → redirect
        if (this.isMessagesPage) {
          window.location.href = "/login.html";
        }
      }
    } catch (err) {
      console.error("❌ Auth check failed:", err);
      this.isLoggedIn = false;
      if (this.isMessagesPage) {
        window.location.href = "/login.html";
      }
    }
  }

  showLoginPrompt() {
    if (confirm("You need to log in to send messages. Go to login page?")) {
      window.location.href = "/login.html";
    }
  }

  /* ======================================================
     GLOBAL HANDLERS (ALL PAGES)
  ====================================================== */
  attachGlobalHandlers() {
    console.log("🔧 Attaching global message handlers...");

    // Profile / cards "Message" button
    document.addEventListener("click", (e) => {
      const messageButton = e.target.closest(
        "#messageUserBtn, .message-user-btn"
      );
      if (!messageButton) return;

      e.preventDefault();
      e.stopPropagation();

      const userId = messageButton.dataset.userId;
      console.log("💌 Message button clicked for user:", userId);
      if (!userId) return;

      if (!this.isLoggedIn) {
        this.showLoginPrompt();
      } else {
        this.openMessages(userId);
      }
    });

    // Unread badge in navbar
    if (this.isLoggedIn) {
      this.updateUnreadCount();
    }

    console.log("✅ Global message handlers attached");
  }

  openMessages(targetUserId = null) {
    try {
      if (targetUserId) {
        window.location.href = `/messages.html?user=${targetUserId}`;
      } else {
        window.location.href = "/messages.html";
      }
    } catch (err) {
      console.error("❌ Error opening messages:", err);
      alert("Failed to open messages. Please try again.");
    }
  }

  async updateUnreadCount() {
    try {
      const res = await fetch(`${this.API_BASE}/messages/unread-count`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const { count } = await res.json();
      this.updateUnreadBadge(count);
    } catch (err) {
      console.error("Update unread count error:", err);
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
    }
  }

  /* ======================================================
     WEBSOCKET (MESSAGES PAGE)
  ====================================================== */
  connectWebSocket() {
    try {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener("open", () => {
        console.log("🔌 WS connected");
      });

      this.ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data);
        this.handleRealtimeEvent(msg);
      });

      this.ws.addEventListener("close", () => {
        console.log("⚠️ WS closed, will retry...");
        // Simple reconnect
        setTimeout(() => this.connectWebSocket(), 3000);
      });
    } catch (err) {
      console.error("WS init error:", err);
    }
  }

  sendWS(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  handleRealtimeEvent(msg) {
    switch (msg.type) {
      case "new_message":
        this.handleNewMessageEvent(msg);
        break;
      case "typing":
        this.handleTypingEvent(msg);
        break;
      case "message_seen":
        this.handleSeenEvent(msg);
        break;
      case "presence":
        this.handlePresenceEvent(msg);
        break;
      case "message_edited":
        this.handleEditedEvent(msg);
        break;
      case "message_deleted":
        this.handleDeletedEvent(msg);
        break;
      default:
        break;
    }
  }

  handleNewMessageEvent({ message }) {
    const convId = message.conversation_id;
    if (this.currentConversation?.id === convId) {
      this.appendMessage(message);
      this.scrollToBottom();
      if (this.currentConversation.messages) {
        this.currentConversation.messages.push(message);
      }
    }
    this.loadConversations();
    this.updateUnreadCount();
  }

  handleTypingEvent({ fromUserId, conversationId }) {
    if (!this.currentConversation || this.currentConversation.id !== conversationId) return;
    if (fromUserId === this.currentUser?.id) return;

    const statusEl = document.getElementById("currentChatStatus");
    if (!statusEl) return;
    statusEl.textContent = "Typing...";
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      statusEl.innerHTML = `<span class="online-indicator"></span> Online`;
    }, 2000);
  }

  handleSeenEvent({ conversationId }) {
    if (!this.currentConversation || this.currentConversation.id !== conversationId) return;
    console.log("✅ Messages marked as seen in this conversation");
    // (Optional) you can update double-tick UI here
  }

  handlePresenceEvent({ userId, isOnline, lastSeenAt }) {
    if (!this.isMessagesPage || !this.currentConversation) return;

    const conv = this.conversations.find(
      (c) => c.id === this.currentConversation.id
    );
    const other = conv?.participants?.[0];
    if (!other || other.id !== userId) return;

    const statusEl = document.getElementById("currentChatStatus");
    if (!statusEl) return;

    if (isOnline) {
      statusEl.innerHTML = `<span class="online-indicator"></span> Online`;
    } else {
      if (lastSeenAt) {
        const d = new Date(lastSeenAt);
        const today = new Date();
        const sameDay = d.toDateString() === today.toDateString();
        const time = d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        statusEl.textContent = sameDay
          ? `Last seen today at ${time}`
          : `Last seen on ${d.toLocaleDateString()} at ${time}`;
      } else {
        statusEl.textContent = "Last seen recently";
      }
    }
  }

  handleEditedEvent({ message }) {
    if (!this.currentConversation || this.currentConversation.id !== message.conversation_id) return;
    const el = document.querySelector(
      `[data-message-id="${message.id}"] .message-text`
    );
    if (el) {
      el.innerHTML =
        this.escapeHtml(message.message_text || "") + " <small>(edited)</small>";
    }
  }

  handleDeletedEvent({ messageId, conversationId }) {
    if (!this.currentConversation || this.currentConversation.id !== conversationId) return;
    const el = document.querySelector(
      `[data-message-id="${messageId}"] .message-text`
    );
    if (el) {
      el.textContent = "[deleted]";
    }
  }

  /* ======================================================
     CONVERSATIONS LIST (MESSAGES PAGE)
  ====================================================== */
  async loadConversations() {
    if (!this.isMessagesPage) return;
    const container = document.getElementById("conversationsList");
    if (!container) return;

    try {
      const res = await fetch(`${this.API_BASE}/messages/conversations`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load conversations");

      this.conversations = await res.json();
      this.renderConversationsList();
    } catch (err) {
      console.error("Load conversations error:", err);
      container.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">😔</div>
          <h3>Failed to load conversations</h3>
          <p>Please check your connection and try again</p>
          <button class="start-chatting-btn" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }

  renderConversationsList() {
    const container = document.getElementById("conversationsList");
    if (!container) return;

    // Remove skeleton
    container.innerHTML = "";

    if (!this.conversations || this.conversations.length === 0) {
      container.innerHTML = `
        <div class="empty-conversations">
          <div class="empty-icon">💬</div>
          <h3>No conversations yet</h3>
          <p>Start a conversation with someone to see it here</p>
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
          <div class="conversation-item ${
            isActive ? "active" : ""
          } ${unreadCount > 0 ? "unread" : ""}"
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
                  ${
                    lastMessage
                      ? this.formatTime(lastMessage.created_at)
                      : ""
                  }
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
                <div class="online-indicator"></div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".conversation-item").forEach((item) => {
      item.addEventListener("click", () => {
        const conversationId = item.dataset.conversationId;
        this.openConversation(conversationId);
      });
    });
  }

  /* ======================================================
     OPEN CONVERSATION + PAGINATION
  ====================================================== */
  async openConversation(conversationId, options = {}) {
    if (!this.isMessagesPage) return;

    const limit = options.limit || 30;
    const before = options.before || null;

    const params = new URLSearchParams({ limit });
    if (before) params.append("before", before);

    try {
      const res = await fetch(
        `${this.API_BASE}/messages/conversations/${conversationId}/messages?${params.toString()}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load messages");

      const fetched = await res.json(); // newest → oldest
      const newMessages = fetched.reverse(); // oldest → newest

      if (
        !this.currentConversation ||
        this.currentConversation.id !== Number(conversationId) ||
        !before
      ) {
        this.currentConversation = {
          id: Number(conversationId),
          messages: [...newMessages],
        };
        this.renderConversation(newMessages);
      } else {
        // pagination: older messages
        this.currentConversation.messages = [
          ...newMessages,
          ...this.currentConversation.messages,
        ];
        this.prependMessages(newMessages);
      }

      this.showMessageInput();

      document.querySelectorAll(".conversation-item").forEach((item) => {
        item.classList.toggle(
          "active",
          item.dataset.conversationId === String(conversationId)
        );
      });

      const container = document.querySelector(".messages-container");
      const messagesMain = document.getElementById("messagesMain");
      if (messagesMain) messagesMain.classList.add("active");
      if (window.innerWidth <= 768 && container) container.classList.add("chat-open");

      await this.markConversationSeen(conversationId);
    } catch (err) {
      console.error("Open conversation error:", err);
      alert("Failed to load conversation");
    }
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
    } catch (err) {
      console.error("mark seen error", err);
    }
  }

  renderConversation(messages) {
    const messagesList = document.getElementById("messagesList");
    const currentChatName = document.getElementById("currentChatName");
    const currentChatAvatar = document.getElementById("currentChatAvatar");

    if (!messagesList) return;

    if (!messages.length) {
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
      currentChatName.textContent =
        otherParticipant.display_name || otherParticipant.username;
      currentChatAvatar.src =
        otherParticipant.avatar_url || "/images/default-avatar.png";
      document.getElementById("currentChatStatus").innerHTML = `
        <span class="online-indicator"></span> Online
      `;
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
      ? "[deleted]"
      : this.escapeHtml(message.message_text || "");

    const editedTag = edited ? `<small>(edited)</small>` : "";

    const attachmentHtml = hasAttachment
      ? `<div class="attachment">
          <a href="${message.attachment_url}" target="_blank">Attachment</a>
         </div>`
      : "";

    return `
      <div class="message ${isOwnMessage ? "own-message" : "other-message"}"
           data-message-id="${message.id}">
        <div class="message-bubble">
          ${attachmentHtml}
          <p class="message-text">${safeText} ${editedTag}</p>
          <div class="message-meta">
            <span class="message-time">${this.formatTime(
              message.created_at
            )}</span>
            ${
              isOwnMessage
                ? `<div class="message-status">✓✓</div>`
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  /* ======================================================
     SEND MESSAGE
  ====================================================== */
  async sendMessage(attachmentMeta = null) {
    if (!this.isMessagesPage) return;

    const input = document.getElementById("messageInput");
    const messageText = input?.value.trim();
    if (!messageText && !attachmentMeta) return;
    if (!this.currentConversation) return;

    const body = { message_text: messageText || null };

    if (attachmentMeta) {
      body.attachment_type = attachmentMeta.type;
      body.attachment_url = attachmentMeta.url;
    }

    try {
      const res = await fetch(
        `${this.API_BASE}/messages/conversations/${this.currentConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to send message");

      const newMessage = await res.json();
      this.appendMessage(newMessage);
      if (input) input.value = "";
      this.scrollToBottom();
      if (this.currentConversation?.messages) {
        this.currentConversation.messages.push(newMessage);
      }

      this.loadConversations();
      this.updateUnreadCount();
    } catch (err) {
      console.error("Send message error:", err);
      alert("Failed to send message");
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

  /* ======================================================
     CHAT EVENT LISTENERS
  ====================================================== */
  attachChatEventListeners() {
    if (!this.isMessagesPage) return;

    const sendBtn = document.getElementById("sendMessageBtn");
    const messageInput = document.getElementById("messageInput");
    const searchInput = document.getElementById("searchConversations");
    const backBtn = document.getElementById("backToList");
    const messagesList = document.getElementById("messagesList");
    const attachBtn = document.getElementById("attachBtn");
    const attachInput = document.getElementById("attachInput");
    const micBtn = document.getElementById("micBtn");
    const emojiBtn = document.getElementById("emojiBtn");

    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    if (messageInput) {
      messageInput.addEventListener("input", () => this.handleTyping());
      messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
      messageInput.addEventListener("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterConversations(e.target.value);
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        const container = document.querySelector(".messages-container");
        const messagesMain = document.getElementById("messagesMain");
        if (container) container.classList.remove("chat-open");
        if (messagesMain) messagesMain.classList.remove("active");
      });
    }

    if (messagesList) {
      messagesList.addEventListener("scroll", () => {
        if (
          messagesList.scrollTop < 50 &&
          this.currentConversation?.messages?.length
        ) {
          const oldest = this.currentConversation.messages[0];
          if (!oldest) return;
          this.openConversation(this.currentConversation.id, {
            before: oldest.created_at,
            limit: 20,
          });
        }
      });
    }

    if (attachBtn && attachInput) {
      attachBtn.addEventListener("click", () => attachInput.click());
      attachInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const meta = await this.uploadAttachment(file);
        if (meta) this.sendMessage(meta);
        e.target.value = "";
      });
    }

    if (micBtn) {
      micBtn.addEventListener("click", () => {
        alert("Voice note recording can be added here (MediaRecorder API).");
      });
    }

    if (emojiBtn) {
      emojiBtn.addEventListener("click", () => {
        alert("Emoji picker integration placeholder (e.g. emoji-mart).");
      });
    }

    window.addEventListener("resize", () => {
      const container = document.querySelector(".messages-container");
      if (window.innerWidth > 768 && container) {
        container.classList.remove("chat-open");
      }
    });
  }

  handleTyping() {
    if (!this.currentConversation || !this.isMessagesPage) return;
    if (this.isTyping) return;

    this.isTyping = true;
    const conv = this.conversations.find(
      (c) => c.id === this.currentConversation.id
    );
    const other = conv?.participants?.[0];

    if (other) {
      this.sendWS({
        type: "typing",
        conversationId: this.currentConversation.id,
        toUserId: other.id,
      });
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
    }, 2500);
  }

  filterConversations(searchTerm) {
    const items = document.querySelectorAll(".conversation-item");
    const search = (searchTerm || "").toLowerCase();

    items.forEach((item) => {
      const name =
        item
          .querySelector(".conversation-name")
          ?.textContent.toLowerCase() || "";
      const preview =
        item
          .querySelector(".conversation-preview")
          ?.textContent.toLowerCase() || "";
      item.style.display =
        name.includes(search) || preview.includes(search) ? "flex" : "none";
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
    } catch (err) {
      console.error("Start conversation error:", err);
      alert("Failed to start conversation");
    }
  }

  /* ======================================================
     UPLOAD ATTACHMENT
  ====================================================== */
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
      alert("Failed to upload attachment");
      return null;
    }
  }

  /* ======================================================
     UTILS
  ====================================================== */
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
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  truncateMessage(text, length = 40) {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

/* ======================================================
   BOOTSTRAP
====================================================== */
document.addEventListener("DOMContentLoaded", () => {
  window.messagesPage = new MessagesPage();
  console.log("✅ messagesPage initialized globally");
});
