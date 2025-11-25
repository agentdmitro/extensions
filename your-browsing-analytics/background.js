/**
 * Your Browsing Analytics - Background Service Worker
 * Handles data collection, caching, and message passing
 */

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Cached data store
let cachedData = null;
let cacheTimestamp = 0;

/**
 * Domain categorization rules
 */
const CATEGORY_RULES = {
	work: [
		/github\.com/i,
		/gitlab\.com/i,
		/stackoverflow\.com/i,
		/slack\.com/i,
		/notion\.so/i,
		/trello\.com/i,
		/asana\.com/i,
		/jira\./i,
		/confluence\./i,
		/docs\.google\.com/i,
		/sheets\.google\.com/i,
		/drive\.google\.com/i,
		/linkedin\.com/i,
		/zoom\.us/i,
		/meet\.google\.com/i,
		/teams\.microsoft\.com/i,
		/figma\.com/i,
		/vercel\.com/i,
		/netlify\.com/i,
		/aws\.amazon\.com/i,
		/console\.cloud\.google/i,
		/azure\.microsoft\.com/i,
	],
	social: [
		/facebook\.com/i,
		/twitter\.com/i,
		/x\.com/i,
		/instagram\.com/i,
		/tiktok\.com/i,
		/snapchat\.com/i,
		/reddit\.com/i,
		/discord\.com/i,
		/telegram\./i,
		/whatsapp\.com/i,
		/messenger\.com/i,
		/pinterest\.com/i,
		/tumblr\.com/i,
	],
	entertainment: [
		/youtube\.com/i,
		/netflix\.com/i,
		/hulu\.com/i,
		/disneyplus\.com/i,
		/twitch\.tv/i,
		/spotify\.com/i,
		/soundcloud\.com/i,
		/hbomax\.com/i,
		/primevideo\.com/i,
		/crunchyroll\.com/i,
		/vimeo\.com/i,
		/dailymotion\.com/i,
		/gaming\./i,
		/ign\.com/i,
		/gamespot\.com/i,
	],
	shopping: [/amazon\./i, /ebay\./i, /etsy\.com/i, /walmart\.com/i, /target\.com/i, /bestbuy\.com/i, /aliexpress\.com/i, /shopify\.com/i],
	news: [
		/news\./i,
		/cnn\.com/i,
		/bbc\./i,
		/nytimes\.com/i,
		/theguardian\.com/i,
		/reuters\.com/i,
		/bloomberg\.com/i,
		/techcrunch\.com/i,
		/theverge\.com/i,
		/wired\.com/i,
		/arstechnica\.com/i,
	],
};

/**
 * Categorize a domain
 * @param {string} domain - Domain to categorize
 * @returns {string} Category name
 */
function categorize(domain) {
	for (const [category, patterns] of Object.entries(CATEGORY_RULES)) {
		for (const pattern of patterns) {
			if (pattern.test(domain)) {
				return category;
			}
		}
	}
	return 'other';
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string} Domain
 */
function extractDomain(url) {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname.replace(/^www\./, '');
	} catch {
		return 'unknown';
	}
}

/**
 * Fetch and process history data
 * @param {number} days - Number of days to fetch
 * @returns {Promise<Object>} Processed analytics data
 */
async function fetchHistoryData(days = 30) {
	const now = Date.now();
	const startTime = now - days * 24 * 60 * 60 * 1000;

	// Check cache validity
	if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
		return cachedData;
	}

	try {
		const historyItems = await chrome.history.search({
			text: '',
			startTime: startTime,
			maxResults: 10000,
		});

		// Process data
		const domainStats = {};
		const hourlyActivity = new Array(24).fill(0);
		const dailyActivity = new Array(7).fill(0);
		const categoryStats = { work: 0, social: 0, entertainment: 0, shopping: 0, news: 0, other: 0 };
		const pageStats = {};
		let todayVisits = 0;
		const todayStart = new Date().setHours(0, 0, 0, 0);

		for (const item of historyItems) {
			const domain = extractDomain(item.url);
			const visitCount = item.visitCount || 1;
			const lastVisit = item.lastVisitTime || now;

			// Domain stats
			if (!domainStats[domain]) {
				domainStats[domain] = { visits: 0, lastVisit: 0 };
			}
			domainStats[domain].visits += visitCount;
			domainStats[domain].lastVisit = Math.max(domainStats[domain].lastVisit, lastVisit);

			// Page stats
			const pageKey = item.url.substring(0, 100);
			if (!pageStats[pageKey]) {
				pageStats[pageKey] = { url: item.url, title: item.title || item.url, visits: 0 };
			}
			pageStats[pageKey].visits += visitCount;

			// Category stats
			const category = categorize(domain);
			categoryStats[category] += visitCount;

			// Hourly activity
			const visitDate = new Date(lastVisit);
			hourlyActivity[visitDate.getHours()] += visitCount;

			// Daily activity
			dailyActivity[visitDate.getDay()] += visitCount;

			// Today's visits
			if (lastVisit >= todayStart) {
				todayVisits += visitCount;
			}
		}

		// Sort and limit results
		const topDomains = Object.entries(domainStats)
			.map(([domain, data]) => ({ domain, ...data }))
			.sort((a, b) => b.visits - a.visits)
			.slice(0, 20);

		const topPages = Object.values(pageStats)
			.sort((a, b) => b.visits - a.visits)
			.slice(0, 50);

		const result = {
			topDomains,
			topPages,
			hourlyActivity,
			dailyActivity,
			categoryStats,
			todayVisits,
			totalItems: historyItems.length,
			fetchedAt: now,
		};

		// Update cache
		cachedData = result;
		cacheTimestamp = now;

		return result;
	} catch (error) {
		console.error('Error fetching history:', error);
		return null;
	}
}

/**
 * Handle messages from popup and dashboard
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'GET_ANALYTICS') {
		const days = message.days || 30;
		fetchHistoryData(days).then((data) => {
			sendResponse(data);
		});
		return true; // Async response
	}

	if (message.type === 'GET_TODAY_STATS') {
		fetchHistoryData(1).then((data) => {
			sendResponse({
				todayVisits: data?.todayVisits || 0,
				topDomains: data?.topDomains?.slice(0, 3) || [],
				hourlyActivity: data?.hourlyActivity || [],
			});
		});
		return true;
	}

	if (message.type === 'CLEAR_CACHE') {
		cachedData = null;
		cacheTimestamp = 0;
		sendResponse({ success: true });
		return true;
	}

	if (message.type === 'EXPORT_DATA') {
		fetchHistoryData(message.days || 30).then((data) => {
			sendResponse(data);
		});
		return true;
	}
});

// Initial data fetch on install
chrome.runtime.onInstalled.addListener(() => {
	fetchHistoryData(30);
});
