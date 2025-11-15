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
        
        if (this.isLoggedIn) {
            this.updateUnreadCount();
        }
    }

    async checkAuthentication() {
        try {
            const response = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                this.isLoggedIn = true;
                window.currentUser = this.currentUser;
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

    showLoginPrompt() {
        if (confirm('You need to log in to send messages. Go to login page?')) {
            window.location.href = '/login.html';
        }
    }

    // 🆕 IMPROVED: Redirect to messages page instead of modal
    async openMessagesModal(targetUserId = null) {
        console.log('🎯 Opening messages, target user:', targetUserId);
        
        if (!this.isLoggedIn) {
            this.showLoginPrompt();
            return;
        }

        try {
            if (targetUserId) {
                // Redirect to messages page with user pre-selected
                window.location.href = `/messages.html?user=${targetUserId}`;
            } else {
                // Redirect to general messages page
                window.location.href = '/messages.html';
            }
        } catch (error) {
            console.error('❌ Error opening messages:', error);
            alert('Failed to open messages. Please try again.');
        }
    }

    // 🆕 KEEP modal for quick access (optional)
    showMessagesModal() {
        // Your existing modal code...
    }

    // 🆕 IMPROVED: Better error handling
    async loadConversations() {
        const container = document.getElementById('conversationsList');
        if (!container) return;

        // Show loading state
        container.innerHTML = '<div class="loading-state">Loading conversations...</div>';

        try {
            const response = await fetch(`${this.API_BASE}/messages/conversations`, {
                credentials: 'include'
            });

            if (response.status === 401) {
                this.isLoggedIn = false;
                this.showLoginPrompt();
                return;
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load conversations`);

            const conversations = await response.json();
            this.renderConversationsList(conversations);
        } catch (error) {
            console.error('Load conversations error:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>❌ Failed to load conversations</p>
                    <button class="btn btn-primary btn-small" onclick="window.messagesManager.loadConversations()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    // 🆕 IMPROVED: Better conversation rendering
    renderConversationsList(conversations) {
        const container = document.getElementById('conversationsList');
        if (!container) return;

        if (!conversations || conversations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No conversations yet</p>
                    <p class="text-muted">Start a conversation from someone's profile</p>
                </div>
            `;
            return;
        }

        container.innerHTML = conversations.map(conv => {
            // 🆕 FIX: Handle case where participants might be empty
            const otherParticipant = conv.participants && conv.participants.length > 0 
                ? conv.participants[0] 
                : null;
                
            const lastMessage = conv.last_message;
            const unreadCount = conv.unread_count || 0;
            
            if (!otherParticipant) {
                console.warn('No participant found for conversation:', conv.id);
                return '';
            }
            
            return `
                <div class="conversation-item ${this.currentConversation?.id === conv.id ? 'active' : ''}" 
                     data-conversation-id="${conv.id}" 
                     data-user-id="${otherParticipant.id}">
                    <img src="${otherParticipant.avatar_url || '/images/default-avatar.png'}" 
                         alt="${otherParticipant.display_name}" 
                         class="conversation-avatar" 
                         onerror="this.src='/images/default-avatar.png'" />
                    <div class="conversation-info">
                        <div class="conversation-header">
                            <h5>${otherParticipant.display_name || otherParticipant.username || 'Unknown User'}</h5>
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

    // 🆕 IMPROVED: Better conversation handling
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
            
            return conversationId;
            
        } catch (error) {
            console.error('❌ Start conversation error:', error);
            throw error; // Re-throw for calling code to handle
        }
    }

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
            
            // Update active state
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.toggle('active', item.dataset.conversationId === conversationId);
            });

        } catch (error) {
            console.error('Open conversation error:', error);
            alert('Failed to load conversation');
        }
    }

    // 🆕 IMPROVED: Better message rendering with sender info
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

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const messageText = input?.value.trim();
        
        if (!messageText || !this.currentConversation) return;

        // Disable send button during request
        const sendBtn = document.getElementById('sendMessageBtn');
        const originalText = sendBtn.textContent;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

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
        } finally {
            // Re-enable send button
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
        }
    }

    appendMessage(message) {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;

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
            setTimeout(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            }, 100);
        }
    }

    showNewConversationModal() {
        alert('Search and select user feature coming soon! For now, use the "Message" button on user profiles.');
    }

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
        let badge = document.getElementById('messagesBadge');
        if (!badge && count > 0) {
            const messagesLink = document.querySelector('a[href*="messages"]');
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

    // 🆕 IMPROVED: Single global handler
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
        });

        console.log("✅ Global message handlers attached");
    }
}

// 🆕 IMPROVED: Single initialization
document.addEventListener('DOMContentLoaded', () => {
    window.messagesManager = new MessagesManager();
    console.log('✅ messagesManager initialized globally');
});