// Love Stories API Manager - ENHANCED VERSION
class LoveStoriesAPI {
    constructor() {
        this.apiBase = window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : '/api';
        
        this.timeout = 10000; // 10 second timeout
    }

    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle specific HTTP errors
                if (response.status === 404) {
                    throw new Error('API endpoint not found');
                } else if (response.status === 500) {
                    throw new Error('Server error');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                console.error(`API request timeout for ${endpoint}`);
                throw new Error('Request timeout - please check your connection');
            }
            
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getStories() {
        return this.request('/stories');
    }

    async createStory(storyData) {
        // Validate required fields before sending
        const required = ['coupleNames', 'storyTitle', 'loveStory', 'category', 'mood'];
        const missing = required.filter(field => !storyData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        return this.request('/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }

    async toggleLike(storyId) {
        if (!storyId || isNaN(storyId)) {
            throw new Error('Invalid story ID');
        }
        return this.request(`/stories/${storyId}/like`, {
            method: 'POST'
        });
    }

    async addComment(storyId, commentData) {
        if (!storyId || isNaN(storyId)) {
            throw new Error('Invalid story ID');
        }
        
        if (!commentData.text || commentData.text.trim() === '') {
            throw new Error('Comment text is required');
        }

        return this.request(`/stories/${storyId}/comments`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    async getComments(storyId) {
        if (!storyId || isNaN(storyId)) {
            throw new Error('Invalid story ID');
        }
        return this.request(`/stories/${storyId}/comments`);
    }

    async healthCheck() {
        return this.request('/health');
    }

    // Utility method to test connection
    async testConnection() {
        try {
            const health = await this.healthCheck();
            return {
                connected: true,
                database: health.database,
                timestamp: health.timestamp
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
}