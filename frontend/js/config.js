// frontend/js/config.js

// Detect environment automatically
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3001/api"
    : "https://lovculator.com/api";

// Global helper for making API requests
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // important for cookies/session
    ...options,
  });

  if (!response.ok) {
    let message = "Something went wrong";
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {}
    throw new Error(message);
  }

  // Handle empty response
  try {
    return await response.json();
  } catch {
    return {};
  }
}

window.API_BASE = API_BASE;
window.apiRequest = apiRequest;
