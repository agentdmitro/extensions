/**
 * Your Browsing Analytics - Background Service Worker
 * Handles data collection, caching, and message passing
 */

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Cached data store
let cachedData = null;
let cacheTimestamp = 0;
let cachedDays = 0;

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
 * @param {number} startTimestamp - Optional custom start timestamp
 * @param {number} endTimestamp - Optional custom end timestamp
 * @returns {Promise<Object>} Processed analytics data
 */
async function fetchHistoryData(days = 30, startTimestamp = null, endTimestamp = null) {
	const now = Date.now();

	// Calculate time range
	let startTime, endTime;
	if (startTimestamp && endTimestamp) {
		startTime = startTimestamp;
		endTime = endTimestamp;
	} else {
		startTime = now - days * 24 * 60 * 60 * 1000;
		endTime = now;
	}

	// Check cache validity (only for non-custom ranges)
	if (!startTimestamp && cachedData && cachedDays === days && now - cacheTimestamp < CACHE_DURATION) {
		return cachedData;
	}

	try {
		const historyItems = await chrome.history.search({
			text: '',
			startTime: startTime,
			endTime: endTime,
			maxResults: 10000,
		});

		// Get detailed visit information for more accurate counting
		const domainStats = {};
		const hourlyActivity = new Array(24).fill(0);
		const dailyActivity = new Array(7).fill(0);
		const categoryStats = { work: 0, social: 0, entertainment: 0, shopping: 0, news: 0, other: 0 };
		const pageStats = {};
		let totalVisits = 0;
		let todayVisits = 0;
		const todayStart = new Date().setHours(0, 0, 0, 0);

		// Process each history item with actual visits
		for (const item of historyItems) {
			const domain = extractDomain(item.url);

			// Get actual visits for this URL
			let visits;
			try {
				visits = await chrome.history.getVisits({ url: item.url });
				// Filter visits within our time range
				visits = visits.filter((v) => v.visitTime >= startTime && v.visitTime <= endTime);
			} catch {
				visits = [{ visitTime: item.lastVisitTime || now }];
			}

			const visitCount = visits.length;
			if (visitCount === 0) continue;

			totalVisits += visitCount;

			// Domain stats
			if (!domainStats[domain]) {
				domainStats[domain] = { visits: 0, lastVisit: 0 };
			}
			domainStats[domain].visits += visitCount;
			domainStats[domain].lastVisit = Math.max(domainStats[domain].lastVisit, item.lastVisitTime || 0);

			// Page stats
			const pageKey = item.url.substring(0, 150);
			if (!pageStats[pageKey]) {
				pageStats[pageKey] = { url: item.url, title: item.title || item.url, visits: 0 };
			}
			pageStats[pageKey].visits += visitCount;

			// Category stats
			const category = categorize(domain);
			categoryStats[category] += visitCount;

			// Process each individual visit for time-based stats
			for (const visit of visits) {
				const visitDate = new Date(visit.visitTime);
				hourlyActivity[visitDate.getHours()]++;
				dailyActivity[visitDate.getDay()]++;

				// Today's visits
				if (visit.visitTime >= todayStart) {
					todayVisits++;
				}
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
			totalVisits,
			totalItems: historyItems.length,
			fetchedAt: now,
			dateRange: {
				start: startTime,
				end: endTime,
				days: days,
			},
		};

		// Update cache (only for non-custom ranges)
		if (!startTimestamp) {
			cachedData = result;
			cacheTimestamp = now;
			cachedDays = days;
		}

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
		const startTimestamp = message.startTimestamp || null;
		const endTimestamp = message.endTimestamp || null;

		fetchHistoryData(days, startTimestamp, endTimestamp).then((data) => {
			sendResponse(data);
		});
		return true;
	}

	if (message.type === 'GET_TODAY_STATS') {
		// Fetch only today's data for accurate stats
		const todayStart = new Date().setHours(0, 0, 0, 0);
		const now = Date.now();

		fetchHistoryData(1, todayStart, now).then((data) => {
			sendResponse({
				todayVisits: data?.totalVisits || 0,
				topDomains: data?.topDomains?.slice(0, 3) || [],
				hourlyActivity: data?.hourlyActivity || [],
			});
		});
		return true;
	}

	if (message.type === 'CLEAR_CACHE') {
		cachedData = null;
		cacheTimestamp = 0;
		cachedDays = 0;
		sendResponse({ success: true });
		return true;
	}

	if (message.type === 'EXPORT_DATA') {
		const startTimestamp = message.startTimestamp || null;
		const endTimestamp = message.endTimestamp || null;
		fetchHistoryData(message.days || 30, startTimestamp, endTimestamp).then((data) => {
			sendResponse(data);
		});
		return true;
	}
});

// Initial data fetch on install
chrome.runtime.onInstalled.addListener(() => {
	fetchHistoryData(30);
});
