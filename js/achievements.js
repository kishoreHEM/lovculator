// Achievement Badges System
class AchievementSystem {
    constructor() {
        this.achievements = JSON.parse(localStorage.getItem('userAchievements')) || [];
        this.userStats = JSON.parse(localStorage.getItem('userStats')) || this.initializeStats();
        this.isInitialized = false;
    }

    initializeStats() {
        const stats = {
            storiesShared: 0,
            commentsPosted: 0,
            likesGiven: 0,
            calculationsDone: 0,
            consecutiveDays: 0,
            lastActivityDate: null
        };
        localStorage.setItem('userStats', JSON.stringify(stats));
        return stats;
    }

    init() {
        if (this.isInitialized) return;
        
        console.log('🏆 AchievementSystem initializing...');
        this.checkDailyLogin();
        this.setupAchievementListeners();
        this.displayAchievements();
        this.isInitialized = true;
        
        console.log('🏆 AchievementSystem ready. Stats:', this.userStats);
    }

    setupAchievementListeners() {
        // Listen for love calculations
        document.addEventListener('loveCalculated', (e) => {
            console.log('🏆 Love calculation recorded');
            this.recordCalculation();
        });

        // Listen for story sharing
        document.addEventListener('storyShared', (e) => {
            console.log('🏆 Story shared recorded');
            this.recordStoryShared();
        });

        // Listen for comments
        document.addEventListener('commentPosted', (e) => {
            console.log('🏆 Comment posted recorded');
            this.recordComment();
        });

        // Listen for likes
        document.addEventListener('likeGiven', (e) => {
            console.log('🏆 Like given recorded');
            this.recordLike();
        });

        // Listen for page changes to refresh display
        document.addEventListener('pageChanged', () => {
            setTimeout(() => this.displayAchievements(), 100);
        });
    }

    // Public methods to record achievements directly (alternative to events)
    recordCalculationDirect() {
        this.recordCalculation();
    }

    recordStorySharedDirect() {
        this.recordStoryShared();
    }

    recordCommentDirect() {
        this.recordComment();
    }

    recordLikeDirect() {
        this.recordLike();
    }

    recordCalculation() {
        this.userStats.calculationsDone++;
        console.log(`🏆 Calculations: ${this.userStats.calculationsDone}`);
        this.checkCalculationAchievements();
        this.saveStats();
        this.displayAchievements();
    }

    recordStoryShared() {
        this.userStats.storiesShared++;
        console.log(`🏆 Stories shared: ${this.userStats.storiesShared}`);
        this.checkStoryAchievements();
        this.saveStats();
        this.displayAchievements();
    }

    recordComment() {
        this.userStats.commentsPosted++;
        console.log(`🏆 Comments: ${this.userStats.commentsPosted}`);
        this.checkCommentAchievements();
        this.saveStats();
        this.displayAchievements();
    }

    recordLike() {
        this.userStats.likesGiven++;
        console.log(`🏆 Likes: ${this.userStats.likesGiven}`);
        this.checkLikeAchievements();
        this.saveStats();
        this.displayAchievements();
    }

    checkDailyLogin() {
        const today = new Date().toDateString();
        console.log(`🏆 Checking daily login. Last: ${this.userStats.lastActivityDate}, Today: ${today}`);
        
        if (this.userStats.lastActivityDate !== today) {
            if (this.userStats.lastActivityDate) {
                const lastDate = new Date(this.userStats.lastActivityDate);
                const todayDate = new Date(today);
                const diffTime = Math.abs(todayDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    this.userStats.consecutiveDays++;
                    console.log(`🏆 Consecutive days: ${this.userStats.consecutiveDays}`);
                } else if (diffDays > 1) {
                    this.userStats.consecutiveDays = 1;
                    console.log('🏆 Streak broken, starting over');
                }
            } else {
                this.userStats.consecutiveDays = 1;
                console.log('🏆 First login recorded');
            }
            
            this.userStats.lastActivityDate = today;
            this.checkDailyLoginAchievements();
            this.saveStats();
        }
    }

    checkCalculationAchievements() {
        const milestones = [1, 5, 10, 25, 50, 100];
        milestones.forEach(milestone => {
            if (this.userStats.calculationsDone === milestone && !this.hasAchievement(`calc_${milestone}`)) {
                this.unlockAchievement({
                    id: `calc_${milestone}`,
                    name: `Love Detective ${milestone}`,
                    description: `Performed ${milestone} love calculations`,
                    icon: '🔍',
                    points: milestone * 10,
                    category: 'calculations'
                });
            }
        });
    }

    checkStoryAchievements() {
        const milestones = [1, 3, 5, 10, 20];
        milestones.forEach(milestone => {
            if (this.userStats.storiesShared === milestone && !this.hasAchievement(`story_${milestone}`)) {
                this.unlockAchievement({
                    id: `story_${milestone}`,
                    name: `Storyteller ${milestone}`,
                    description: `Shared ${milestone} love stories`,
                    icon: '📖',
                    points: milestone * 15,
                    category: 'stories'
                });
            }
        });
    }

