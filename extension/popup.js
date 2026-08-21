document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const statsScreen = document.getElementById('stats-screen');
    const usernameInput = document.getElementById('username-input');
    const saveBtn = document.getElementById('save-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const streakImg = document.getElementById('streak-img');
    const heatmapContainer = document.getElementById('heatmap-container');
    const heatmapImg = document.getElementById('heatmap-img');
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
        
        // Heatmap toggle logic
        streakImg.style.cursor = 'pointer';
        streakImg.title = "Click to toggle your contribution heatmap!";
        streakImg.onclick = () => {
            if (heatmapContainer.classList.contains('hidden')) {
                // Use a standard GitHub green theme for the heatmap
                heatmapImg.src = `https://ghchart.rshah.org/39d353/${username}`;
                heatmapContainer.classList.remove('hidden');
            } else {
                heatmapContainer.classList.add('hidden');
            }
        };
        
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
    }
});
