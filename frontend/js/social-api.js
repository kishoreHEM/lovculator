(function() {

class SocialAPICore {

    constructor() {
        // ✅ Automatically detect environment and set base API URL
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

        // NOTE: Ensure your production URL is correct.
        this.apiBase = isLocal
            ? 'http://localhost:3001/api'
            : 'https://lovculator.com/api'; 
            
        console.log(`📡 API Base URL set to: ${this.apiBase}`);
    }

    /**
     * Generic wrapper for all API requests.
     * @param {string} endpoint - The API endpoint path (e.g., '/users/1').
     * @param {object} options - Fetch options (method, body, headers, etc.).
     * @returns {Promise<object>} The JSON response data.
     */
    async request(endpoint, options = {}) {
        const fullUrl = `${this.apiBase}${endpoint}`;
        
        // Add credentials flag for sending cookies (important for sessions/auth)
        const fetchOptions = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                // Spread any custom headers
                ...options.headers
            },
            // Spread remaining options (method, body, etc.)
            ...options
        };

        try {
            const response = await fetch(fullUrl, fetchOptions);

            if (!response.ok) {
                let errorData = {};
                let errorType = `HTTP error! status: ${response.status} ${response.statusText}`;

                // Attempt to read a JSON error body for detailed messages
                try {
                    errorData = await response.json();
                    // Use a message from the error body if available
                    errorType = errorData.error || errorData.message || errorType;
                } catch (e) {
                    // If parsing fails, use the default HTTP error
                    console.warn(`Could not parse JSON error body for ${endpoint}.`);
                }

                // Throw a standardized error
                throw new Error(errorType);
            }

            // Handle No Content (204) and ensure parsing is safe for empty bodies
            const contentType = response.headers.get("content-type");
            if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
                 return {}; // Return empty object for success without a body
            }

            return await response.json(); 
            
        } catch (err) {
            // Log the error for development/debugging
            console.error(`❌ API Request failed for ${endpoint} (${options.method || 'GET'}):`, err.message);
            // Re-throw the error for the consuming code to handle
            throw err;
        }
    }
    
    // =====================
    // 🔑 Authentication Routes
    // =====================
    async register(username, email, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
    }

    async login(username, password) {
        // username field can be a username or email on the backend
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    }


    // =====================
    // 👤 User Profile Routes
    // =====================
    async getUserProfile(username) {
        return this.request(`/users/${username}`);
    }

    async updateUserProfile(userId, profileData) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // =====================
    // 👥 Follow System Routes
    // =====================
    async followUser(userId) {
        return this.request(`/users/${userId}/follow`, { method: 'POST' });
    }

    async unfollowUser(userId) {
        return this.request(`/users/${userId}/unfollow`, { method: 'DELETE' });
    }

    async getFollowers(userId) {
        return this.request(`/users/${userId}/followers`);
    }

    async getFollowing(userId) {
        return this.request(`/users/${userId}/following`);
    }

    // =====================
    // ❤️ Story Routes (Placeholder)
    // =====================
    async createLoveStory(storyData) {
        return this.request('/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }
}

// ✅ Expose instance globally (used by profile.js & others)
window.socialAPI = new SocialAPICore();
})();