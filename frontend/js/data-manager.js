// Data Manager for Lovculator Records
class DataManager {
    constructor() {
        this.storageKey = 'lovculator_data';
        this.init();
    }

    init() {
        // Initialize data structure if not exists
        if (!this.getData()) {
            this.resetData();
        }
        console.log('📊 Data Manager initialized');
    }

    getData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey)) || null;
        } catch (error) {
            console.error('Error reading data:', error);
            return null;
        }
    }

    saveData(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving data:', error);
            return false;
        }
    }

    resetData() {
        const defaultData = {
            version: '1.0.0',
            createdAt: new Date().toISOString(),
            users: {},
            loveCalculations: [],
            loveStories: [],
            achievements: [],
            activities: [],
            settings: {
                theme: 'auto',
                notifications: true,
                privacy: 'public'
            }
        };
        this.saveData(defaultData);
        return defaultData;
    }

    // Love Calculation Records
    addLoveCalculation(names, percentage, genders, message) {
        const data = this.getData();
        const calculation = {
            id: this.generateId(),
            name1: names[0],
            name2: names[1],
            gender1: genders[0],
            gender2: genders[1],
            percentage: percentage,
            message: message,
            timestamp: new Date().toISOString(),
            shared: false
        };

        data.loveCalculations.unshift(calculation);
        
        // Keep only last 100 calculations
        if (data.loveCalculations.length > 100) {
            data.loveCalculations = data.loveCalculations.slice(0, 100);
        }

        this.saveData(data);
        this.triggerUpdate('calculations');
        return calculation;
    }

    getLoveCalculations(limit = 20) {
        const data = this.getData();
        return data.loveCalculations.slice(0, limit);
    }

    getCalculationStats() {
        const data = this.getData();
        const calculations = data.loveCalculations;
        
        return {
            total: calculations.length,
            average: calculations.length > 0 ? 
                Math.round(calculations.reduce((sum, calc) => sum + calc.percentage, 0) / calculations.length) : 0,
            highest: calculations.length > 0 ? 
                Math.max(...calculations.map(calc => calc.percentage)) : 0,
            lowest: calculations.length > 0 ? 
                Math.min(...calculations.map(calc => calc.percentage)) : 0
        };
    }

    // Love Stories Records
    addLoveStory(storyData) {
        const data = this.getData();
        const story = {
            id: this.generateId(),
            ...storyData,
            likes: 0,
            comments: [],
            views: 0,
            timestamp: new Date().toISOString(),
            isPublic: true
        };

        data.loveStories.unshift(story);
        this.saveData(data);
        this.triggerUpdate('stories');
        return story;
    }

    getLoveStories(limit = 20) {
        const data = this.getData();
        return data.loveStories.slice(0, limit);
    }

    likeStory(storyId) {
        const data = this.getData();
        const story = data.loveStories.find(s => s.id === storyId);
        if (story) {
            story.likes = (story.likes || 0) + 1;
            this.saveData(data);
            this.triggerUpdate('stories');
            return story.likes;
        }
        return 0;
    }

    addComment(storyId, comment) {
        const data = this.getData();
        const story = data.loveStories.find(s => s.id === storyId);
        if (story) {
            if (!story.comments) story.comments = [];
            
            story.comments.unshift({
                id: this.generateId(),
                ...comment,
                timestamp: new Date().toISOString()
            });
            
            this.saveData(data);
            this.triggerUpdate('stories');
            return true;
        }
        return false;
    }

    // Achievement Records
    unlockAchievement(achievementData) {
        const data = this.getData();
        const achievement = {
            id: this.generateId(),
            ...achievementData,
            unlockedAt: new Date().toISOString(),
            seen: false
        };

        data.achievements.unshift(achievement);
        this.saveData(data);
        this.triggerUpdate('achievements');
        return achievement;
    }

    getAchievements() {
        const data = this.getData();
        return data.achievements;
    }

    markAchievementSeen(achievementId) {
        const data = this.getData();
        const achievement = data.achievements.find(a => a.id === achievementId);
        if (achievement) {
            achievement.seen = true;
            this.saveData(data);
            return true;
        }
        return false;
    }

    // Activity Records
    addActivity(type, data) {
        const activity = {
            id: this.generateId(),
            type: type,
            data: data,
            timestamp: new Date().toISOString()
        };

        const storedData = this.getData();
        storedData.activities.unshift(activity);
        
        // Keep only last 50 activities
        if (storedData.activities.length > 50) {
            storedData.activities = storedData.activities.slice(0, 50);
        }

        this.saveData(storedData);
        this.triggerUpdate('activities');
        return activity;
    }

    getActivities(limit = 20) {
        const data = this.getData();
        return data.activities.slice(0, limit);
    }

    // User Records
    updateUserStats(stats) {
        const data = this.getData();
        
        if (!data.users.main) {
            data.users.main = {
                id: 'user_' + Date.now(),
                createdAt: new Date().toISOString(),
                stats: {
                    calculations: 0,
                    stories: 0,
                    comments: 0,
                    likes: 0,
                    achievements: 0
                }
            };
        }

        // Update stats
        Object.keys(stats).forEach(key => {
            if (data.users.main.stats[key] !== undefined) {
                data.users.main.stats[key] += stats[key];
            }
        });

        this.saveData(data);
        this.triggerUpdate('user');
        return data.users.main;
    }

    getUserStats() {
        const data = this.getData();
        return data.users.main ? data.users.main.stats : null;
    }

    // Utility Methods
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    triggerUpdate(type) {
        const event = new CustomEvent('dataUpdated', {
            detail: { type: type, timestamp: new Date().toISOString() }
        });
        document.dispatchEvent(event);
    }

    // Export/Import Data
    exportData() {
        return JSON.stringify(this.getData(), null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data && data.version) {
                this.saveData(data);
                this.triggerUpdate('all');
                return true;
            }
        } catch (error) {
            console.error('Error importing data:', error);
        }
        return false;
    }

    // Clear specific data
    clearCalculations() {
        const data = this.getData();
        data.loveCalculations = [];
        this.saveData(data);
        this.triggerUpdate('calculations');
    }

    clearStories() {
        const data = this.getData();
        data.loveStories = [];
        this.saveData(data);
        this.triggerUpdate('stories');
    }

    // Get statistics
    getOverallStats() {
        const data = this.getData();
        return {
            totalCalculations: data.loveCalculations.length,
            totalStories: data.loveStories.length,
            totalAchievements: data.achievements.length,
            totalActivities: data.activities.length,
            dataSize: JSON.stringify(data).length
        };
    }
}

// Initialize Data Manager
window.dataManager = new DataManager();