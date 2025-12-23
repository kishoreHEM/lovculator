// Set API Base globally
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

// Get slug from URL
// Get slug from URL (Handles "/question/slug" or fallback to "?slug=")
let slug = new URLSearchParams(window.location.search).get("slug");

if (!slug) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    // If URL is /question/my-cool-title, slug is the last part
    if (pathParts.includes('question')) {
        slug = pathParts[pathParts.length - 1];
    }
}

// Make functions globally available
window.loadQuestion = async function() {
    if (!slug) {
        showNotFound("No question specified");
        return;
    }

    const questionContainer = document.getElementById("questionContainer");
    const answersContainer = document.getElementById("answersContainer");
    const answerFormContainer = document.getElementById("answerFormContainer");
    
    if (!questionContainer) {
        console.error("Question container not found");
        return;
    }

    // Show loading state
    questionContainer.innerHTML = `
        <div class="loading-question">
            <div class="loading-spinner"></div>
            <p>Loading question...</p>
        </div>
    `;

    if (answersContainer) answersContainer.innerHTML = '';
    if (answerFormContainer) answerFormContainer.innerHTML = '';

    try {
        const response = await fetch(`${window.API_BASE}/questions/${slug}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                showNotFound("Question not found");
            } else {
                throw new Error(`HTTP ${response.status}: Failed to load question`);
            }
            return;
        }

        const question = await response.json();
        
        // Update page title
        document.title = `${question.question || question.title || 'Question'} • Lovculator`;

        // Render question
        questionContainer.innerHTML = `
            <div class="question-container">
                <div class="question-header">
                    <div class="question-user-info">
                        <img src="${question.user_avatar || question.avatar_url || '/images/default-avatar.png'}" 
                             alt="${question.username || 'User'}" 
                             class="question-avatar">
                        <div class="question-user-details">
                            <span class="question-username">${question.username || 'Anonymous'}</span>
                            <span class="question-date">${formatDate(question.created_at)}</span>
                        </div>
                    </div>
                </div>
                
                <h1 class="question-text">${question.question || question.title || ''}</h1>
                
                ${question.description ? `<p class="question-description">${question.description}</p>` : ''}
                
                <div class="question-stats">
                    <span class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        ${question.answers_count || question.answer_count || 0} answers
                    </span>
                    <span class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                        ${question.likes_count || question.like_count || 0} likes
                    </span>
                    <span class="stat-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        ${question.views_count || question.view_count || 0} views
                    </span>
                </div>
                
                <div class="question-tags">
                    ${(question.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;

        // Check if unanswered page
        const isUnanswered = window.location.pathname.includes("unanswered");
        
        // Handle answers
        let answers = [];
        if (Array.isArray(question.answers)) {
            answers = question.answers;
        } else if (question.answers && Array.isArray(question.answers.data)) {
            answers = question.answers.data;
        } else if (question.answers && Array.isArray(question.answers.items)) {
            answers = question.answers.items;
        }

        if (answers.length === 0 && isUnanswered) {
            renderUnanswered(question);
        } else {
            renderAnswerList(question, answers);
        }

        // Render answer form (if allowed)
        if (!isUnanswered && answers.length < 20) { // Increased limit from 5 to 20
            renderAnswerForm(question);
        }

        // Attach event listeners
        attachSocialEventListeners();

    } catch (error) {
        console.error('Error loading question:', error);
        showNotFound("Failed to load question. Please try again.");
    }
};

// Helper function to format date
function formatDate(dateString) {
    if (!dateString) return 'Recently';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotFound(message = "Question not found") {
    const questionContainer = document.getElementById("questionContainer");
    if (questionContainer) {
        questionContainer.innerHTML = `
            <div class="not-found">
                <h2>${message}</h2>
                <p>The question you're looking for doesn't exist or has been removed.</p>
                <a href="/answer" class="back-btn">Back to Questions</a>
            </div>
        `;
    }
}

/* ---------------------------------------------------------
   ANSWER LIST (Fixed Follow Button State)
--------------------------------------------------------- */
function renderAnswerList(question, answers) {
    const answersContainer = document.getElementById("answersContainer");
    if (!answersContainer) return;

    if (answers.length === 0) {
        answersContainer.innerHTML = `
            <div class="empty-answers">
                <p>No answer yet. Be the first to answer! 💭</p>
            </div>
        `;
        return;
    }

    answersContainer.innerHTML = answers
        .map(answer => {
            const answerId = answer.id || '';
            const userId = answer.user_id || answer.author_id || '';
            const userName = answer.display_name || answer.username || answer.author_name || 'User';
            const userBio = answer.bio || answer.author_bio || '';
            const answerText = answer.answer || answer.content || answer.text || '';
            const answerDate = answer.created_at || answer.date || '';
            const likeCount = answer.likes_count || answer.like_count || 0;
            const commentCount = answer.comments_count || answer.comment_count || 0;
            const userAvatar = answer.profile_image_url || answer.avatar_url || answer.author_avatar || '/images/default-avatar.png';
            
            // ✅ NEW: Check following status from backend
            const isFollowing = answer.user_following || false;
            const followText = isFollowing ? "Following" : "+ Follow";
            const followClass = isFollowing ? "follow-btn following" : "follow-btn";

            return `
                <div class="answer-card" data-answer-id="${answerId}" data-user-id="${userId}">
                    <div class="answer-header">
                        <img src="${userAvatar}" 
                             alt="${userName}" 
                             class="answer-avatar"
                             onerror="this.src='/images/default-avatar.png'">
                        <div class="answer-user-info">
                            <div class="answer-user-name">
                                <a href="/profile/${encodeURIComponent(userName)}" class="user-link">
                                    ${userName}
                                </a>
                                ${userId && userId !== window.currentUserId ? 
                                    `<button class="${followClass}" data-user-id="${userId}">${followText}</button>` : 
                                    ''}
                            </div>
                            ${userBio ? `<div class="answer-user-bio">${userBio}</div>` : ''}
                        </div>
                    </div>

                    <div class="answer-body">${answerText}</div>

                    <div class="answer-actions">
                        <button class="like-button ${answer.user_liked ? 'liked' : ''}" data-id="${answerId}" data-type="answer">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="${answer.user_liked ? '#e91e63' : 'none'}" stroke="${answer.user_liked ? '#e91e63' : 'currentColor'}" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                            <span class="like-count">${likeCount}</span>
                        </button>

                        <button class="comment-toggle" data-id="${answerId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <span class="comment-count">${commentCount}</span>
                        </button>

                        <button class="share-btn" 
                                data-share-url="https://lovculator.com/questions/${question.slug}#answer-${answerId}"
                                data-share-title="${userName}'s answer"
                                data-share-text="${answerText.substring(0, 100)}...">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                <polyline points="16 6 12 2 8 6"></polyline>
                                <line x1="12" y1="2" x2="12" y2="15"></line>
                            </svg>
                            <span>Share</span>
                        </button>
                    </div>

                    <div id="comments-${answerId}" class="comments-section hidden">
                        <div class="comment-form">
                            <input type="text" 
                                   class="comment-input" 
                                   data-answer-id="${answerId}" 
                                   placeholder="Write a comment…">
                            <button class="comment-submit" data-answer-id="${answerId}">Post</button>
                        </div>
                        <div class="comments-list" id="comments-list-${answerId}"></div>
                    </div>

                    <div class="answer-footer">
                        Answered ${formatDate(answerDate)}
                    </div>
                </div>
            `;
        })
        .join('');
}

/* ---------------------------------------------------------
   UNANSWERED PAGE
--------------------------------------------------------- */
function renderUnanswered(question) {
    const answersContainer = document.getElementById("answersContainer");
    if (!answersContainer) return;

    answersContainer.innerHTML = `
        <div class="unanswered-section">
            <h3>This question hasn't been answered yet</h3>
            <p>Be the first to share your wisdom and help others!</p>
            <div class="unanswered-actions">
                <button class="answer-now-btn" onclick="scrollToAnswerForm()">Answer Now</button>
                <button class="share-question-btn" 
                        data-share-url="https://lovculator.com/question/${question.slug || question.id}"
                        data-share-title="${question.question || question.title}"
                        data-share-text="Can you help answer this question?">
                    Share to Get Answers
                </button>
            </div>
        </div>
    `;
}

/* ---------------------------------------------------------
   ANSWER FORM
--------------------------------------------------------- */
function renderAnswerForm(question) {
    const answerFormContainer = document.getElementById("answerFormContainer");
    if (!answerFormContainer) return;

    answerFormContainer.innerHTML = `
        <div class="answer-form">
            <div class="answer-form-header">
                <h3>Your Answer</h3>
                <p>Share your knowledge and help others</p>
            </div>
            
            <div class="form-group">
                <textarea id="answerInput" 
                          placeholder="Write your answer here... (Be detailed and helpful)" 
                          maxlength="5000"
                          rows="8"></textarea>
                <div class="char-count">
                    <span id="answerCharCount">0</span>/5000 characters
                </div>
            </div>
            
            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" id="anonymousAnswer" value="1">
                    <span>Post anonymously</span>
                </label>
            </div>
            
            <div class="form-actions">
                <button class="cancel-btn" onclick="clearAnswerForm()">Cancel</button>
                <button class="submit-btn" onclick="postAnswer('${question.id || question.slug}')">
                    Post Answer
                </button>
            </div>
            
            <div class="answer-tips">
                <h4>Tips for a good answer:</h4>
                <ul>
                    <li>Be clear and concise</li>
                    <li>Provide examples if possible</li>
                    <li>Be respectful and helpful</li>
                    <li>Proofread before posting</li>
                </ul>
            </div>
        </div>
    `;

    // Add character counter
    const answerInput = document.getElementById('answerInput');
    const charCount = document.getElementById('answerCharCount');
    
    if (answerInput && charCount) {
        answerInput.addEventListener('input', function() {
            charCount.textContent = this.value.length;
            if (this.value.length > 4500) {
                charCount.style.color = '#e74c3c';
            } else if (this.value.length > 4000) {
                charCount.style.color = '#f39c12';
            } else {
                charCount.style.color = '#27ae60';
            }
        });
    }
}

window.postAnswer = async function(questionId) {
    const answerInput = document.getElementById('answerInput');
    const anonymousCheckbox = document.getElementById('anonymousAnswer');
    
    if (!answerInput) {
        alert('Answer input not found');
        return;
    }
    
    const answerText = answerInput.value.trim();
    if (!answerText) {
        alert('Please enter your answer');
        answerInput.focus();
        return;
    }
    
    if (answerText.length < 10) {
        alert('Please write a more detailed answer (at least 10 characters)');
        return;
    }
    
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Posting...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch(`${window.API_BASE}/questions/${questionId}/answer`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: 'include',
            body: JSON.stringify({ 
                answer: answerText,
                content: answerText,
                anonymous: anonymousCheckbox ? anonymousCheckbox.checked : false
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to post answer: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        
        // Show success message
        if (window.showNotification) {
            showNotification('Answer posted successfully!', 'success');
        } else {
            alert('Answer posted successfully!');
        }
        
        // Reload the page to show new answer
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
    } catch (error) {
        console.error('Error posting answer:', error);
        
        if (window.showNotification) {
            showNotification(error.message || 'Failed to post answer', 'error');
        } else {
            alert(error.message || 'Failed to post answer. Please try again.');
        }
        
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
};

window.clearAnswerForm = function() {
    const answerInput = document.getElementById('answerInput');
    const anonymousCheckbox = document.getElementById('anonymousAnswer');
    const charCount = document.getElementById('answerCharCount');
    
    if (answerInput) answerInput.value = '';
    if (anonymousCheckbox) anonymousCheckbox.checked = false;
    if (charCount) {
        charCount.textContent = '0';
        charCount.style.color = '#27ae60';
    }
};

window.scrollToAnswerForm = function() {
    const answerForm = document.getElementById('answerFormContainer');
    if (answerForm) {
        answerForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const answerInput = document.getElementById('answerInput');
        if (answerInput) answerInput.focus();
    }
};

// Attach social event listeners
function attachSocialEventListeners() {
    // These will be handled by social-features.js
    console.log('Social features will be handled by social-features.js');
}

// Load question on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Question page loaded, slug:', slug);
    
    if (slug) {
        // Wait for social-features.js to load
        setTimeout(() => {
            window.loadQuestion();
        }, 300);
    } else {
        showNotFound('No question specified');
    }
});

// Add CSS for question page
const style = document.createElement('style');
style.textContent = `
    .loading-question {
        text-align: center;
        padding: 60px 20px;
        color: #65676b;
    }
    
    .not-found {
        text-align: center;
        padding: 60px 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid #dddfe2;
        margin: 20px 0;
    }
    
    .not-found h2 {
        color: #e74c3c;
        margin-bottom: 15px;
    }
    
    .back-btn {
        display: inline-block;
        background: #ff4b8d;
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        text-decoration: none;
        margin-top: 20px;
        font-weight: 600;
    }
    
    .question-container {
        background: white;
        padding: 30px;
        border-radius: 12px;
        margin-bottom: 30px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        border: 1px solid #eee;
    }
    
    .question-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .question-user-info {
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .question-avatar {
        width: 60px;
        height: 60px;
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
        font-size: 16px;
        color: #1c1e21;
    }
    
    .question-date {
        font-size: 14px;
        color: #65676b;
    }
    
    .question-text {
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 20px;
        line-height: 1.4;
        color: #1c1e21;
    }
    
    .question-description {
        font-size: 1.1rem;
        line-height: 1.6;
        color: #495057;
        margin-bottom: 25px;
    }
    
    .question-stats {
        display: flex;
        gap: 25px;
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid #f0f2f5;
    }
    
    .stat-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 15px;
        color: #65676b;
    }
    
    .question-tags {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .tag {
        background: #f0f2f5;
        color: #495057;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
    }
    
    .answer-card {
        background: white;
        padding: 25px;
        border-radius: 12px;
        margin-bottom: 25px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        border: 1px solid #eee;
    }
    
    .answer-header {
        display: flex;
        align-items: flex-start;
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .answer-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #ff4b8d20;
    }
    
    .answer-user-info {
        flex: 1;
    }
    
    .answer-user-name {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 5px;
    }
    
    .user-link {
        font-weight: 600;
        font-size: 16px;
        color: #1c1e21;
        text-decoration: none;
    }
    
    .user-link:hover {
        color: #ff4b8d;
    }
    
    .follow-btn {
        font-size: 12px;
        padding: 4px 12px;
        background: #ff4b8d;
        color: white;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
    }
    
    .follow-btn:hover {
        background: #e83e8c;
    }
    
    .answer-user-bio {
        font-size: 14px;
        color: #65676b;
        line-height: 1.4;
    }
    
    .answer-body {
        font-size: 1.1rem;
        line-height: 1.6;
        color: #1c1e21;
        margin-bottom: 25px;
        white-space: pre-line;
    }
    
    .answer-actions {
        display: flex;
        gap: 15px;
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid #f0f2f5;
    }
    
    .answer-actions button {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid #e4e6e9;
        background: white;
        color: #65676b;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
    }
    
    .answer-actions button:hover {
        background: #f5f5f5;
    }
    
    .answer-footer {
        font-size: 14px;
        color: #888;
        text-align: right;
        margin-top: 15px;
    }
    
    .comments-section {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #f0f2f5;
    }
    
    .comment-form {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
    }
    
    .comment-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #dddfe2;
        border-radius: 20px;
        font-size: 14px;
        outline: none;
    }
    
    .comment-input:focus {
        border-color: #ff4b8d;
    }
    
    .comment-submit {
        padding: 12px 24px;
        background: #ff4b8d;
        color: white;
        border: none;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
    }
    
    .comment-submit:hover {
        background: #e83e8c;
    }
    
    .empty-answers, .unanswered-section {
        text-align: center;
        padding: 60px 20px;
        background: white;
        border-radius: 12px;
        border: 1px solid #dddfe2;
        margin: 20px 0;
    }
    
    .unanswered-actions {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 25px;
    }
    
    .answer-now-btn, .share-question-btn {
        padding: 12px 24px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        font-size: 15px;
    }
    
    .answer-now-btn {
        background: #ff4b8d;
        color: white;
    }
    
    .answer-now-btn:hover {
        background: #e83e8c;
    }
    
    .share-question-btn {
        background: #f0f2f5;
        color: #495057;
        border: 1px solid #ddd;
    }
    
    .share-question-btn:hover {
        background: #e4e6e9;
    }
    
    .answer-form {
        background: white;
        padding: 30px;
        border-radius: 12px;
        margin-top: 30px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        border: 1px solid #eee;
    }
    
    .answer-form-header h3 {
        margin: 0 0 10px 0;
        color: #1c1e21;
        font-size: 1.5rem;
    }
    
    .answer-form-header p {
        color: #65676b;
        margin: 0 0 25px 0;
    }
    
    .form-group {
        margin-bottom: 20px;
    }
    
    .answer-form textarea {
        width: 100%;
        min-height: 200px;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 15px;
        font-size: 16px;
        line-height: 1.6;
        resize: vertical;
        font-family: inherit;
    }
    
    .answer-form textarea:focus {
        border-color: #ff4b8d;
        outline: none;
    }
    
    .char-count {
        text-align: right;
        font-size: 14px;
        color: #65676b;
        margin-top: 8px;
    }
    
    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        color: #495057;
    }
    
    .form-actions {
        display: flex;
        gap: 15px;
        margin-top: 25px;
    }
    
    .cancel-btn, .submit-btn {
        padding: 12px 24px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        font-size: 15px;
        border: none;
    }
    
    .cancel-btn {
        background: #f0f2f5;
        color: #495057;
    }
    
    .cancel-btn:hover {
        background: #e4e6e9;
    }
    
    .submit-btn {
        background: #ff4b8d;
        color: white;
    }
    
    .submit-btn:hover:not(:disabled) {
        background: #e83e8c;
    }
    
    .submit-btn:disabled {
        background: #e4e6e9;
        cursor: not-allowed;
    }
    
    .answer-tips {
        margin-top: 30px;
        padding-top: 25px;
        border-top: 1px solid #f0f2f5;
    }
    
    .answer-tips h4 {
        margin: 0 0 15px 0;
        color: #495057;
    }
    
    .answer-tips ul {
        margin: 0;
        padding-left: 20px;
        color: #65676b;
    }
    
    .answer-tips li {
        margin-bottom: 8px;
    }
    
    @media (max-width: 768px) {
        .question-container,
        .answer-card,
        .answer-form {
            padding: 20px;
        }
        
        .question-text {
            font-size: 1.5rem;
        }
        
        .answer-actions {
            flex-wrap: wrap;
        }
        
        .answer-actions button {
            flex: 1;
            min-width: 100px;
            justify-content: center;
        }
        
        .unanswered-actions,
        .form-actions {
            flex-direction: column;
        }
        
        .answer-user-name {
            flex-wrap: wrap;
        }
        
        .question-stats {
            flex-wrap: wrap;
            gap: 15px;
        }
    }
    
    @media (max-width: 480px) {
        .question-container,
        .answer-card,
        .answer-form {
            padding: 16px;
        }
        
        .question-text {
            font-size: 1.3rem;
        }
        
        .question-user-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
        }
        
        .answer-header {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .answer-avatar {
            width: 40px;
            height: 40px;
        }
    }
`;
document.head.appendChild(style);