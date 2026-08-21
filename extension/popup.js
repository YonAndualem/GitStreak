document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const statsScreen = document.getElementById('stats-screen');
    const usernameInput = document.getElementById('username-input');
    const saveBtn = document.getElementById('save-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const streakImg = document.getElementById('streak-img');
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
        chrome.storage.local.remove(['githubUsername'], () => {
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
        
        loading.classList.remove('hidden');
        streakImg.classList.add('hidden');
        
        // Cache bust so it always loads fresh when the popup opens
        const ts = new Date().getTime();
        streakImg.src = `${API_BASE}?user=${username}&t=${ts}`;
        
        streakImg.onload = () => {
            loading.classList.add('hidden');
            streakImg.classList.remove('hidden');
        };
        
        streakImg.onerror = () => {
            loading.textContent = 'Failed to load streak stats. Is the server running?';
        };
    }
});
