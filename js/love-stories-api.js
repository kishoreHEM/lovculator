// Love Stories API Manager
class LoveStoriesAPI {
    constructor() {
        this.apiBase = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : '/api';
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getStories() {
        return this.request('/stories');
    }

    async createStory(storyData) {
        return this.request('/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }

    async toggleLike(storyId) {
        return this.request(`/stories/${storyId}/like`, {
            method: 'POST'
        });
    }

    async addComment(storyId, commentData) {
        return this.request(`/stories/${storyId}/comments`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    async getComments(storyId) {
        return this.request(`/stories/${storyId}/comments`);
    }

    async healthCheck() {
        return this.request('/health');
    }
}