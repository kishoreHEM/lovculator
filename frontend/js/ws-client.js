// ============================
// WebSocket Client for Realtime
// ============================
let socket;

export function initWebSocket() {
    const wsProtocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    const wsURL = `${wsProtocol}${window.location.host}`;

    socket = new WebSocket(wsURL);

    console.log("🔌 Connecting WS:", wsURL);

    socket.onopen = () => console.log("🟢 WebSocket connected");

    socket.onclose = () => console.log("🔴 WebSocket disconnected");

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Realtime Like update
        if (data.type === "LIKE_UPDATED") {
            updatePostLikeUI(data);
        }

        // Realtime Comment update
        if (data.type === "NEW_COMMENT") {
            updateCommentsUI(data.data);
        }
    };
}

export function updateCommentsUI(comment) {
    const modal = document.querySelector(".comments-modal");
    if (modal) {
        const list = document.getElementById("commentsList");
        list.innerHTML += `
            <div class="comment-item">
                <img src="${comment.user.avatar_url || "/images/default-avatar.png"}" class="comment-avatar">
                <div>
                    <b>${comment.user.display_name || comment.user.username}</b>
                    <p>${comment.comment}</p>
                </div>
            </div>
        `;
    }

    // Update post card count
    const btn = document.querySelector(`button.comment-btn[data-id="${comment.postId}"]`);
    if (btn) {
        const count = btn.querySelector(".comment-count");
        count.textContent = Number(count.textContent) + 1;
    }
}

export function updatePostLikeUI(data) {
    const { postId, like_count } = data;

    const btn = document.querySelector(`button.like-btn[data-id="${postId}"]`);
    if (!btn) return;

    const count = btn.querySelector(".like-count");
    if (count) count.textContent = like_count;
}
