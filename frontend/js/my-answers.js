// my-answers.js

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

async function loadMyAnswers() {
  const container = document.getElementById("myAnswersContainer");
  if (!container) return;

  try {
    const res = await fetch(`${window.API_BASE}/questions/my/answers`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const answers = await res.json();

    if (!answers.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p>You haven't answered any questions yet.</p>
          <a href="/questions" class="answer-btn">Browse Questions</a>
        </div>
      `;
      return;
    }

    const html = answers.map(a => {
      const questionTitle = escapeHtml(a.question || "");
      const slug = escapeHtml(a.slug || a.question_id);
      const answerText = escapeHtml(a.answer || "");
      const date = new Date(a.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });

      return `
        <div class="question-card" data-answer-id="${a.id}">
          <div class="question-header">
            <span class="question-date">Answered on ${date}</span>
          </div>

          <a href="/question/${slug}" class="question-title">${questionTitle}</a>

          <div class="answer-preview">
            ${answerText}
            <a href="/question/${slug}" class="read-more">Read more</a>
          </div>

          <div class="question-stats">
            <span>${a.likes_count || 0} likes</span>
            <span>${a.comments_count || 0} comments</span>
          </div>

          <div class="question-actions">
            <a class="answer-btn" href="/question/${slug}">View</a>
          </div>
        </div>
      `;
    }).join("");

    container.innerHTML = html;
  } catch (err) {
    console.error("Load my answers error:", err);
    container.innerHTML = `
      <div class="error-state">
        <p>Failed to load your answers.</p>
        <button class="retry-btn" onclick="window.loadMyAnswers()">Retry</button>
      </div>
    `;
  }
}

window.loadMyAnswers = loadMyAnswers;

document.addEventListener("DOMContentLoaded", loadMyAnswers);
