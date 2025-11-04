// Simple Records Manager
class SimpleRecordsManager {
    constructor() {
        this.init();
    }

    init() {
        this.loadStats();
        this.setupEventListeners();
        console.log('📊 Records Manager initialized');
    }

    loadStats() {
        const stats = window.simpleStats.getCurrentStats();
        
        // Update UI
        document.getElementById('totalCalculations').textContent = stats.totalCalculations;
        document.getElementById('totalStories').textContent = stats.totalStories;
        document.getElementById('totalLikes').textContent = stats.totalLikes;
        document.getElementById('totalComments').textContent = stats.totalComments;
        
        // Update last updated time
        const lastUpdated = document.getElementById('lastUpdated');
        if (lastUpdated) {
            lastUpdated.textContent = new Date(stats.lastUpdated).toLocaleDateString();
        }
    }

    setupEventListeners() {
        // Update stats when they change
        document.addEventListener('statsUpdated', () => {
            this.loadStats();
        });
    }
}

// Export function
function exportStats() {
    const stats = window.simpleStats.exportStats();
    const blob = new Blob([stats], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `lovculator-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    alert('Your stats have been exported! 📤\n\nThis file contains anonymous activity counts only.');
}

// Clear stats function
function clearStats() {
    if (confirm('Are you sure you want to reset all your activity statistics?\n\nThis will clear your counts but keep your stories and calculations.')) {
        window.simpleStats.clearStats();
        alert('Statistics reset successfully! 🔄');
        // Stats will auto-update via the event listener
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SimpleRecordsManager();
});