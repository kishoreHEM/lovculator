// Records Page Functionality
class RecordsManager {
    constructor() {
        this.init();
    }

    init() {
        this.loadStats();
        this.loadCalculations();
        this.setupEventListeners();
    }

    loadStats() {
        const stats = window.dataManager.getCalculationStats();
        const overallStats = window.dataManager.getOverallStats();

        document.getElementById('totalCalculations').textContent = stats.total;
        document.getElementById('averagePercentage').textContent = stats.average + '%';
        document.getElementById('totalStories').textContent = overallStats.totalStories;
        document.getElementById('totalAchievements').textContent = overallStats.totalAchievements;
    }

    loadCalculations() {
        const calculations = window.dataManager.getLoveCalculations(10);
        const container = document.getElementById('calculationsList');

        if (calculations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔮</div>
                    <h4>No calculations yet</h4>
                    <p>Start calculating love compatibility to see your records here!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = calculations.map(calc => `
            <div class="calculation-record">
                <div class="calc-names">
                    <strong>${calc.name1}</strong> ❤️ <strong>${calc.name2}</strong>
                </div>
                <div class="calc-percentage">${calc.percentage}%</div>
                <div class="calc-meta">
                    <span class="calc-date">${new Date(calc.timestamp).toLocaleDateString()}</span>
                    <span class="calc-genders">${calc.gender1 === 'male' ? '👨' : '👩'} & ${calc.gender2 === 'male' ? '👨' : '👩'}</span>
                </div>
                <div class="calc-message">${calc.message}</div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        document.addEventListener('dataUpdated', (e) => {
            if (e.detail.type === 'calculations') {
                this.loadStats();
                this.loadCalculations();
            }
        });
    }
}

// Export/Import Functions
function exportData() {
    const data = window.dataManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `lovculator-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Data exported successfully! 📤');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = event => {
            const success = window.dataManager.importData(event.target.result);
            if (success) {
                alert('Data imported successfully! 📥');
                window.location.reload();
            } else {
                alert('Error importing data. Please check the file format.');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function clearCalculations() {
    if (confirm('Are you sure you want to clear all calculation history? This cannot be undone.')) {
        window.dataManager.clearCalculations();
        alert('Calculation history cleared!');
        window.location.reload();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new RecordsManager();
});