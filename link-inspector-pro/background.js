/**
 * Link Inspector Pro - Background Service Worker
 * Manages extension state and cross-script communication
 */

// Default settings
const DEFAULT_SETTINGS = {
	enabled: true,
	showUtm: true,
	showAnchors: true,
	showPopups: true,
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
	const stored = await chrome.storage.local.get('settings');
	if (!stored.settings) {
		await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
	}
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'GET_SETTINGS') {
		chrome.storage.local.get('settings').then((data) => {
			sendResponse(data.settings || DEFAULT_SETTINGS);
		});
		return true; // Async response
	}

	if (message.type === 'UPDATE_SETTINGS') {
		chrome.storage.local.set({ settings: message.settings }).then(() => {
			// Notify all tabs about settings change
			chrome.tabs.query({}, (tabs) => {
				tabs.forEach((tab) => {
					chrome.tabs
						.sendMessage(tab.id, {
							type: 'SETTINGS_UPDATED',
							settings: message.settings,
						})
						.catch(() => {}); // Ignore errors for tabs without content script
				});
			});
			sendResponse({ success: true });
		});
		return true;
	}

	if (message.type === 'GET_PAGE_DATA') {
		// Forward request to content script
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			if (tabs[0]) {
				chrome.tabs
					.sendMessage(tabs[0].id, { type: 'COLLECT_PAGE_DATA' })
					.then(sendResponse)
					.catch(() => sendResponse({ error: 'Unable to collect data' }));
			}
		});
		return true;
	}
});
