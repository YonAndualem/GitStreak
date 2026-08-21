document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const statsScreen = document.getElementById('stats-screen');
    const usernameInput = document.getElementById('username-input');
    const saveBtn = document.getElementById('save-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const streakCard = document.getElementById('streak-card');
    const loading = document.getElementById('loading');

    // DOM Elements for Stats
    const elTotal = document.getElementById('total-contributions');
    const elTotalDates = document.getElementById('total-dates');
    
    const elCurrent = document.getElementById('current-streak');
    const elCurrentDates = document.getElementById('current-dates');
    const currentRing = document.getElementById('current-ring');
    
    const elLongest = document.getElementById('longest-streak');
    const elLongestDates = document.getElementById('longest-dates');

    // API URL
    const API_BASE = 'http://localhost:3000/api/streak';

    chrome.storage.local.get(['githubUsername'], (result) => {
        if (result.githubUsername) {
            showStatsScreen(result.githubUsername);
        } else {
            showSetupScreen();
        }
    });

    saveBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
            chrome.storage.local.set({ githubUsername: username }, () => {
                showStatsScreen(username);
            });
        }
    });

    settingsBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['githubUsername'], () => {
            showSetupScreen();
        });
    });

    function showSetupScreen() {
        setupScreen.classList.remove('hidden');
        statsScreen.classList.add('hidden');
    }

    async function showStatsScreen(username) {
        setupScreen.classList.add('hidden');
        statsScreen.classList.remove('hidden');
        
        loading.classList.remove('hidden');
        streakCard.classList.add('hidden');
        
        try {
            const ts = new Date().getTime();
            const res = await fetch(`${API_BASE}?user=${username}&format=json&t=${ts}`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const data = await res.json();
            
            const stats = data.stats;
            const accountStart = new Date(data.accountStart);
            const today = new Date();
            
            const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const formatDateLong = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // 1. Total Contributions
            elTotal.textContent = stats.totalContributions.toLocaleString();
            elTotalDates.textContent = `${formatDateLong(accountStart)} - Present`;

            // 2. Current Streak
            elCurrent.textContent = stats.currentStreak;
            
            let streakEnd = new Date(today);
            if (!stats.hasCommittedToday && stats.currentStreak > 0) {
                streakEnd.setDate(streakEnd.getDate() - 1);
            }
            let streakStart = new Date(streakEnd);
            if (stats.currentStreak > 0) {
                streakStart.setDate(streakStart.getDate() - stats.currentStreak + 1);
            }
            
            elCurrentDates.textContent = stats.currentStreak > 0 
                ? `${formatDate(streakStart)} - ${formatDate(streakEnd)}` 
                : 'No active streak';

            // Ring Animation logic (match SVG logic)
            // circumference = 2 * PI * r = 251.2
            // percentage = currentStreak / 30 (cap at 100%)
            const percent = Math.min(stats.currentStreak / 30, 1);
            const offset = 251.2 - (percent * 251.2);
            // small delay to let CSS transition trigger
            setTimeout(() => {
                currentRing.style.strokeDashoffset = offset;
            }, 50);

            // 3. Longest Streak
            elLongest.textContent = stats.longestStreak;
            
            // Note: Our API doesn't return the longest streak start/end dates currently
            // We can just show "All time" for now or update API later.
            elLongestDates.textContent = 'All time longest';
            
            loading.classList.add('hidden');
            streakCard.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            loading.textContent = 'Failed to load stats. Is the Next.js server running?';
        }
    }
});
