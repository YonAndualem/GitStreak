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
            const res = await fetch(`https://git-streak-phi.vercel.app/api/streak?user=${result.githubUsername}&format=json`);
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
            
            // Save state for the popup UI
            chrome.storage.local.set({ 
                streakActive: data.stats.currentStreak > 0,
                hasCommittedToday: hasCommittedToday 
            });
            
            // Desktop Notification Logic (Check if it's past 8 PM (20:00) and no commit today)
            const hour = new Date().getHours();
            const todayStr = new Date().toISOString().split('T')[0];
            
            if (!hasCommittedToday && data.stats.currentStreak > 0 && hour >= 20) {
                chrome.storage.local.get(['lastNotificationDate'], (store) => {
                    if (store.lastNotificationDate !== todayStr) {
                        chrome.notifications.create('commitReminder', {
                            type: 'basic',
                            iconUrl: 'icons/icon128.png',
                            title: 'GitStreak Reminder 🔥',
                            message: `Your ${streak}-day streak is at risk! You haven't pushed any code today.`,
                            priority: 2
                        });
                        chrome.storage.local.set({ lastNotificationDate: todayStr });
                    }
                });
            }

        } catch (error) {
            console.error('Background badge update failed:', error);
        }
    });
}
