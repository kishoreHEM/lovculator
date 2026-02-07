// Set API Base globally
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

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
        // 1. Fetch Question Data
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

        // 2. Get Current User Info for the Prompt Card (Personalized for the viewer)
        let currentUser = window.currentUser;
        if (!currentUser) {
            try {
                const authRes = await fetch(`${window.API_BASE}/auth/me`, { credentials: 'include' });
                if (authRes.ok) {
                    const authData = await authRes.json();
                    currentUser = authData.user || authData;
                    window.currentUser = currentUser;
                }
            } catch (e) { console.warn("Auth check failed", e); }
        }

        const myName = currentUser?.display_name || currentUser?.username || "Guest";
        const myAvatar = currentUser?.avatar_url || "/images/default-avatar.png";

        // 3. Render Question + Prompt Card
        questionContainer.innerHTML = `
            <div class="question-container">
                <div class="question-header">
                    <span class="question-date">Asked ${formatDate(question.created_at)}</span>
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

            <div class="answer-prompt-card">
                <div class="prompt-content">
                    <img src="${myAvatar}" alt="${myName}" class="prompt-avatar" onerror="this.src='/images/default-avatar.png'">
                    <h3 class="prompt-title">${myName}, can you answer this question?</h3>
                    <p class="prompt-subtitle">Help the community with a better answer.</p>
                    <button class="prompt-answer-btn" onclick="window.openAnswerModal && window.openAnswerModal('${question.id}', '${(question.question || question.title || '').replace(/'/g, "\\'")}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Answer
                    </button>
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
            const answerImage =
                answer.image_url ||
                answer.imageUrl ||
                answer.answer_image_url ||
                answer.answer_image ||
                '';
            
            // ✅ FIX: Check multiple common property names for following status
            const isFollowing = Boolean(answer.user_following);

            return `
                <div class="answer-card" data-answer-id="${answerId}" data-user-id="${userId}">
                    <div class="user-meta-row" style="display: flex; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
                        <img src="${userAvatar}" 
                             alt="${userName}" 
                             class="answer-avatar"
                             style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;"
                             onerror="this.src='/images/default-avatar.png'">
                        <div class="answer-user-info" style="flex: 1;">
                            <div class="answer-user-name" style="display: flex; align-items: center; gap: 12px; margin-bottom: 5px;">
                                <a href="/profile/${encodeURIComponent(userName)}" class="user-link" style="font-weight: 600; color: #1c1e21; text-decoration: none;">
                                    ${userName}
                                </a>
                                ${userId && String(userId) !== String(window.currentUserId) ? `
  <button 
    class="follow-author-btn ${isFollowing ? 'following' : ''}" 
    data-user-id="${userId}">
    ${isFollowing ? 'Following' : '+ Follow'}
  </button>
` : ''}
                            </div>
                            ${userBio ? `<div class="answer-user-bio" style="font-size: 14px; color: #65676b;">${userBio}</div>` : ''}
                        </div>
                    </div>

                    <div class="answer-body">${answerText}</div>
                    ${answerImage ? `
                        <div class="answer-image" style="margin-top:12px;">
                            <img src="${answerImage}" alt="Answer image" style="max-width:100%;border-radius:10px;display:block;">
                        </div>
                    ` : ''}

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
                                data-share-url="https://lovculator.com/question/${question.slug || slug}#answer-${answerId}"
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
                <button class="answer-now-btn" onclick="window.openAnswerModal && window.openAnswerModal('${question.id}', '${(question.question || question.title || '').replace(/'/g, "\\'")}')">Answer Now</button>
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
                <button class="submit-btn" onclick="handleAnswerSubmit('${question.id || question.slug}')">
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

if (!window.currentUserId) {
    answerInput.setAttribute("readonly", true);
    answerInput.setAttribute("placeholder", "Log in to write an answer");
    answerInput.classList.add("guest-disabled");

    answerInput.addEventListener("focus", (e) => {
        e.preventDefault();
        answerInput.blur();
        requireLogin("write an answer");
    });
}

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

window.handleAnswerSubmit = function(questionId) {
    // 🔐 LOGIN GATE
    if (!window.currentUserId) {
        requireLogin("submit an answer");
        return;
    }

    postAnswer(questionId);
};


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

// ==============================================
// 11. DYNAMIC BREADCRUMB UPDATE
// ==============================================
function updateBreadcrumbUI(category) {
    const breadcrumbList = document.querySelector('.breadcrumb-list');
    if (!breadcrumbList) return;

    breadcrumbList.innerHTML = `
        <li><a href="/">Home</a></li>
        <li><span class="separator">/</span></li>
        <li><a href="/answer">Questions</a></li>
        <li><span class="separator">/</span></li>
        <li class="active">${category}</li>
    `;
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
