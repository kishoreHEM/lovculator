// =========================================================
// 💬 Lovculator Q&A Unified Feed Script (Final SEO + Multi-Share Version)
// Author: Kishore M
// Date: 2025-11-11
// =========================================================

const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

const feedContainer = document.getElementById("storiesContainer");
const submitQuestionBtn = document.getElementById("submitQuestion");
const questionInput = document.getElementById("questionText");

// =========================================================
// 🚀 Load All Questions + Top 5 Answers
// =========================================================
async function loadQuestions() {
  if (!feedContainer) return;
  feedContainer.innerHTML = `
    <div class="loading-stories">
      <div class="loading-spinner"></div>
      <p>Loading questions...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/questions/latest`);
    if (!res.ok) throw new Error("Failed to load questions");
    const questions = await res.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-stories-state">
          <div class="empty-icon">💬</div>
          <h3>No questions yet</h3>
          <p>Be the first to ask something from the community!</p>
        </div>
      `;
      return;
    }

    // ✅ Render questions dynamically
    feedContainer.innerHTML = questions.map((q) => renderQuestionCard(q)).join("");
  } catch (err) {
    console.error("❌ Error loading questions:", err);
    feedContainer.innerHTML = `
      <p style="color:red;text-align:center;">⚠️ Failed to load questions.</p>
    `;
  }
}

// =========================================================
// ✨ Render Question Card with Answers + Share Options
// =========================================================
function renderQuestionCard(q) {
  const shareURL = `${window.location.origin}/questions/${q.slug}`;

  const answersHTML =
    q.answers.length > 0
      ? q.answers
          .map(
            (a) => `
          <div class="answer-card">
            <p>💬 ${a.answer}</p>
            <span class="answer-time">${new Date(a.created_at).toLocaleString()}</span>
          </div>`
          )
          .join("")
      : `<p class="no-answers">No answers yet. Be the first to answer!</p>`;

  return `
    <div class="question-card" id="question-${q.id}">
      <h3 class="question-title">
        <a href="/questions/${q.slug}" class="question-link">${q.question}</a>
      </h3>
      <p class="question-meta">
        <span>📅 ${new Date(q.created_at).toLocaleString()}</span>
        <span class="share-container">
          <a href="#" onclick="shareQuestion('${shareURL}', event)">🔗 Copy Link</a> •
          <a href="https://wa.me/?text=${encodeURIComponent(
            q.question + ' - ' + shareURL
          )}" target="_blank" rel="noopener noreferrer">💚 WhatsApp</a> •
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            shareURL
          )}" target="_blank" rel="noopener noreferrer">💙 Facebook</a> •
          <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(
            q.question
          )}&url=${encodeURIComponent(shareURL)}" target="_blank" rel="noopener noreferrer">🐦 X</a>
        </span>
      </p>

      <div class="answers-list">${answersHTML}</div>

      ${
        q.answers.length < 5
          ? `
          <div class="answer-form">
            <textarea id="answer-${q.id}" class="answer-input" placeholder="Write your answer..."></textarea>
            <button class="answer-submit-btn" onclick="postAnswer(${q.id})">Post Answer</button>
          </div>`
          : `<p class="answered-msg">✅ Already answered by 5 users</p>`
      }
    </div>
  `;
}

// =========================================================
// ✍️ Post a New Question
// =========================================================
async function postQuestion() {
  const question = questionInput?.value.trim();

  if (!question || question.length < 5) {
    alert("Please enter a valid question (at least 5 characters).");
    return;
  }

  submitQuestionBtn.disabled = true;
  submitQuestionBtn.innerText = "Posting...";

  try {
    const res = await fetch(`${API_BASE}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) throw new Error("Failed to post question");

    const data = await res.json();
    alert("✅ Question added successfully!");

    if (data.share_url) {
      navigator.clipboard.writeText(data.share_url);
      showToast("✅ Link copied! You can share your question.");
    }

    questionInput.value = "";
    document.getElementById("askCreateModal")?.classList.add("hidden");
    loadQuestions();
  } catch (err) {
    console.error("❌ Error posting question:", err);
    alert("⚠️ Failed to post question. Please try again.");
  } finally {
    submitQuestionBtn.disabled = false;
    submitQuestionBtn.innerText = "Add Question";
  }
}

// =========================================================
// 💬 Post an Answer (limit 5 per question)
// =========================================================
async function postAnswer(questionId) {
  const textarea = document.getElementById(`answer-${questionId}`);
  const answer = textarea?.value.trim();

  if (!answer) {
    alert("Please write an answer before posting.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });

    const data = await res.json();

    if (res.status === 400 && data.message === "Already answered by 5 users.") {
      alert("⚠️ This question already has 5 answers. Try another one!");
      return;
    }

    if (!res.ok) throw new Error("Failed to post answer");

    alert("✅ Answer posted successfully!");
    textarea.value = "";
    loadQuestions();
  } catch (err) {
    console.error("❌ Error posting answer:", err);
    alert("⚠️ Failed to post your answer. Please try again.");
  }
}

// =========================================================
// 🔗 Share Question (Copy to Clipboard)
// =========================================================
function shareQuestion(url, e) {
  e.preventDefault();
  navigator.clipboard.writeText(url);
  showToast("✅ Link copied to clipboard!");
}

// =========================================================
// 🍬 Floating Toast Message (Animated)
// =========================================================
function showToast(message) {
  let toast = document.createElement("div");
  toast.className = "toast-message";
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => toast.classList.remove("show"), 2000);
  setTimeout(() => toast.remove(), 2500);
}

// =========================================================
// 🎬 Event Listeners
// =========================================================
if (submitQuestionBtn) {
  submitQuestionBtn.addEventListener("click", postQuestion);
}

document.addEventListener("DOMContentLoaded", loadQuestions);

// =========================================================
// 💅 Inline Toast + Share Styling (Auto Injected)
// =========================================================
const style = document.createElement("style");
style.innerHTML = `
.toast-message {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%) scale(0.9);
  background: #ff4b8d;
  color: #fff;
  padding: 10px 20px;
  border-radius: 30px;
  font-weight: 600;
  font-size: 0.95rem;
  opacity: 0;
  transition: all 0.4s ease;
  z-index: 9999;
}
.toast-message.show {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

.share-container a {
  color: #0077ff;
  font-weight: 500;
  text-decoration: none;
  margin: 0 3px;
  transition: color 0.2s;
}
.share-container a:hover {
  color: #ff4b8d;
}
`;
document.head.appendChild(style);
