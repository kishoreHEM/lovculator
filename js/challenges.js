// Social Media Challenges System
class SocialChallenges {
    constructor() {
        this.challenges = [
            {
                id: 'challenge_1',
                name: '💖 Love Story Marathon',
                description: 'Share 3 love stories in 24 hours',
                duration: 24, // hours
                reward: 'Story Master Badge',
                participants: 0,
                active: true,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'challenge_2',
                name: '👥 Community Builder',
                description: 'Get 10 comments on your love stories',
                duration: 48,
                reward: 'Community Star Badge',
                participants: 0,
                active: true,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'challenge_3',
                name: '📱 Social Sharer',
                description: 'Share 5 results on social media',
                duration: 72,
                reward: 'Social Butterfly Badge',
                participants: 0,
                active: true,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
            }
        ];
        this.init();
    }

    init() {
        this.loadChallengeProgress();
        this.displayChallenges();
        this.setupChallengeTracking();
    }

    displayChallenges() {
        const container = document.getElementById('challengesContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="challenges-header">
                <h3>🎯 Weekly Challenges</h3>
                <p>Complete challenges to earn exclusive badges!</p>
            </div>
            
            <div class="challenges-grid">
                ${this.challenges.map(challenge => `
                    <div class="challenge-card ${challenge.active ? 'active' : 'completed'}">
                        <div class="challenge-badge">🔥</div>
                        
                        <div class="challenge-content">
                            <h4>${challenge.name}</h4>
                            <p>${challenge.description}</p>
                            
                            <div class="challenge-meta">
                                <span class="duration">⏰ ${challenge.duration}h</span>
                                <span class="participants">👥 ${challenge.participants}</span>
                            </div>
                            
                            <div class="challenge-reward">
                                <span class="reward-icon">🏆</span>
                                Reward: ${challenge.reward}
                            </div>
                            
                            <div class="challenge-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${challenge.progress || 0}%"></div>
                                </div>
                                <span class="progress-text">${challenge.progress || 0}%</span>
                            </div>
                            
                            <button class="join-challenge-btn" 
                                    onclick="socialChallenges.joinChallenge('${challenge.id}')"
                                    ${challenge.joined ? 'disabled' : ''}>
                                ${challenge.joined ? '✅ Joined' : 'Join Challenge'}
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="challenges-leaderboard">
                <h4>🏆 Challenge Leaders</h4>
                <div class="leaderboard-list">
                    <div class="leaderboard-item">
                        <span class="rank">1</span>
                        <span class="name">LoveMaster42</span>
                        <span class="points">250 pts</span>
                    </div>
                    <div class="leaderboard-item">
                        <span class="rank">2</span>
                        <span class="name">RomanticSoul</span>
                        <span class="points">180 pts</span>
                    </div>
                    <div class="leaderboard-item">
                        <span class="rank">3</span>
                        <span class="name">CupidArrow</span>
                        <span class="points">150 pts</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupChallengeTracking() {
        // Track story sharing for challenges
        document.addEventListener('storyShared', () => {
            this.updateChallengeProgress('challenge_1', 1);
        });

        // Track comments for challenges
        document.addEventListener('commentPosted', () => {
            this.updateChallengeProgress('challenge_2', 1);
        });

        // Track social shares for challenges
        document.addEventListener('resultShared', () => {
            this.updateChallengeProgress('challenge_3', 1);
        });
    }

    joinChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge) return;

        challenge.joined = true;
        challenge.participants++;
        
        this.saveChallengeProgress();
        this.displayChallenges();
        this.showNotification(`Joined "${challenge.name}" challenge! 🎯`);
    }

    updateChallengeProgress(challengeId, increment) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge || !challenge.joined) return;

        if (!challenge.currentProgress) challenge.currentProgress = 0;
        if (!challenge.target) {
            // Set targets based on challenge
            switch(challengeId) {
                case 'challenge_1': challenge.target = 3; break;
                case 'challenge_2': challenge.target = 10; break;
                case 'challenge_3': challenge.target = 5; break;
            }
        }

        challenge.currentProgress += increment;
        challenge.progress = Math.min(100, (challenge.currentProgress / challenge.target) * 100);

        if (challenge.progress >= 100) {
            this.completeChallenge(challengeId);
        }

        this.saveChallengeProgress();
        this.displayChallenges();
    }

    completeChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge) return;

        challenge.active = false;
        challenge.completed = true;
        
        // Award points to achievement system
        if (typeof achievementSystem !== 'undefined') {
            achievementSystem.unlockAchievement({
                id: `challenge_${challengeId}`,
                name: challenge.reward,
                description: `Completed: ${challenge.name}`,
                icon: '🏆',
                points: 100,
                category: 'challenges'
            });
        }

        this.showNotification(`Challenge completed! 🎉 You earned: ${challenge.reward}`);
    }

    loadChallengeProgress() {
        const savedProgress = JSON.parse(localStorage.getItem('challengeProgress'));
        if (savedProgress) {
            this.challenges = this.challenges.map(challenge => {
                const saved = savedProgress.find(c => c.id === challenge.id);
                return saved ? {...challenge, ...saved} : challenge;
            });
        }
    }

    saveChallengeProgress() {
        localStorage.setItem('challengeProgress', JSON.stringify(this.challenges));
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'challenge-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize challenges
document.addEventListener('DOMContentLoaded', () => {
    window.socialChallenges = new SocialChallenges();
}); 