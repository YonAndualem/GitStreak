document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const statsScreen = document.getElementById('stats-screen');
    const usernameInput = document.getElementById('username-input');
    const saveBtn = document.getElementById('save-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const streakImg = document.getElementById('streak-img');
    const heatmapContainer = document.getElementById('heatmap-container');
    const heatmapGrid = document.getElementById('heatmap-grid');
    const loading = document.getElementById('loading');

    // API URL - assuming the Next.js app is running locally for now
    const API_BASE = 'http://localhost:3000/api/streak';

    // Check if user is already saved
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
        chrome.storage.local.remove(['githubUsername', 'cachedSvgUrl'], () => {
            showSetupScreen();
        });
    });

    function showSetupScreen() {
        setupScreen.classList.remove('hidden');
        statsScreen.classList.add('hidden');
    }

    function showStatsScreen(username) {
        setupScreen.classList.add('hidden');
        statsScreen.classList.remove('hidden');
        
        // Setup greeting based on time of day
        const greetingHeader = document.getElementById('greeting-header');
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour >= 5 && hour < 12) greeting = 'Good morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        greetingHeader.textContent = `${greeting}, ${username}!`;
        
        // Heatmap is now always visible (sticky)
        heatmapContainer.classList.remove('hidden');
        
        // Helper to render heatmap from array
        const renderHeatmap = (heatmapDays) => {
            heatmapGrid.innerHTML = '';
            const recentDays = heatmapDays.slice(-266);
            recentDays.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'heatmap-day';
                cell.title = `${day.contributionCount} contributions on ${day.date}`;
                
                let level = 0;
                if (day.contributionCount > 0) level = 1;
                if (day.contributionCount > 3) level = 2;
                if (day.contributionCount > 6) level = 3;
                if (day.contributionCount > 10) level = 4;
                
                cell.classList.add(`level-${level}`);
                heatmapGrid.appendChild(cell);
            });
        };

        // 1. Try to load cached SVG and Heatmap immediately
        chrome.storage.local.get(['cachedSvgUrl', 'cachedHeatmapDays'], (result) => {
            if (result.cachedSvgUrl) {
                streakImg.src = result.cachedSvgUrl;
                loading.classList.add('hidden');
                streakImg.classList.remove('hidden');
            } else {
                loading.textContent = 'Generating stats...';
                loading.classList.remove('hidden');
                streakImg.classList.add('hidden');
            }
            if (result.cachedHeatmapDays) {
                renderHeatmap(result.cachedHeatmapDays);
            }
        });
        
        // Show dynamic status banner
        chrome.storage.local.get(['hasCommittedToday', 'streakActive'], (store) => {
            const banner = document.getElementById('status-banner');
            banner.classList.remove('hidden');
            
            if (store.hasCommittedToday === false) {
                banner.style.background = 'transparent';
                banner.style.border = 'none';
                banner.style.color = '#da3633';
                banner.textContent = '🔥 Your streak is at risk! You haven\'t pushed any code today.';
            } else {
                banner.style.background = 'transparent';
                banner.style.border = 'none';
                banner.style.color = '#39d353';
                banner.textContent = 'You are done for today! Your streak is safely growing.';
            }
        });
        
        // 2. Fetch fresh SVG and JSON in the background
        const ts = new Date().getTime();
        const freshUrl = `${API_BASE}?user=${username}&t=${ts}`;
        
        // Create an invisible image to load the fresh SVG in the background
        const preloadImg = new Image();
        preloadImg.onload = () => {
            streakImg.src = preloadImg.src;
            loading.classList.add('hidden');
            streakImg.classList.remove('hidden');
            
            fetch(freshUrl)
                .then(r => r.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => chrome.storage.local.set({ cachedSvgUrl: reader.result });
                    reader.readAsDataURL(blob);
                });
        };
        
        preloadImg.onerror = () => {
            console.error('Failed to load fresh SVG in background.');
            chrome.storage.local.get(['cachedSvgUrl'], (result) => {
                if (!result.cachedSvgUrl) {
                    loading.textContent = 'Failed to load streak stats. Is the server running?';
                }
            });
        };
        
        preloadImg.src = freshUrl;

        // Fetch JSON data to build the native heatmap
        const jsonUrl = `${API_BASE}?user=${username}&format=json&t=${ts}`;
        fetch(jsonUrl)
            .then(res => res.json())
            .then(data => {
                if (data.heatmapDays) {
                    chrome.storage.local.set({ cachedHeatmapDays: data.heatmapDays });
                    renderHeatmap(data.heatmapDays);
                }
            })
            .catch(err => console.error('Failed to fetch JSON data for heatmap', err));
    }
});
