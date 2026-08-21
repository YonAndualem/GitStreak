// Check streak every 60 minutes
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('checkStreak', { periodInMinutes: 60 });
    updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkStreak') {
        updateBadge();
    }
});

// Update badge when user changes their username in settings
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.githubUsername) {
        updateBadge();
    }
});

async function updateBadge() {
    chrome.storage.local.get(['githubUsername'], async (result) => {
        if (!result.githubUsername) {
            chrome.action.setBadgeText({ text: '' }); // Clear badge
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/api/streak?user=${result.githubUsername}&format=json`);
            if (!res.ok) return;
            
            const data = await res.json();
            const streak = data.stats.currentStreak.toString();
            const hasCommittedToday = data.stats.hasCommittedToday;
            
            // Set the badge text to the current streak number
            chrome.action.setBadgeText({ text: streak });

            // Green if committed today, Red if you still need to commit!
            if (hasCommittedToday) {
                chrome.action.setBadgeBackgroundColor({ color: '#39d353' }); // GitHub green
            } else {
                chrome.action.setBadgeBackgroundColor({ color: '#da3633' }); // GitHub red
            }
        } catch (error) {
            console.error('Background badge update failed:', error);
        }
    });
}
