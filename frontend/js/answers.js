
    const API_BASE = window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api";

    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get("id");

    async function loadQuestion() {
      const container = document.getElementById("questionContainer");
      try {
        const res = await fetch(`${API_BASE}/questions/${questionId}`);
        if (!res.ok) throw new Error("Question not found");
        const q = await res.json();

        container.innerHTML = `
          <div class="question-text">${q.question}</div>
          <div class="question-meta">Posted on ${new Date(q.created_at).toLocaleString()}</div>
        `;
      } catch (err) {
        container.innerHTML = `<p style="color:red;">❌ Failed to load question.</p>`;
      }
    }

    async function loadAnswers() {
      const container = document.getElementById("answersContainer");
      try {
        const res = await fetch(`${API_BASE}/answers/${questionId}`);
        const answers = await res.json();

        if (!Array.isArray(answers) || answers.length === 0) {
          container.innerHTML = "<p class='no-answers'>No answers yet. Be the first to share your thoughts!</p>";
          return;
        }

        container.innerHTML = answers.map(a => `
  <div class="answer-card" data-id="${a.id}">
    <div class="answer-meta">
      Posted on ${new Date(a.created_at).toLocaleString()}
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
        container.innerHTML = "<p class='no-answers'>Failed to load answers.</p>";
      }
    }

    document.getElementById("submitAnswerBtn").addEventListener("click", async () => {
      const text = document.getElementById("answerInput").value.trim();
      if (!text) return alert("Please write an answer before posting!");

      try {
        const res = await fetch(`${API_BASE}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: questionId, answer: text })
        });

        if (res.ok) {
          alert("✅ Answer posted successfully!");
          document.getElementById("answerInput").value = "";
          loadAnswers();
        } else {
          alert("❌ Failed to post answer.");
        }
      } catch (err) {
        console.error("Error posting answer:", err);
        alert("⚠️ Something went wrong. Try again later.");
      }
    });

    loadQuestion();
    loadAnswers();