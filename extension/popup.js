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

    saveBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        if (!username) return;

        const errorDiv = document.getElementById('login-error');
        errorDiv.classList.add('hidden');

        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Checking...';
        saveBtn.disabled = true;

        try {
            const ts = new Date().getTime();
            const res = await fetch(`${API_BASE}?user=${username}&format=json&t=${ts}`);
            
            if (!res.ok) {
                throw new Error('User not found');
            }
            
            const data = await res.json();
            
            // Save the verified user and their initial stats cache immediately!
            chrome.storage.local.set({ 
                githubUsername: username,
                cachedHeatmapDays: data.heatmapDays,
                hasCommittedToday: data.stats.hasCommittedToday,
                streakActive: data.stats.currentStreak > 0
            }, () => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
                showStatsScreen(username);
            });

        } catch (error) {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            errorDiv.textContent = 'User not found. Please verify the GitHub username.';
            errorDiv.classList.remove('hidden');
        }
    });

    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    settingsBtn.addEventListener('click', () => {
        chrome.storage.local.remove([
            'githubUsername', 
            'cachedSvgUrl', 
            'cachedHeatmapDays', 
            'hasCommittedToday', 
            'streakActive',
            'lastNotificationDate'
        ], () => {
            usernameInput.value = '';
            document.getElementById('login-error').classList.add('hidden');
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
            
            if (store.hasCommittedToday === undefined) {
                banner.classList.add('hidden');
                return;
            }
            
            banner.classList.remove('hidden');
            
            if (store.hasCommittedToday === false) {
                banner.style.background = 'transparent';
                banner.style.border = 'none';
                banner.style.color = '#da3633';
                
                if (store.streakActive) {
                    const updateTimer = () => {
                        const now = new Date();
                        const midnight = new Date();
                        midnight.setHours(23, 59, 59, 999);
                        const diff = midnight - now;
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        banner.textContent = `Your streak is at risk! You haven't pushed any code today. (Burns up in ${hours}h ${mins}m)`;
                    };
                    updateTimer();
                    setInterval(updateTimer, 60000); // Update every minute
                } else {
                    banner.textContent = 'You haven\'t pushed any code today. Commit now to start a new streak!';
                }
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
            .then(async res => {
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(errText);
                }
                return res.json();
            })
            .then(data => {
                if (data.heatmapDays) {
                    chrome.storage.local.set({ cachedHeatmapDays: data.heatmapDays });
                    renderHeatmap(data.heatmapDays);
                }
            })
            .catch(err => {
                console.error('Failed to fetch JSON data for heatmap', err);
                const errorStr = err.toString();
                if (errorStr.includes('Could not resolve to a User') || errorStr.includes('Not Found')) {
                    // Update the loading text that the image onerror also touches
                    loading.textContent = 'User not found. Please click Logout and try again.';
                    loading.classList.remove('hidden');
                    streakImg.classList.add('hidden');
                    // Hide the banner and heatmap if they are visible
                    document.getElementById('status-banner').classList.add('hidden');
                    heatmapContainer.classList.add('hidden');
                }
            });
    }
});
