/* =====================================================
   ADMIN PANEL JS — FINAL VERSION
   Safe, clean, production-ready
===================================================== */

const usersTableBody = document.querySelector("#usersTable tbody");
const deleteTestsBtn = document.getElementById("deleteTests");
const deleteImagesBtn = document.getElementById("deleteImages");

/* =========================
   LOAD USERS
========================= */
async function loadUsers() {
  try {
    const res = await fetch("/admin/users", {
      credentials: "include"
    });

    if (res.status === 401) {
      alert("You are not logged in.");
      return;
    }

    if (res.status === 403) {
      alert("Admin access denied.");
      return;
    }

    if (!res.ok) {
      alert("Failed to load users.");
      return;
    }

    const users = await res.json();
    usersTableBody.innerHTML = "";

    users.forEach((u) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.username || "-"}</td>
        <td>${u.email}</td>
        <td>${u.is_admin ? "Admin" : "User"}</td>
        <td>${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <button 
            class="delete" 
            data-id="${u.id}"
            ${u.is_admin ? "title='Admin user'" : ""}
          >
            Delete
          </button>
        </td>
      `;

      tr.querySelector(".delete").addEventListener("click", () => {
        deleteUser(u.id);
      });

      usersTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("Load users error:", err);
    alert("Unexpected error loading users.");
  }
}

/* =========================
   DELETE SINGLE USER
========================= */
async function deleteUser(id) {
  if (!confirm("Delete this user permanently? This cannot be undone.")) return;

  try {
    const res = await fetch(`/admin/users/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    if (res.status === 400) {
      const data = await res.json();
      alert(data.error || "Action not allowed.");
      return;
    }

    if (!res.ok) {
      alert("Failed to delete user.");
      return;
    }

    loadUsers();
  } catch (err) {
    console.error("Delete user error:", err);
    alert("Unexpected error deleting user.");
  }
}

/* =========================
   BULK DELETE TEST USERS
========================= */
deleteTestsBtn?.addEventListener("click", async () => {
  if (!confirm("Delete ALL test users? This cannot be undone.")) return;

  try {
    const res = await fetch("/admin/cleanup/test-users", {
      method: "DELETE",
      credentials: "include"
    });

    if (!res.ok) {
      alert("Failed to delete test users.");
      return;
    }

    alert("Test users deleted successfully.");
    loadUsers();
  } catch (err) {
    console.error("Delete test users error:", err);
    alert("Unexpected error.");
  }
});

/* =========================
   DELETE TEST IMAGES
========================= */
deleteImagesBtn?.addEventListener("click", async () => {
  if (!confirm("Delete ALL test images?")) return;

  try {
    const res = await fetch("/admin/cleanup/images", {
      method: "DELETE",
      credentials: "include"
    });

    if (!res.ok) {
      alert("Failed to delete images.");
      return;
    }

    alert("Test images deleted successfully.");
  } catch (err) {
    console.error("Delete images error:", err);
    alert("Unexpected error.");
  }
});

/* =====================================================
   ADMIN PANEL JS — ALL CONTROLS
===================================================== */

// --- TAB SWITCHING ---
window.switchTab = (tabName) => {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active'); // Highlight button

  // Load data when tab opens
  if(tabName === 'users') loadUsers();
  if(tabName === 'stories') loadStories();
  if(tabName === 'comments') loadComments();
  if(tabName === 'follows') loadFollows();
  if(tabName === 'likes') loadLikes();
};

// --- API HELPER ---
async function apiCall(endpoint, method = "GET") {
  try {
    const res = await fetch(`/admin/${endpoint}`, { method, credentials: "include" });
    if (!res.ok) throw new Error("API Error");
    return method === "GET" ? await res.json() : true;
  } catch (err) {
    alert("Operation failed");
    return null;
  }
}

// --- 1. LOAD USERS ---
async function loadUsers() {
  const users = await apiCall("users");
  if (!users) return;
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.username || "-"}</td>
      <td>${u.email}</td>
      <td>${u.is_admin ? "Admin" : "User"}</td>
      <td><button class="delete-btn" onclick="deleteItem('users', ${u.id})">Delete</button></td>
    </tr>
  `).join("");
}

// --- 2. LOAD STORIES ---
async function loadStories() {
  const data = await apiCall("stories");
  if (!data) return;
  document.getElementById("storiesTableBody").innerHTML = data.map(s => `
    <tr>
      <td>${s.id}</td>
      <td>${s.story_title || "No Title"}</td>
      <td>${s.username}</td>
      <td>${new Date(s.created_at).toLocaleDateString()}</td>
      <td><button class="delete-btn" onclick="deleteItem('stories', ${s.id})">Delete</button></td>
    </tr>
  `).join("");
}

// --- 3. LOAD COMMENTS ---
async function loadComments() {
  const data = await apiCall("comments");
  if (!data) return;
  document.getElementById("commentsTableBody").innerHTML = data.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.text}...</td>
      <td>${c.username}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td><button class="delete-btn" onclick="deleteItem('comments', ${c.id})">Delete</button></td>
    </tr>
  `).join("");
}

// --- 4. LOAD FOLLOWS ---
async function loadFollows() {
  const data = await apiCall("follows");
  if (!data) return;
  document.getElementById("followsTableBody").innerHTML = data.map(f => `
    <tr>
      <td>${f.id}</td>
      <td>${f.follower}</td>
      <td>→ ${f.following}</td>
      <td>${new Date(f.created_at).toLocaleDateString()}</td>
      <td><button class="delete-btn" onclick="deleteItem('follows', ${f.id})">Unfollow</button></td>
    </tr>
  `).join("");
}

// --- 5. LOAD LIKES ---
async function loadLikes() {
  const data = await apiCall("likes");
  if (!data) return;
  document.getElementById("likesTableBody").innerHTML = data.map(l => `
    <tr>
      <td>${l.id}</td>
      <td>${l.username}</td>
      <td>${l.story_title}</td>
      <td>${new Date(l.created_at).toLocaleDateString()}</td>
      <td><button class="delete-btn" onclick="deleteItem('likes', ${l.id})">Remove</button></td>
    </tr>
  `).join("");
}

// --- GENERIC DELETE FUNCTION ---
window.deleteItem = async (type, id) => {
  if (!confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) return;
  
  const success = await apiCall(`${type}/${id}`, "DELETE");
  if (success) {
    // Reload the current tab's data
    if(type === 'users') loadUsers();
    if(type === 'stories') loadStories();
    if(type === 'comments') loadComments();
    if(type === 'follows') loadFollows();
    if(type === 'likes') loadLikes();
  }
};

/* =========================
   INIT
========================= */
loadUsers();
