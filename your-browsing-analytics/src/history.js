/**
 * Your Browsing Analytics - History Module
 * Wrapper for chrome.history API interactions
 */

/**
 * Request analytics data from background script
 * @param {number} days - Number of days to analyze
 * @returns {Promise<Object>} Analytics data
 */
export async function getAnalytics(days = 30) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'GET_ANALYTICS', days }, (response) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}
			resolve(response);
		});
	});
}

/**
 * Get today's quick stats
 * @returns {Promise<Object>} Today's statistics
 */
export async function getTodayStats() {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' }, (response) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}
			resolve(response);
		});
	});
}

/**
 * Clear cached data
 * @returns {Promise<boolean>} Success status
 */
export async function clearCache() {
	return new Promise((resolve) => {
		chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, (response) => {
			resolve(response?.success || false);
		});
	});
}

/**
 * Export analytics data
 * @param {number} days - Number of days to export
 * @returns {Promise<Object>} Export data
 */
export async function exportData(days = 30) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage({ type: 'EXPORT_DATA', days }, (response) => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}
			resolve(response);
		});
	});
}

/**
 * Download data as JSON file
 * @param {Object} data - Data to download
 * @param {string} filename - Filename
 */
export function downloadAsJson(data, filename = 'browsing-analytics.json') {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();

	URL.revokeObjectURL(url);
}
