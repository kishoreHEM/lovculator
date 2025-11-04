// js/social-api.js

(function() {
    // Class definition is now encapsulated within the IIFE
    class SocialAPICore {
        constructor(apiBase = '/api') {
            this.apiBase = apiBase;
        }

        async request(endpoint, options = {}) {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                // Attempt to parse error message from body if available
                const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json().catch(() => ({})); // Handle empty responses gracefully
        }

        // User Profiles
        async getUserProfile(username) {
            return this.request(`/users/${username}`);
        }

        async updateUserProfile(userId, profileData) {
            return this.request(`/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });
        }

        // Follow System
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
        
        // ... (Add other API methods as needed, like sendMessage)
    }

    // Only the instance is exposed globally, using a different name
    // This resolves the 'SocialAPI not found' warning in profile.js,
    // assuming profile.js looks for window.socialAPI.
    window.socialAPI = new SocialAPICore();
})();