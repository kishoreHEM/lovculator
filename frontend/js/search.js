/**
 * frontend/js/search.js
 * Handles global user search in the header
 */

(() => {
    const API_BASE = window.API_BASE || (window.location.hostname.includes("localhost") ? "http://localhost:3001/api" : "https://lovculator.com/api");
    const ASSET_BASE = window.ASSET_BASE || (window.location.hostname.includes("localhost") ? "http://localhost:3001" : "https://lovculator.com");

    function getAvatarUrl(url) {
        if (!url || url === "null" || url === "undefined") return "/images/default-avatar.png";
        if (url.startsWith("http") || url.startsWith("/")) return url.startsWith("/") ? `${ASSET_BASE}${url}` : url;
        return `${ASSET_BASE}/uploads/avatars/${url}`;
    }

    // Debounce function to prevent API spam
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    class SearchManager {
        constructor() {
            this.input = document.getElementById('globalSearchInput');
            this.resultsContainer = document.getElementById('globalSearchResults');
            
            // Retry logic in case header loads dynamically
            if (!this.input || !this.resultsContainer) {
                setTimeout(() => this.retryInit(), 500);
                return;
            }

            this.bindEvents();
        }

        retryInit() {
            this.input = document.getElementById('globalSearchInput');
            this.resultsContainer = document.getElementById('globalSearchResults');
            if (this.input && this.resultsContainer) {
                this.bindEvents();
            }
        }

        bindEvents() {
            // Listen for typing with 300ms delay
            this.input.addEventListener('input', debounce((e) => this.handleSearch(e), 300));

            // Hide on click outside
            document.addEventListener('click', (e) => {
                if (!this.input.contains(e.target) && !this.resultsContainer.contains(e.target)) {
                    this.resultsContainer.classList.add('hidden');
                }
            });

            // Show again on focus
            this.input.addEventListener('focus', () => {
                if (this.input.value.trim().length > 0) {
                    this.resultsContainer.classList.remove('hidden');
                }
            });
        }

        async handleSearch(e) {
            const query = e.target.value.trim();

            if (query.length === 0) {
                this.resultsContainer.classList.add('hidden');
                this.resultsContainer.innerHTML = '';
                return;
            }

            this.resultsContainer.classList.remove('hidden');
            this.resultsContainer.innerHTML = `<div class="search-status">Searching...</div>`;

            try {
                const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error("Search failed");
                
                const users = await res.json();
                this.renderResults(users);

            } catch (err) {
                console.error("Search Error:", err);
                this.resultsContainer.innerHTML = `<div class="search-status">Login for searching.</div>`;
            }
        }

        renderResults(users) {
            if (!users || users.length === 0) {
                this.resultsContainer.innerHTML = `<div class="search-status">No users found.</div>`;
                return;
            }

            const html = users.map(user => {
                const avatar = getAvatarUrl(user.avatar_url);
                const name = user.display_name || user.username;
                const username = user.username;
                
                return `
                <a href="/profile/${encodeURIComponent(username)}" class="search-result-item">
                    <img src="${avatar}" alt="${name}" class="search-avatar-small">
                    <div class="search-user-info">
                        <h4>${name}</h4>
                        <span>@${username}</span>
                    </div>
                </a>
                `;
            }).join('');

            this.resultsContainer.innerHTML = html;
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        new SearchManager();
    });
})();