    checkCommentAchievements() {
        const milestones = [5, 10, 25, 50, 100];
        milestones.forEach(milestone => {
            if (this.userStats.commentsPosted === milestone && !this.hasAchievement(`comment_${milestone}`)) {
                this.unlockAchievement({
                    id: `comment_${milestone}`,
                    name: `Community Supporter ${milestone}`,
                    description: `Posted ${milestone} comments`,
                    icon: '💬',
                    points: milestone * 5,
                    category: 'community'
                });
            }
        });
    }

    checkLikeAchievements() {
        const milestones = [10, 25, 50, 100, 200];
        milestones.forEach(milestone => {
            if (this.userStats.likesGiven === milestone && !this.hasAchievement(`like_${milestone}`)) {
                this.unlockAchievement({
                    id: `like_${milestone}`,
                    name: `Heart Warrior ${milestone}`,
                    description: `Gave ${milestone} likes`,
                    icon: '❤️',
                    points: milestone * 3,
                    category: 'engagement'
                });
            }
        });
    }

    checkDailyLoginAchievements() {
        const milestones = [3, 7, 14, 30, 60, 90];
        milestones.forEach(milestone => {
            if (this.userStats.consecutiveDays === milestone && !this.hasAchievement(`daily_${milestone}`)) {
                this.unlockAchievement({
                    id: `daily_${milestone}`,
                    name: `Dedicated Lover ${milestone}`,
                    description: `Logged in for ${milestone} consecutive days`,
                    icon: '🔥',
                    points: milestone * 20,
                    category: 'dedication'
                });
            }
        });
    }

    hasAchievement(achievementId) {
        return this.achievements.some(ach => ach.id === achievementId);
    }

    unlockAchievement(achievement) {
        achievement.unlockedAt = new Date().toISOString();
        this.achievements.push(achievement);
        this.saveAchievements();
        this.showAchievementNotification(achievement);
        this.displayAchievements();
        
        console.log(`🏆 Achievement unlocked: ${achievement.name}`);
    }

    showAchievementNotification(achievement) {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.achievement-notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-popup">
                <div class="achievement-icon">${achievement.icon}</div>
                <div class="achievement-content">
                    <h4>Achievement Unlocked!</h4>
                    <h5>${achievement.name}</h5>
                    <p>${achievement.description}</p>
                    <span class="achievement-points">+${achievement.points} points</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Auto-remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 500);
        }, 4000);
    }

    displayAchievements() {
        const container = document.getElementById('achievementsContainer');
        if (!container) {
            console.log('🏆 Achievements container not found on this page');
            return;
        }

        const totalPoints = this.achievements.reduce((sum, ach) => sum + ach.points, 0);
        
        container.innerHTML = `
            <div class="achievements-header">
                <h3>🏆 Your Achievements</h3>
                <div class="total-points">${totalPoints} points</div>
            </div>
            <div class="achievements-grid">
                ${this.achievements.map(achievement => `
                    <div class="achievement-card ${achievement.category}">
                        <div class="achievement-icon">${achievement.icon}</div>
                        <div class="achievement-info">
                            <h4>${achievement.name}</h4>
                            <p>${achievement.description}</p>
                            <div class="achievement-meta">
                                <span class="achievement-points">${achievement.points} pts</span>
                                <span class="achievement-date">${new Date(achievement.unlockedAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                ${this.achievements.length === 0 ? `
                    <div class="no-achievements">
                        <div class="no-achievements-icon">🎯</div>
                        <h4>No achievements yet!</h4>
                        <p>Start calculating love and sharing stories to earn achievements!</p>
                    </div>
                ` : ''}
            </div>
            
            <div class="achievements-progress">
                <h4>Progress Overview</h4>
                <div class="progress-stats">
                    <div class="stat">
                        <span class="stat-value">${this.userStats.calculationsDone}</span>
                        <span class="stat-label">Calculations</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${this.userStats.storiesShared}</span>
                        <span class="stat-label">Stories</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${this.userStats.commentsPosted}</span>
                        <span class="stat-label">Comments</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${this.userStats.likesGiven}</span>
                        <span class="stat-label">Likes</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${this.userStats.consecutiveDays}</span>
                        <span class="stat-label">Days</span>
                    </div>
                </div>
            </div>
        `;
        
        console.log('🏆 Achievements displayed');
    }

    // Public method to refresh display
    refreshDisplay() {
        this.displayAchievements();
    }

    // Public method to get current stats
    getStats() {
        return { ...this.userStats };
    }

    // Public method to get achievements
    getAchievements() {
        return [...this.achievements];
    }

    // Public method to get total points
    getTotalPoints() {
        return this.achievements.reduce((sum, ach) => sum + ach.points, 0);
    }

    // Public method to reset everything (for testing)
    resetAll() {
        this.achievements = [];
        this.userStats = this.initializeStats();
        this.saveAchievements();
        this.saveStats();
        this.displayAchievements();
        console.log('🏆 All achievements and stats reset');
    }

    saveStats() {
        localStorage.setItem('userStats', JSON.stringify(this.userStats));
    }

    saveAchievements() {
        localStorage.setItem('userAchievements', JSON.stringify(this.achievements));
    }
}

// Initialize achievement system with better error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.achievementSystem = new AchievementSystem();
        window.achievementSystem.init();
        console.log('🏆 AchievementSystem loaded successfully');
    } catch (error) {
        console.error('🏆 Failed to initialize AchievementSystem:', error);
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AchievementSystem;
}