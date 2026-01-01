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
    // ✅ RENAMED: Changed from 'storiesContainer' to 'questionsFeedContainer' for clarity
    const container = document.getElementById("questionsFeedContainer") || document.getElementById("storiesContainer");
    
    if (!container) {
        console.warn("Container #questionsFeedContainer not found. Skipping question load.");
        return;
    }

    // Show loading state
    container.innerHTML = `
        <div class="loading-stories">
            <div class="loading-spinner"></div>
            <p>Loading latest questions...</p>
        </div>
    `;

    try {
        const response = await fetch(`${window.API_BASE}/questions/latest?limit=20`, {
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
        }

        console.log(`Loaded ${questions.length} questions`);

        if (questions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No questions found. Be the first to ask one! 💭</p>
                    <a href="/ask" class="answer-btn" style="display:inline-flex; margin-top:10px;">Ask a Question</a>
                </div>
            `;
            return;
        }

        // Render questions
        container.innerHTML = questions
            .map(question => {
                const questionText = escapeHtml(question.question || question.title || '');
                const questionSlug = escapeHtml(question.slug || question.id || '');
                
                // ✅ REMOVED: Username variable
                
                const questionDate = question.created_at || new Date().toISOString();
                const formattedDate = new Date(questionDate).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                
                const answersCount = question.answers_count || 0;
                const likesCount = question.likes_count || 0;
                const viewsCount = question.views_count || 0;

                return `
                    <div class="question-card" data-question-id="${question.id}">
                        <div class="question-header">
                            <span class="question-date">Asked on ${formattedDate}</span>
                        </div>

                        <a href="/question/${questionSlug}" class="question-title">
                            ${questionText}
                        </a>

                        <div class="question-stats">
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                ${answersCount} answers
                            </span>
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                ${likesCount} likes
                            </span>
                            <span class="stat-item">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                ${viewsCount} views
                            </span>
                        </div>

                        <div class="question-actions">
                            <a class="answer-btn" href="/question/${questionSlug}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                Answer
                            </a>
                            <button class="share-btn" 
                                    data-share-url="https://lovculator.com/question/${questionSlug}"
                                    data-share-title="${questionText}"
                                    data-share-text="Check out this question on Lovculator">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                Share
                            </button>
                            <button class="save-btn save-question-btn" data-question-id="${question.id}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                                Save
                            </button>
                        </div>
                    </div>
                `;
            })
            .join('');

        // Attach event listeners
        attachShareButtonListeners();
        attachSaveButtonListeners();

    } catch (error) {
        console.error('Error loading questions:', error);
        container.innerHTML = `
            <div class="error-state">
                <p>Failed to load questions.</p>
                <button onclick="window.loadQuestions()" class="retry-btn">Retry</button>
            </div>
        `;
    }
};

// Helper: Share
function attachShareButtonListeners() {
    document.querySelectorAll('.share-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const shareUrl = this.dataset.shareUrl;
            const shareTitle = this.dataset.shareTitle;
            const shareText = this.dataset.shareText;
            
            if (navigator.share) {
                try {
                    await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                } catch (error) {
                    if (error.name !== 'AbortError') copyToClipboard(shareUrl);
                }
            } else {
                copyToClipboard(shareUrl);
            }
        });
    });
}

// Helper: Copy Fallback
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        if (window.showNotification) showNotification('Link copied! 📋', 'success');
        else alert('Link copied!');
    } catch (err) {
        console.error('Copy failed', err);
    }
}

// Helper: Save (Placeholder Logic)
function attachSaveButtonListeners() {
    document.querySelectorAll('.save-question-btn').forEach(button => {
        button.addEventListener('click', function() {
            const icon = this.querySelector('svg');
            this.classList.toggle('saved');
            if (this.classList.contains('saved')) {
                icon.setAttribute('fill', 'currentColor');
                if(window.showNotification) showNotification('Question saved (Demo)', 'success');
            } else {
                icon.setAttribute('fill', 'none');
            }
        });
    });
}

// Init
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('questionsFeedContainer') || document.getElementById('storiesContainer')) {
        window.loadQuestions();
    }
});

// Add CSS (Cleaned up: removed avatar/username styles)
const style = document.createElement('style');
style.textContent = `
    .loading-stories { text-align: center; padding: 60px 20px; color: #65676b; }
    .loading-spinner { width: 40px; height: 40px; border: 3px solid #f0f2f5; border-top: 3px solid #ff4b8d; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    .empty-state, .error-state { text-align: center; padding: 60px 20px; background: white; border-radius: 12px; border: 1px solid #dddfe2; margin: 20px 0; }
    .retry-btn { background: #ff4b8d; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: 600; }
    
    .question-card { background: white; border-radius: 0px; padding: 20px; margin-bottom: 0px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #f0f2f5; transition: box-shadow 0.2s; }
    .question-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

    /* Cleaned Header */
    .question-header { margin-bottom: 8px; }
    .question-date { font-size: 13px; color: #8e8e8e; font-weight: 500; }

    .question-title { font-size: 1.1rem; font-weight: 700; color: #1c1e21; text-decoration: none; display: block; margin-bottom: 12px; line-height: 1.4; }
    .question-title:hover { color: #ff4b8d; }

    .question-stats { display: flex; gap: 20px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f0f2f5; }
    .stat-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #65676b; }
    
    .question-actions { display: flex; gap: 10px; }
    .answer-btn, .share-btn, .save-btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: background 0.2s; }
    
    .answer-btn { background: white; color: #ff4b8d; text-decoration: none; border: 1px solid #ff4b8d }
    .answer-btn:hover { background: #e83e8c; color: white; }
    
    .share-btn, .save-btn { background: #f0f2f5; color: #65676b; }
    .share-btn:hover, .save-btn:hover { background: #e4e6e9; color: #1c1e21; }
    
    /* Responsive */
    @media (max-width: 600px) {
        .question-card { padding: 15px; }
        .question-title { font-size: 1rem; }
        .question-actions button, .question-actions a { flex: 1; justify-content: center; }
    }
`;
document.head.appendChild(style);