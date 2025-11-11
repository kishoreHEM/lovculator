
    const API_BASE = window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api";

    // Extract slug from URL
    const slug = window.location.pathname.split("/").pop();

    // Load Question and Answers
    async function loadQuestion() {
      try {
        const res = await fetch(`${API_BASE}/questions/${slug}`);
        if (!res.ok) throw new Error("Question not found");

        const q = await res.json();

        // Update title
        document.title = `${q.question} • Lovculator`;

        // Render Question
        document.getElementById("questionContainer").innerHTML = `
          <div class="question-text">❓ ${q.question}</div>
          <div class="question-meta">
            📅 ${new Date(q.created_at).toLocaleString()}
          </div>
        `;

        // Render Answers
        const answersContainer = document.getElementById("answersContainer");
        if (q.answers.length === 0) {
          answersContainer.innerHTML = `<p>No answers yet. Be the first to answer!</p>`;
        } else {
          answersContainer.innerHTML = q.answers
            .map(
              (a) => `
              <div class="answer-card">
                <div class="answer-text">💬 ${a.answer}</div>
                <div class="answer-meta">${new Date(a.created_at).toLocaleString()}</div>
              </div>
            `
            )
            .join("");
        }

        // Render Answer Form (only if < 5 answers)
        const formContainer = document.getElementById("answerFormContainer");
        if (q.answers.length < 5) {
          formContainer.innerHTML = `
            <div class="answer-form">
              <textarea id="answerInput" placeholder="Write your answer..."></textarea>
              <button class="submit-btn" onclick="postAnswer('${q.id}')">Post Answer</button>
            </div>
          `;
        } else {
          formContainer.innerHTML = `
            <div class="answered-msg">✅ Already answered by 5 users</div>
          `;
        }
      } catch (err) {
        console.error("❌ Error:", err);
        document.getElementById("questionContainer").innerHTML = `
          <p style="color:red;text-align:center;">⚠️ Question not found or invalid link.</p>
        `;
      }
    }

    // Post Answer
    async function postAnswer(questionId) {
      const textarea = document.getElementById("answerInput");
      const answer = textarea.value.trim();

      if (!answer) {
        alert("Please write an answer first!");
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
          alert("⚠️ This question already has 5 answers.");
          return;
        }

        if (!res.ok) throw new Error(data.error || "Failed to post answer.");

        alert("✅ Answer posted successfully!");
        textarea.value = "";
        loadQuestion();
      } catch (err) {
        console.error("❌ Error posting answer:", err);
        alert("⚠️ Failed to post your answer. Please try again.");
      }
    }

    // Initialize
    loadQuestion();