// Set API Base globally
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

// XSS Protection Helper
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Make function globally available
window.loadQuestions = async function() {
    const container = document.getElementById("storiesContainer");
    if (!container) {
        console.error("Container #storiesContainer not found");
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div class="loading-stories">
            <div class="loading-spinner"></div>
            <p>Loading questions...</p>
        </div>
    `;

    try {
        const response = await fetch(`${window.API_BASE}/questions/latest`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load questions`);
        }

        const data = await response.json();
        
        // Handle different response formats
        let questions = [];
        if (Array.isArray(data)) {
            questions = data;
        } else if (data && Array.isArray(data.questions)) {
            questions = data.questions;
        } else if (data && Array.isArray(data.data)) {
            questions = data.data;
        } else if (data && data.items && Array.isArray(data.items)) {
            questions = data.items;
        }

        console.log(`Loaded ${questions.length} questions`);

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No questions found. Be the first to ask one! 💭</p>
                </div>
            `;
            return;
        }

        // Render questions
        container.innerHTML = questions
            .map(question => {
                // Extract question data with fallbacks
                // Apply escaping to user content
                const questionText = escapeHtml(question.question || question.title || question.content || '');
                const questionSlug = escapeHtml(question.slug || question.id || '');
                const username = escapeHtml(question.username || 'Anonymous');
                
                const questionDate = question.created_at || question.date || new Date().toISOString();
                const formattedDate = new Date(questionDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                // Question stats
                const answersCount = question.answers_count || question.answer_count || 0;
                const likesCount = question.likes_count || question.like_count || 0;
                const viewsCount = question.views_count || question.view_count || 0;

                return `
                    <div class="question-card" data-question-id="${question.id || ''}">
                        <!-- Question Header -->
                        <div class="question-header">
                            <div class="question-user-info">
                                <img src="${question.avatar_url || '/images/default-avatar.png'}" 
                                     alt="${username}" 
                                     class="question-avatar"
                                     onerror="this.src='/images/default-avatar.png'">
                                <div class="question-user-details">
                                    <span class="question-username">${username}</span>
                                    <span class="question-date">${formattedDate}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Question Text -->
                        <a href="/question/${questionSlug}" class="question-title">
                            ${questionText}
                        </a>

                        <!-- Question Stats -->
                        <div class="question-stats">
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                ${answersCount} answers
                            </span>
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                ${likesCount} likes
                            </span>
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                ${viewsCount} views
                            </span>
                        </div>

                        <!-- Question Actions -->
                        <div class="question-actions">
                            <a class="answer-btn" href="/question/${questionSlug}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                </svg>
                                Answer
                            </a>
                            <button class="share-btn" 
                                    data-share-url="https://lovculator.com/question/${questionSlug}"
                                    data-share-title="${questionText}"
                                    data-share-text="Check out this question on Lovculator">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                    <polyline points="16 6 12 2 8 6"></polyline>
                                    <line x1="12" y1="2" x2="12" y2="15"></line>
                                </svg>
                                Share
                            </button>
                            <button class="save-btn" data-question-id="${question.id || ''}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                </svg>
                                Save
                            </button>
                        </div>
                    </div>
                `;
            })
            .join('');

        // Attach event listeners to share buttons
        attachShareButtonListeners();

    } catch (error) {
        console.error('Error loading questions:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Failed to load questions. Please try again.</p>
                <button onclick="window.loadQuestions()" class="retry-btn">Retry</button>
            </div>
        `;
    }
};

// Helper function to attach share button listeners
function attachShareButtonListeners() {
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const shareUrl = this.dataset.shareUrl;
            const shareTitle = this.dataset.shareTitle || 'Question on Lovculator';
            const shareText = this.dataset.shareText || 'Check this out!';
            
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: shareTitle,
                        text: shareText,
                        url: shareUrl,
                    });
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        // Fallback to clipboard
                        await navigator.clipboard.writeText(shareUrl);
                        if (window.showNotification) {
                            showNotification('Link copied to clipboard! 📋', 'success');
                        } else {
                            alert('Link copied to clipboard!');
                        }
                    }
                }
            } else {
                // Fallback for browsers without Web Share API
                await navigator.clipboard.writeText(shareUrl);
                if (window.showNotification) {
                    showNotification('Link copied to clipboard! 📋', 'success');
                } else {
                    alert('Link copied to clipboard!');
                }
            }
        });
    });
}

// Load questions on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing questions...');
    
    // Check if we're on a page that needs questions
    if (document.getElementById('storiesContainer')) {
        // Wait a bit for other scripts to load
        setTimeout(() => {
            window.loadQuestions();
        }, 300);
    }
});

// Add CSS for loading spinner and states
const style = document.createElement('style');
style.textContent = `
    .loading-stories {
        text-align: center;
        padding: 60px 20px;
        color: #65676b;
    }
    
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid #f0f2f5;
        border-top: 3px solid #ff4b8d;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .empty-state, .error-state {
        text-align: center;
        padding: 60px 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid #dddfe2;
        margin: 20px 0;
    }
    
    .empty-state p, .error-state p {
        margin: 0 0 20px 0;
        color: #65676b;
    }
    
    .retry-btn {
        background: #ff4b8d;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 20px;
        cursor: pointer;
        font-weight: 600;
    }
    
    .question-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        border: 1px solid #eee;
    }
    
    .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }
    
    .question-user-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .question-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #ff4b8d20;
    }
    
    .question-user-details {
        display: flex;
        flex-direction: column;
    }
    
    .question-username {
        font-weight: 600;
        font-size: 14px;
        color: #1c1e21;
    }
    
    .question-date {
        font-size: 12px;
        color: #65676b;
    }
    
    .question-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: #222;
        text-decoration: none;
        display: block;
        margin-bottom: 15px;
        line-height: 1.4;
    }
    
    .question-title:hover {
        text-decoration: underline;
        color: #ff4b8d;
    }
    
    .question-stats {
        display: flex;
        gap: 20px;
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid #f0f2f5;
    }
    
    .stat-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: #65676b;
    }
    
    .question-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
    }
    
    .answer-btn, .share-btn, .save-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    
    .answer-btn {
        background: #ff4b8d;
        color: white;
        text-decoration: none;
    }
    
    .answer-btn:hover {
        background: #e83e8c;
    }
    
    .share-btn, .save-btn {
        background: #f0f2f5;
        color: #65676b;
        border: 1px solid #ddd;
    }
    
    .share-btn:hover, .save-btn:hover {
        background: #e4e6e9;
    }
    
    @media (max-width: 600px) {
        .question-card {
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .question-title {
            font-size: 1.1rem;
        }
        
        .question-stats {
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .stat-item {
            font-size: 13px;
        }
        
        .question-actions {
            flex-wrap: wrap;
        }
        
        .answer-btn, .share-btn, .save-btn {
            flex: 1;
            min-width: 100px;
            justify-content: center;
        }
    }
`;
document.head.appendChild(style);