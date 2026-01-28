/**
 * questions-feed.js
 * Updated: 2026-01-11
 * Features:
 * - Offset-based pagination (100 limit)
 * - Category filtering (UI-only, no card badge)
 * - Dynamic SEO schema update
 * - Load more pagination
 */

// ======================================================
// 1️⃣ API BASE
// ======================================================
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

// ======================================================
// 2️⃣ GLOBAL STATE
// ======================================================
let currentOffset = 0;
let currentCategory = "all";
const PAGE_LIMIT = 100;

// ======================================================
// 3️⃣ XSS SAFE ESCAPE
// ======================================================
function escapeHtml(text) {
    if (typeof text !== "string") return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ======================================================
// 4️⃣ MAIN LOAD FUNCTION
// ======================================================
window.loadQuestions = async function (isLoadMore = false, category = currentCategory) {
    const container =
        document.getElementById("questionsFeedContainer") ||
        document.getElementById("storiesContainer");

    if (!container) return;

    // Reset on fresh load
    if (!isLoadMore) {
        currentOffset = 0;
        currentCategory = category;
        container.innerHTML = `
            <div class="loading-stories">
                <div class="loading-spinner"></div>
                <p>Loading ${currentCategory === "all" ? "" : currentCategory} questions...</p>
            </div>
        `;
    }

    
    document.getElementById("loadMoreContainer")?.remove();


    try {
        const categoryParam =
            currentCategory !== "all"
                ? `&category=${encodeURIComponent(currentCategory)}`
                : "";

        const fetchUrl = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}`;

        console.log("Fetching:", fetchUrl);

        const response = await fetch(fetchUrl, {
            credentials: "include",
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const questions = await response.json();

        // Empty state
        if (!questions.length && !isLoadMore) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No ${currentCategory === "all" ? "" : currentCategory} questions found.</p>
                    <a href="/ask" class="answer-btn" style="margin-top:12px;">Ask a Question</a>
                </div>
            `;
            return;
        }

        // ======================================================
        // 5️⃣ SEO SCHEMA UPDATE (LATEST QUESTION ONLY)
        // ======================================================
        if (questions.length && !isLoadMore) {
            const q = questions[0];
            const schemaTag = document.getElementById("qa-schema");

            if (schemaTag) {
                schemaTag.innerHTML = JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "QAPage",
                    "mainEntity": {
                        "@type": "Question",
                        "name": escapeHtml(q.question),
                        "text": escapeHtml(q.description || q.question),
                        "answerCount": q.answers_count || 0,
                        "datePublished": q.created_at,
                        "author": {
                            "@type": "Person",
                            "name": q.display_name || "Community Member",
                            "url": q.username
                                ? `https://lovculator.com/profile/${q.username}`
                                : "https://lovculator.com"
                        }
                    }
                });
            }
        }

        // ======================================================
        // 6️⃣ RENDER QUESTIONS (NO CATEGORY BADGE)
        // ======================================================
        const html = questions
            .map(q => {
                const title = escapeHtml(q.question);
                const slug = escapeHtml(q.slug || q.id);
                const date = new Date(q.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });

                return `
                <div class="question-card" data-question-id="${q.id}">
                    <div class="question-header">
                        <span class="question-date">Asked on ${date}</span>
                    </div>

                    <a href="/question/${slug}" class="question-title">${title}</a>

                    <div class="question-stats">
                        <span class="stat-item">${q.answers_count || 0} answers</span>
                        <span class="stat-item">${q.likes_count || 0} likes</span>
                        <span class="stat-item">${q.views_count || 0} views</span>
                    </div>

                    <div class="question-actions">
                        <a class="answer-btn" href="/question/${slug}">Answer</a>

                        <button class="share-btn"
                            data-share-url="https://lovculator.com/question/${slug}"
                            data-share-title="${title}">
                            Share
                        </button>

                        <button class="save-btn save-question-btn" data-question-id="${q.id}">
                            Save
                        </button>
                    </div>
                </div>`;
            })
            .join("");

        if (isLoadMore) {
            container.insertAdjacentHTML("beforeend", html);
        } else {
            container.innerHTML = html;
        }

        currentOffset += questions.length;

        // ======================================================
        // 7️⃣ LOAD MORE
        // ======================================================
        if (questions.length === PAGE_LIMIT) {
            container.insertAdjacentHTML(
                "afterend",
                `
                <div id="loadMoreContainer" style="text-align:center;margin:30px 0;">
                    <button class="answer-btn"
                        onclick="window.loadQuestions(true, currentCategory)">
                        Load More Questions
                    </button>
                </div>`
            );
        }

        attachShareButtonListeners();
        attachSaveButtonListeners();

    } catch (err) {
        console.error("Load questions error:", err);
        if (!isLoadMore) {
            container.innerHTML = `
                <div class="error-state">
                    <p>Failed to load questions.</p>
                    <button class="retry-btn" onclick="window.loadQuestions()">Retry</button>
                </div>
            `;
        }
    }
};

// ======================================================
// 8️⃣ SHARE HANDLER
// ======================================================
function attachShareButtonListeners() {
    document.querySelectorAll(".share-btn").forEach(btn => {
        btn.onclick = async () => {
            const url = btn.dataset.shareUrl;
            const title = btn.dataset.shareTitle;

            if (navigator.share) {
                try {
                    await navigator.share({ title, url });
                } catch (_) {}
            } else {
                await navigator.clipboard.writeText(url);
                window.showNotification?.("Link copied 📋", "success");
            }
        };
    });
}

// ======================================================
// 9️⃣ SAVE (UI ONLY)
// ======================================================
function attachSaveButtonListeners() {
    document.querySelectorAll(".save-question-btn").forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle("saved");
            window.showNotification?.(
                btn.classList.contains("saved")
                    ? "Question saved 💖"
                    : "Removed from saved",
                "success"
            );
        };
    });
}

// ======================================================
// 🔟 FILTER BAR SUPPORT (BUTTONS + SELECT)
// ======================================================
document.getElementById("applyFilterBtn")?.addEventListener("click", () => {
    const select = document.getElementById("categorySelect");
    currentCategory = select?.value || "all";
    window.loadQuestions(false, currentCategory);
});


// ======================================================
// 1️⃣1️⃣ INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
    if (
        document.getElementById("questionsFeedContainer") ||
        document.getElementById("storiesContainer")
    ) {
        window.loadQuestions();
    }
});
