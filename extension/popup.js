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
        
        const greetingHeader = document.getElementById('greeting-header');
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour >= 5 && hour < 12) greeting = 'Good morning';
        else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        greetingHeader.textContent = `${greeting}, ${username}!`;
        
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

        const setupBanner = (store) => {
            const banner = document.getElementById('status-banner');
            if (store.hasCommittedToday === undefined) return;
            
            banner.style.background = 'transparent';
            banner.style.border = 'none';
            banner.classList.remove('hidden');

            const updateTimer = () => {
                const now = new Date();
                const deadline = new Date();
                
                if (store.hasCommittedToday) {
                    deadline.setDate(deadline.getDate() + 1); // Tomorrow midnight
                }
                deadline.setHours(23, 59, 59, 999);
                
                const diff = deadline - now;
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours < 12) {
                    banner.style.color = '#da3633';
                    if (store.streakActive) {
                        banner.textContent = `Your streak is at risk! (Burns up in ${hours}h ${mins}m)`;
                    } else {
                        banner.textContent = 'You haven\'t pushed any code today. Commit now to start a new streak!';
                    }
                } else {
                    banner.style.color = '#39d353';
                    if (store.hasCommittedToday) {
                        banner.textContent = `You are done for today! (Next commit due in ${hours}h ${mins}m)`;
                    } else {
                        banner.textContent = `Your streak is currently safe for ${hours}h ${mins}m.`;
                    }
                }
            };
            
            updateTimer();
            // Clear any existing intervals if function runs multiple times
            if (window.bannerInterval) clearInterval(window.bannerInterval);
            window.bannerInterval = setInterval(updateTimer, 60000);
        };

        // 1. Check Cache First
        chrome.storage.local.get(['cachedSvgUrl', 'cachedHeatmapDays', 'hasCommittedToday', 'streakActive'], (result) => {
            if (result.cachedSvgUrl && result.cachedHeatmapDays) {
                // We have cache, show EVERYTHING instantly
                streakImg.src = result.cachedSvgUrl;
                loading.classList.add('hidden');
                streakImg.classList.remove('hidden');
                heatmapContainer.classList.remove('hidden');
                renderHeatmap(result.cachedHeatmapDays);
                setupBanner(result);
            } else {
                // First load. Hide everything except loading spinner.
                loading.textContent = 'Generating stats...';
                loading.classList.remove('hidden');
                streakImg.classList.add('hidden');
                heatmapContainer.classList.add('hidden');
                document.getElementById('status-banner').classList.add('hidden');
            }
        });
        
        // 2. Fetch fresh SVG and JSON
        const ts = new Date().getTime();
        const freshUrl = `${API_BASE}?user=${username}&t=${ts}`;
        
        const preloadImg = new Image();
        preloadImg.onload = () => {
            // Once SVG loads, reveal EVERYTHING
            streakImg.src = preloadImg.src;
            loading.classList.add('hidden');
            streakImg.classList.remove('hidden');
            heatmapContainer.classList.remove('hidden');
            
            // Re-render latest data from storage
            chrome.storage.local.get(['cachedHeatmapDays', 'hasCommittedToday', 'streakActive'], (result) => {
                if (result.cachedHeatmapDays) renderHeatmap(result.cachedHeatmapDays);
                setupBanner(result);
            });
            
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

        // Fetch JSON data for heatmap and stats
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
                    // Update the cache immediately so preloadImg.onload can use it!
                    chrome.storage.local.set({ 
                        cachedHeatmapDays: data.heatmapDays,
                        hasCommittedToday: data.stats.hasCommittedToday,
                        streakActive: data.stats.currentStreak > 0
                    });
                }
            })
            .catch(err => {
                console.error('Failed to fetch JSON data for heatmap', err);
                const errorStr = err.toString();
                if (errorStr.includes('Could not resolve to a User') || errorStr.includes('Not Found')) {
                    loading.textContent = 'User not found. Please click Logout and try again.';
                    loading.classList.remove('hidden');
                    streakImg.classList.add('hidden');
                    document.getElementById('status-banner').classList.add('hidden');
                    heatmapContainer.classList.add('hidden');
                }
            });
    }
});
