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
        
        // 1. Try to load cached SVG immediately
        chrome.storage.local.get(['cachedSvgUrl'], (result) => {
            if (result.cachedSvgUrl) {
                streakImg.src = result.cachedSvgUrl;
                loading.classList.add('hidden');
                streakImg.classList.remove('hidden');
            } else {
                loading.textContent = 'Generating stats...';
                loading.classList.remove('hidden');
                streakImg.classList.add('hidden');
            }
        });
        
        // Show warning banner if needed
        chrome.storage.local.get(['hasCommittedToday', 'streakActive'], (store) => {
            const banner = document.getElementById('action-banner');
            if (store.streakActive && store.hasCommittedToday === false) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        });
        
        // 2. Fetch fresh SVG in the background
        const ts = new Date().getTime();
        const freshUrl = `${API_BASE}?user=${username}&t=${ts}`;
        
        // Create an invisible image to load the fresh SVG in the background
        const preloadImg = new Image();
        preloadImg.onload = () => {
            // Once fully loaded, swap it into the UI
            streakImg.src = preloadImg.src;
            loading.classList.add('hidden');
            streakImg.classList.remove('hidden');
            
            // Save the URL to cache for next time
            // We use the same freshUrl but convert it to a data URI to cache it perfectly,
            // or we just save the freshUrl (but Chrome will have it in browser cache).
            // Actually, we can fetch it as text to save the exact SVG string, but saving the data URL is easiest.
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
                    heatmapGrid.innerHTML = '';
                    
                    // Our popup is 495px wide. A 10px box + 3px gap = 13px per column.
                    // 495 / 13 = ~38 columns. 38 columns * 7 days = 266 days.
                    // Slice the last 266 days to prevent grid overflow and show the latest ones!
                    const recentDays = data.heatmapDays.slice(-266);
                    
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
                }
            })
            .catch(err => console.error('Failed to fetch JSON data for heatmap', err));
    }
});
