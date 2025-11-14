/**
 * frontend/js/messages.js — Lovculator 💖
 * Direct Messaging System
 */
class MessagesManager {
    constructor() {
        this.API_BASE = window.API_BASE || 
            (window.location.hostname.includes("localhost") 
                ? "http://localhost:3001/api" 
                : "https://lovculator.com/api");
        
        this.currentConversation = null;
        this.isLoggedIn = false;
        this.currentUser = null;
        
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.attachGlobalHandlers();
        
        // Only initialize messaging if user is logged in
        if (this.isLoggedIn) {
            this.updateUnreadCount();
        }
    }

    // 🆕 Check if user is authenticated
    async checkAuthentication() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.isLoggedIn = true;
                window.currentUser = this.currentUser; // Set global reference
                console.log('✅ User authenticated:', this.currentUser.username);
            } else {
                this.isLoggedIn = false;
                console.log('⚠️ User not authenticated');
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            this.isLoggedIn = false;
        }
    }

    // 🆕 Show login prompt for guest users
    showLoginPrompt() {
        if (confirm('You need to log in to send messages. Go to login page?')) {
            window.location.href = '/login.html';
        }
    }

    // 🆕 Open messages modal with authentication check
    async openMessagesModal(targetUserId = null) {
        console.log('🎯 Opening messages modal, target user:', targetUserId);
        
        if (!this.isLoggedIn) {
            this.showLoginPrompt();
            return;
        }

        try {
            if (targetUserId) {
                console.log('🤝 Starting conversation with user:', targetUserId);
                await this.startConversation(targetUserId);
            } else {
                console.log('📂 Opening conversations list');
            }
            
            this.showMessagesModal();
            await this.loadConversations();
            
        } catch (error) {
            console.error('❌ Error opening messages modal:', error);
            alert('Failed to open messages. Please try again.');
        }
    }

    showMessagesModal() {
        // Create messages modal HTML
        const modalHTML = `
            <div id="messagesModal" class="modal active">
                <div class="modal-dialog modal-lg">
                    <div class="modal-header">
                        <h3>💌 Messages</h3>
                        <button class="close-btn" id="closeMessagesBtn">&times;</button>
                    </div>
                    <div class="messages-container">
                        <div class="conversations-sidebar">
                            <div class="conversations-header">
                                <h4>Conversations</h4>
                                <button id="newConversationBtn" class="btn btn-primary btn-small">+ New</button>
                            </div>
                            <div id="conversationsList" class="conversations-list">
                                <div class="loading-state">Loading conversations...</div>
                            </div>
                        </div>
                        <div class="messages-main">
                            <div id="conversationHeader" class="conversation-header">
                                <div class="empty-state">
                                    <p>Select a conversation to start messaging</p>
                                </div>
                            </div>
                            <div id="messagesList" class="messages-list">
                                <div class="empty-state">
                                    <p>Select a conversation to start messaging</p>
                                </div>
                            </div>
                            <div id="messageInputContainer" class="message-input-container" style="display: none;">
                                <div class="message-input-wrapper">
                                    <input type="text" id="messageInput" placeholder="Type a message..." maxlength="1000" />
                                    <button id="sendMessageBtn" class="btn btn-primary">Send</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('messagesModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.attachModalHandlers();
    }

    attachModalHandlers() {
        // Close modal
        document.getElementById('closeMessagesBtn').addEventListener('click', () => {
            this.closeMessagesModal();
        });
        
        // Send message
        document.getElementById('sendMessageBtn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // New conversation
        document.getElementById('newConversationBtn').addEventListener('click', () => {
            this.showNewConversationModal();
        });

        // Close on background click
        document.getElementById('messagesModal').addEventListener('click', (e) => {
            if (e.target.id === 'messagesModal') this.closeMessagesModal();
        });
    }

    closeMessagesModal() {
        const modal = document.getElementById('messagesModal');
        if (modal) modal.remove();
        this.currentConversation = null;
    }

    // 🆕 Load user's conversations
    async loadConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) return;

        try {
            const response = await fetch(`${this.API_BASE}/messages/conversations`, {
                credentials: 'include'
            });

            if (response.status === 401) {
                this.isLoggedIn = false;
                this.showLoginPrompt();
                return;
            }

            if (!response.ok) throw new Error('Failed to load conversations');

            const conversations = await response.json();
            this.renderConversationsList(conversations);
        } catch (error) {
            console.error('Load conversations error:', error);
            container.innerHTML = '<p class="error-message">Failed to load conversations</p>';
        }
    }

    renderConversationsList(conversations) {
        const container = document.getElementById('conversationsList');
        if (!container) return;

        if (conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No conversations yet</p>
                    <button id="startFirstConversation" class="btn btn-primary btn-small">Start chatting</button>
                </div>
            `;
            document.getElementById('startFirstConversation')?.addEventListener('click', () => {
                this.showNewConversationModal();
            });
            return;
        }

        container.innerHTML = conversations.map(conv => {
            const otherParticipant = conv.participants.find(p => p.id !== this.currentUser?.id);
            const lastMessage = conv.last_message;
            const unreadCount = conv.unread_count || 0;
            
            return `
                <div class="conversation-item ${this.currentConversation?.id === conv.id ? 'active' : ''}" 
                     data-conversation-id="${conv.id}" 
                     data-user-id="${otherParticipant?.id}">
                    <img src="${otherParticipant?.avatar_url || '/images/default-avatar.png'}" 
                         alt="${otherParticipant?.display_name}" 
                         class="conversation-avatar" 
                         onerror="this.src='/images/default-avatar.png'" />
                    <div class="conversation-info">
                        <div class="conversation-header">
                            <h5>${otherParticipant?.display_name || otherParticipant?.username || 'Unknown User'}</h5>
                            ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                        </div>
                        <p class="conversation-preview">
                            ${lastMessage?.message_text ? this.truncateMessage(lastMessage.message_text) : 'No messages yet'}
                        </p>
                        <span class="conversation-time">
                            ${lastMessage ? this.formatTime(lastMessage.created_at) : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                const conversationId = item.dataset.conversationId;
                this.openConversation(conversationId);
            });
        });
    }

    // 🆕 Start new conversation - FIXED VERSION
async startConversation(targetUserId) {
    try {
        console.log('🤝 Starting conversation with user:', targetUserId);
        
        const response = await fetch(`${this.API_BASE}/messages/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ targetUserId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create conversation');
        }

        const { conversationId } = await response.json();
        console.log('✅ Conversation created:', conversationId);
        
        // 🟢 CRITICAL: Load the conversation immediately
        await this.openConversation(conversationId);
        
    } catch (error) {
        console.error('❌ Start conversation error:', error);
        alert(error.message || 'Failed to start conversation');
    }
}

    // 🆕 Open existing conversation
    async openConversation(conversationId) {
        try {
            const response = await fetch(`${this.API_BASE}/messages/conversations/${conversationId}/messages`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load messages');

            const messages = await response.json();
            this.currentConversation = { id: conversationId, messages };
            
            this.renderConversation(messages);
            this.showMessageInput();
            
            // Update active state in conversations list
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.toggle('active', item.dataset.conversationId === conversationId);
            });

        } catch (error) {
            console.error('Open conversation error:', error);
            alert('Failed to load conversation');
        }
    }

    renderConversation(messages) {
        const messagesList = document.getElementById('messagesList');
        const conversationHeader = document.getElementById('conversationHeader');
        
        if (!messagesList || !conversationHeader) return;

        // Update conversation header
        conversationHeader.innerHTML = `
            <div class="conversation-info">
                <h4>Conversation</h4>
            </div>
        `;
        
        // Render messages
        messagesList.innerHTML = messages.length === 0 
            ? '<div class="empty-state"><p>No messages yet. Start the conversation!</p></div>'
            : messages.map(msg => this.renderMessage(msg)).join('');

        this.scrollToBottom();
    }

    renderMessage(message) {
        const isOwnMessage = message.sender_id === this.currentUser?.id;
        
        return `
            <div class="message ${isOwnMessage ? 'own-message' : 'other-message'}">
                <div class="message-bubble">
                    <p class="message-text">${this.escapeHtml(message.message_text)}</p>
                    <span class="message-time">${this.formatTime(message.created_at)}</span>
                </div>
            </div>
        `;
    }

    // 🆕 Send message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input?.value.trim();
        
        if (!messageText || !this.currentConversation) return;

        try {
            const response = await fetch(`${this.API_BASE}/messages/conversations/${this.currentConversation.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message_text: messageText })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const newMessage = await response.json();
            this.appendMessage(newMessage);
            input.value = '';
            this.scrollToBottom();

            // Reload conversations to update last message
            this.loadConversations();

        } catch (error) {
            console.error('Send message error:', error);
            alert('Failed to send message');
        }
    }

    appendMessage(message) {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

        // Remove empty state if present
        const emptyState = messagesList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        messagesList.insertAdjacentHTML('beforeend', this.renderMessage(message));
    }

    showMessageInput() {
        const inputContainer = document.getElementById('messageInputContainer');
        if (inputContainer) inputContainer.style.display = 'block';
    }

    scrollToBottom() {
        const messagesList = document.getElementById('messagesList');
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }

    // 🆕 Show new conversation modal
    async showNewConversationModal() {
        alert('Search and select user feature coming soon! For now, use the "Message" button on user profiles.');
    }

    // 🆕 Update global unread count (for navbar badge)
    async updateUnreadCount() {
        if (!this.isLoggedIn) return;
        
        try {
            const response = await fetch(`${this.API_BASE}/messages/unread-count`, {
                credentials: 'include'
            });

            if (response.ok) {
                const { count } = await response.json();
                this.updateUnreadBadge(count);
            }
        } catch (error) {
            console.error('Update unread count error:', error);
        }
    }

    updateUnreadBadge(count) {
        // Update navbar badge
        let badge = document.getElementById('messagesBadge');
        if (!badge && count > 0) {
            const messagesLink = document.querySelector('a[href*="messages"], #messagesNavLink');
            if (messagesLink) {
                badge = document.createElement('span');
                badge.id = 'messagesBadge';
                badge.className = 'nav-badge';
                messagesLink.appendChild(badge);
            }
        }
        
        if (badge) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // Utility methods
    truncateMessage(text, length = 30) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    attachGlobalHandlers() {
        console.log("🔧 Attaching global message handlers...");

    document.addEventListener("click", (e) => {
        const messageButton = e.target.closest("#messageUserBtn, .message-user-btn");

        if (messageButton) {
            e.preventDefault();
            e.stopPropagation();

            const userId = messageButton.dataset.userId;
            console.log("💌 Message button clicked for user:", userId);

            if (!userId) return;

            if (!this.isLoggedIn) {
                this.showLoginPrompt();
            } else {
                this.openMessagesModal(userId);
            }
            return;
        }

        const messagesLink = e.target.closest("#messagesNavLink");
        if (messagesLink) {
            e.preventDefault();
            e.stopPropagation();

            console.log("📨 Messages nav link clicked");

            if (!this.isLoggedIn) {
                this.showLoginPrompt();
            } else {
                this.openMessagesModal();
            }
        }
    });

    console.log("✅ Global message handlers attached");
  }
}  // <--- VERY IMPORTANT: close class here ✔️

// --- GLOBAL CLICK HANDLER TO CATCH PROFILE MESSAGE BUTTON ---
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".message-user-btn");
    if (!btn) return;

    const userId = btn.dataset.userId;
    console.log("💌 Global handler → Message button clicked, user:", userId);

    if (!window.messagesManager?.isLoggedIn) {
        window.messagesManager?.showLoginPrompt();
        return;
    }

    window.messagesManager?.openMessagesModal(userId);
});


// At the VERY END of messages.js, add:
document.addEventListener('DOMContentLoaded', () => {
    window.messagesManager = new MessagesManager();
    console.log('✅ messagesManager initialized globally');
});