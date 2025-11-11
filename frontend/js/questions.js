const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

let currentQuestionId = null;

async function loadQuestions() {
  try {
    const res = await fetch(`${API_BASE}/questions`);
    const questions = await res.json();

    const list = document.getElementById("questionsList");
    if (!list) return console.error("❌ questionsList not found in DOM");

    if (!questions.length) {
      list.innerHTML = `<p style="text-align:center;color:#777;">No questions yet. Be the first to ask!</p>`;
      return;
    }

    // ✅ fixed: use list instead of undefined container
    list.innerHTML = questions.map(q => `
      <div class="question-card" data-id="${q.id}">
        <div class="question-text">${q.question}</div>
        <div class="question-meta">
          <span>${new Date(q.created_at).toLocaleString()}</span>
          <span>💬 ${q.answer_count || 0} Answers</span>
          <button class="answer-btn">Answer</button>
        </div>
      </div>
    `).join("");

    attachQuestionHandlers();
  } catch (err) {
    console.error("❌ Failed to load questions:", err);
  }
}

function attachQuestionHandlers() {
  document.querySelectorAll(".answer-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      currentQuestionId = e.target.closest(".question-card").dataset.id;
      document.getElementById("answerModal").style.display = "flex";
    });
  });
}

document.getElementById("cancelAnswerBtn").addEventListener("click", () => {
  document.getElementById("answerModal").style.display = "none";
});

document.getElementById("submitAnswerBtn").addEventListener("click", async () => {
  const answer = document.getElementById("answerInput").value.trim();
  if (!answer) return alert("Please write an answer.");

  await fetch(`${API_BASE}/questions/${currentQuestionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer })
  });

  document.getElementById("answerModal").style.display = "none";
  document.getElementById("answerInput").value = "";
  alert("✅ Answer posted!");
});

document.getElementById("askNewBtn").addEventListener("click", () => {
  window.location.href = "/love-stories.html"; // reuse your ask/post modal there
});

document.addEventListener("DOMContentLoaded", loadQuestions);
