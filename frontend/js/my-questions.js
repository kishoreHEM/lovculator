// my-questions.js

if (!window.API_BASE) {
  window.API_BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:3001/api"
    : "https://lovculator.com/api";
}

function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadMyQuestions() {
  const container = document.getElementById("myQuestionsContainer");
  if (!container) return;

  try {
    const res = await fetch(`${window.API_BASE}/questions/my/questions`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const questions = await res.json();

    if (!questions.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You haven't asked any questions yet.</p>
          <a href="/" class="answer-btn">Ask a Question</a>
        </div>
      `;
      return;
    }

    const html = questions.map(q => {
      const title = escapeHtml(q.question || "");
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
            ${(q.answers_count || 0) > 0
              ? `<span class="answered-badge">Answered</span>`
              : `<span class="needs-answer-badge">Needs Advice</span>`}
          </div>

          <a href="/question/${slug}" class="question-title">${title}</a>

          <div class="question-stats">
            <span>${q.answers_count || 0} answers</span>
            <span>${q.likes_count || 0} likes</span>
            <span>${q.views_count || 0} views</span>
          </div>

          <div class="question-actions">
            <a class="answer-btn" href="/question/${slug}">View</a>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html;
  } catch (err) {
    console.error("Load my questions error:", err);
    container.innerHTML = `
      <div class="error-state">
        <p>Failed to load your questions.</p>
        <button class="retry-btn" onclick="window.loadMyQuestions()">Retry</button>
      </div>
    `;
  }
}

window.loadMyQuestions = loadMyQuestions;

document.addEventListener("DOMContentLoaded", loadMyQuestions);
