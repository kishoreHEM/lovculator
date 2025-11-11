// =====================================
// 💬 Lovculator - answers.js (Final Version)
// =====================================

const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

const urlParams = new URLSearchParams(window.location.search);
const questionId = urlParams.get("id");

// 🚨 Validate question ID in URL
if (!questionId) {
  document.body.innerHTML = `
    <div style="max-width:600px;margin:100px auto;text-align:center;font-family:'Poppins',sans-serif;">
      <h2>⚠️ Invalid Page</h2>
      <p>Question ID not found in the URL.</p>
      <a href="/questions.html" style="color:#ff4b8d;text-decoration:none;font-weight:bold;">
        ← Go back to Questions
      </a>
    </div>
  `;
  throw new Error("❌ Missing question ID in URL");
}

// =====================================
// 🧠 Load Question Details
// =====================================
async function loadQuestion() {
  const container = document.getElementById("questionContainer");
  try {
    const res = await fetch(`${API_BASE}/questions/${questionId}`);
    if (!res.ok) throw new Error("Question not found");
    const q = await res.json();

    container.innerHTML = `
      <div class="question-text">${q.question}</div>
      <div class="question-meta">
        📅 Posted on ${new Date(q.created_at).toLocaleString()}
      </div>
    `;
  } catch (err) {
    console.error("❌ Error loading question:", err);
    container.innerHTML = `<p style="color:red;">❌ Failed to load question details.</p>`;
  }
}

// =====================================
// 💬 Load All Answers
// =====================================
async function loadAnswers() {
  const container = document.getElementById("answersContainer");
  try {
    const res = await fetch(`${API_BASE}/answers/${questionId}`);
    if (!res.ok) throw new Error("Failed to fetch answers");

    const answers = await res.json();

    if (!Array.isArray(answers) || answers.length === 0) {
      container.innerHTML = `
        <p class="no-answers" style="text-align:center;color:#777;">
          No answers yet. Be the first to share your thoughts!
        </p>`;
      return;
    }

    container.innerHTML = answers.map(a => `
      <div class="answer-card" data-id="${a.id}">
        <div class="answer-meta">
          🕒 ${new Date(a.created_at).toLocaleString()}
          <span style="float:right;">
            <button class="edit-answer-btn" onclick="editAnswer(${a.id}, '${encodeURIComponent(a.answer)}')">✏️ Edit</button>
            <button class="delete-answer-btn" onclick="deleteAnswer(${a.id})">🗑️ Delete</button>
          </span>
        </div>
        <div class="answer-text">${a.answer}</div>
      </div>
    `).join("");

  } catch (err) {
    console.error("❌ Error loading answers:", err);
    container.innerHTML = "<p style='color:red;text-align:center;'>❌ Failed to load answers.</p>";
  }
}

// =====================================
// 📝 Post a New Answer
// =====================================
document.getElementById("submitAnswerBtn").addEventListener("click", async () => {
  const text = document.getElementById("answerInput").value.trim();
  if (!text) return alert("Please write an answer before posting!");

  try {
    const res = await fetch(`${API_BASE}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // allow session cookies
      body: JSON.stringify({ question_id: questionId, answer: text })
    });

    if (res.ok) {
      alert("✅ Answer posted successfully!");
      document.getElementById("answerInput").value = "";
      await loadAnswers();
    } else if (res.status === 401) {
      alert("⚠️ Please log in to post an answer.");
      window.location.href = "/login.html";
    } else {
      const errData = await res.json().catch(() => ({}));
      alert("❌ Failed to post answer: " + (errData.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Error posting answer:", err);
    alert("⚠️ Something went wrong. Try again later.");
  }
});

// =====================================
// ✏️ Edit an Answer
// =====================================
async function editAnswer(id, encodedText) {
  const currentText = decodeURIComponent(encodedText);
  const newAnswer = prompt("Edit your answer:", currentText);
  if (!newAnswer || !newAnswer.trim()) return;

  try {
    const res = await fetch(`${API_BASE}/answers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: newAnswer.trim() })
    });

    if (res.ok) {
      alert("✅ Answer updated successfully!");
      loadAnswers();
    } else {
      alert("❌ Failed to update answer.");
    }
  } catch (err) {
    console.error("Error editing answer:", err);
  }
}

// =====================================
// 🗑️ Delete an Answer
// =====================================
async function deleteAnswer(id) {
  if (!confirm("Are you sure you want to delete this answer?")) return;

  try {
    const res = await fetch(`${API_BASE}/answers/${id}`, { method: "DELETE" });
    if (res.ok) {
      alert("🗑️ Answer deleted.");
      loadAnswers();
    } else {
      alert("❌ Failed to delete answer.");
    }
  } catch (err) {
    console.error("Error deleting answer:", err);
  }
}

// =====================================
// 🚀 Initialize Page
// =====================================
document.addEventListener("DOMContentLoaded", () => {
  loadQuestion();
  loadAnswers();
});
