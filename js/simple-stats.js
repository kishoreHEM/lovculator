// Simple Stats Tracker for Lovculator
class SimpleStats {
    constructor() {
        this.storageKey = 'lovculator_simple_stats';
        this.init();
    }

    init() {
        // Initialize if not exists
        if (!this.getStats()) {
            this.resetStats();
        }
        console.log('📊 Simple Stats initialized');
    }

    getStats() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey));
        } catch (error) {
            console.error('Error reading stats:', error);
            return null;
        }
    }

    saveStats(stats) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(stats));
            return true;
        } catch (error) {
            console.error('Error saving stats:', error);
            return false;
        }
    }

    resetStats() {
        const defaultStats = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            totalCalculations: 0,
            totalStories: 0,
            totalLikes: 0,
            totalComments: 0,
            lastUpdated: new Date().toISOString()
        };
        this.saveStats(defaultStats);
        return defaultStats;
    }

    // Track different activities
    trackCalculation() {
        const stats = this.getStats();
        stats.totalCalculations++;
        stats.lastUpdated = new Date().toISOString();
        this.saveStats(stats);
        this.triggerUpdate();
        return stats.totalCalculations;
    }

    trackStory() {
        const stats = this.getStats();
        stats.totalStories++;
        stats.lastUpdated = new Date().toISOString();
        this.saveStats(stats);
        this.triggerUpdate();
        return stats.totalStories;
    }

    trackLike() {
        const stats = this.getStats();
        stats.totalLikes++;
        stats.lastUpdated = new Date().toISOString();
        this.saveStats(stats);
        this.triggerUpdate();
        return stats.totalLikes;
    }

    trackComment() {
        const stats = this.getStats();
        stats.totalComments++;
        stats.lastUpdated = new Date().toISOString();
        this.saveStats(stats);
        this.triggerUpdate();
        return stats.totalComments;
    }

    // Get current stats
    getCurrentStats() {
        return this.getStats();
    }

    // Event for UI updates
    triggerUpdate() {
        const event = new CustomEvent('statsUpdated', {
            detail: { timestamp: new Date().toISOString() }
        });
        document.dispatchEvent(event);
    }

    // Export stats (simple version)
    exportStats() {
        return JSON.stringify(this.getStats(), null, 2);
    }

    // Clear all stats
    clearStats() {
        this.resetStats();
        this.triggerUpdate();
        return true;
    }
}

// Initialize Simple Stats
window.simpleStats = new SimpleStats();