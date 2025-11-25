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
 * Domain categorization rules - EXPANDED
 */
const CATEGORY_RULES = {
	work: [
		/github\.com/i,
		/gitlab\.com/i,
		/bitbucket\.org/i,
		/stackoverflow\.com/i,
		/stackexchange\.com/i,
		/slack\.com/i,
		/notion\.so/i,
		/notion\.com/i,
		/trello\.com/i,
		/asana\.com/i,
		/monday\.com/i,
		/jira\./i,
		/atlassian\./i,
		/confluence\./i,
		/docs\.google\.com/i,
		/sheets\.google\.com/i,
		/slides\.google\.com/i,
		/drive\.google\.com/i,
		/calendar\.google\.com/i,
		/mail\.google\.com/i,
		/outlook\./i,
		/office\.com/i,
		/linkedin\.com/i,
		/zoom\.us/i,
		/meet\.google\.com/i,
		/teams\.microsoft\.com/i,
		/figma\.com/i,
		/canva\.com/i,
		/miro\.com/i,
		/vercel\.com/i,
		/netlify\.com/i,
		/heroku\.com/i,
		/digitalocean\.com/i,
		/aws\.amazon\.com/i,
		/console\.cloud\.google/i,
		/azure\.microsoft\.com/i,
		/codepen\.io/i,
		/codesandbox\.io/i,
		/replit\.com/i,
		/npmjs\.com/i,
		/packagist\.org/i,
		/pypi\.org/i,
		/medium\.com/i,
		/dev\.to/i,
		/hashnode\.com/i,
		/coursera\.org/i,
		/udemy\.com/i,
		/skillshare\.com/i,
		/pluralsight\.com/i,
		/egghead\.io/i,
		/frontendmasters\.com/i,
		/w3schools\.com/i,
		/mdn\.mozilla/i,
		/developer\.mozilla/i,
		/freecodecamp\.org/i,
	],
	social: [
		/facebook\.com/i,
		/fb\.com/i,
		/twitter\.com/i,
		/x\.com/i,
		/instagram\.com/i,
		/tiktok\.com/i,
		/snapchat\.com/i,
		/reddit\.com/i,
		/discord\.com/i,
		/discord\.gg/i,
		/telegram\.org/i,
		/t\.me/i,
		/web\.telegram/i,
		/whatsapp\.com/i,
		/messenger\.com/i,
		/pinterest\.com/i,
		/tumblr\.com/i,
		/threads\.net/i,
		/mastodon\./i,
		/bsky\.app/i,
		/quora\.com/i,
		/vk\.com/i,
		/ok\.ru/i,
	],
	entertainment: [
		/youtube\.com/i,
		/youtu\.be/i,
		/netflix\.com/i,
		/hulu\.com/i,
		/disneyplus\.com/i,
		/disney\+/i,
		/twitch\.tv/i,
		/spotify\.com/i,
		/open\.spotify/i,
		/soundcloud\.com/i,
		/hbomax\.com/i,
		/max\.com/i,
		/primevideo\.com/i,
		/amazon\.com\/Prime-Video/i,
		/crunchyroll\.com/i,
		/vimeo\.com/i,
		/dailymotion\.com/i,
		/gaming\./i,
		/ign\.com/i,
		/gamespot\.com/i,
		/kotaku\.com/i,
		/polygon\.com/i,
		/steampowered\.com/i,
		/store\.steampowered/i,
		/epicgames\.com/i,
		/gog\.com/i,
		/twitch\.tv/i,
		/mixer\.com/i,
		/kick\.com/i,
		/9gag\.com/i,
		/imgur\.com/i,
		/giphy\.com/i,
		/tenor\.com/i,
		/tubi\.tv/i,
		/pluto\.tv/i,
		/peacocktv\.com/i,
		/apple\.com\/tv/i,
		/music\.apple/i,
		/music\.youtube/i,
		/deezer\.com/i,
		/tidal\.com/i,
		/pandora\.com/i,
	],
	shopping: [
		/amazon\./i,
		/ebay\./i,
		/etsy\.com/i,
		/walmart\.com/i,
		/target\.com/i,
		/bestbuy\.com/i,
		/aliexpress\.com/i,
		/alibaba\.com/i,
		/shopify\.com/i,
		/wish\.com/i,
		/shein\.com/i,
		/asos\.com/i,
		/zara\.com/i,
		/hm\.com/i,
		/uniqlo\.com/i,
		/nike\.com/i,
		/adidas\.com/i,
		/prom\.ua/i,
		/rozetka\.com\.ua/i,
		/olx\.ua/i,
		/allo\.ua/i,
		/comfy\.ua/i,
		/epicentrk\.ua/i,
		/makeup\.com\.ua/i,
		/citrus\.ua/i,
		/moyo\.ua/i,
		/foxtrot\.com\.ua/i,
		/hotline\.ua/i,
		/price\.ua/i,
		/zakupki\.prom\.ua/i,
	],
	news: [
		/news\./i,
		/blog\./i,
		/article\./i,
		/news-post\./i,
		/cnn\.com/i,
		/bbc\./i,
		/bbc\.co\.uk/i,
		/nytimes\.com/i,
		/theguardian\.com/i,
		/reuters\.com/i,
		/bloomberg\.com/i,
		/techcrunch\.com/i,
		/theverge\.com/i,
		/wired\.com/i,
		/arstechnica\.com/i,
		/engadget\.com/i,
		/mashable\.com/i,
		/gizmodo\.com/i,
		/lifehacker\.com/i,
		/vice\.com/i,
		/vox\.com/i,
		/buzzfeed\.com/i,
		/huffpost\.com/i,
		/washingtonpost\.com/i,
		/wsj\.com/i,
		/forbes\.com/i,
		/businessinsider\.com/i,
		/insider\.com/i,
		/cnbc\.com/i,
		/foxnews\.com/i,
		/nbcnews\.com/i,
		/abcnews\.go\.com/i,
		/apnews\.com/i,
		/axios\.com/i,
		/politico\.com/i,
		/thehill\.com/i,
		// Ukrainian news
		/pravda\.com\.ua/i,
		/ukrainska-pravda/i,
		/ukr\.net/i,
		/unian\.ua/i,
		/unian\.net/i,
		/obozrevatel\.com/i,
		/tsn\.ua/i,
		/korrespondent\.net/i,
		/liga\.net/i,
		/nv\.ua/i,
		/espreso\.tv/i,
		/hromadske\.ua/i,
		/zn\.ua/i,
		/detector\.media/i,
		/babel\.ua/i,
		/focus\.ua/i,
		/gazeta\.ua/i,
		/censor\.net/i,
		/24tv\.ua/i,
		/segodnya\.ua/i,
		/ukrinform\.ua/i,
		/interfax\.com\.ua/i,
		/rbc\.ua/i,
		/epravda\.com\.ua/i,
	],
	search: [
		/google\.com(?!\/(?:docs|sheets|drive|calendar|mail|meet))/i,
		/bing\.com/i,
		/duckduckgo\.com/i,
		/yahoo\.com\/search/i,
		/ecosia\.org/i,
		/brave\.com\/search/i,
		/yandex\./i,
		/baidu\.com/i,
	],
	finance: [
		/paypal\.com/i,
		/stripe\.com/i,
		/revolut\.com/i,
		/wise\.com/i,
		/privatbank\.ua/i,
		/monobank\.ua/i,
		/oschadbank\.ua/i,
		/binance\.com/i,
		/coinbase\.com/i,
		/kraken\.com/i,
		/blockchain\.com/i,
		/tradingview\.com/i,
		/investing\.com/i,
		/finance\.yahoo/i,
		/marketwatch\.com/i,
		/robinhood\.com/i,
		/etoro\.com/i,
	],
	education: [
		/wikipedia\.org/i,
		/wikimedia\.org/i,
		/khanacademy\.org/i,
		/duolingo\.com/i,
		/quizlet\.com/i,
		/brainly\.com/i,
		/chegg\.com/i,
		/studocu\.com/i,
		/academia\.edu/i,
		/researchgate\.net/i,
		/scholar\.google/i,
		/arxiv\.org/i,
		/jstor\.org/i,
		/britannica\.com/i,
		/ted\.com/i,
		/edx\.org/i,
		/leetcode\.com/i,
		/hackerrank\.com/i,
		/codewars\.com/i,
		/exercism\.org/i,
	],
	ai: [
		/chat\.openai\.com/i,
		/openai\.com/i,
		/claude\.ai/i,
		/anthropic\.com/i,
		/bard\.google/i,
		/gemini\.google/i,
		/perplexity\.ai/i,
		/midjourney\.com/i,
		/stability\.ai/i,
		/huggingface\.co/i,
		/replicate\.com/i,
		/poe\.com/i,
		/character\.ai/i,
		/copilot\.microsoft/i,
		/github\.com\/copilot/i,
	],
};

/**
 * URL path patterns for news/blog/article detection
 * These patterns match against the full URL path
 */
const NEWS_PATH_PATTERNS = [
	// Blog patterns
	/\/blog\//i,
	/\/blogs\//i,
	/\/weblog\//i,

	// News patterns
	/\/news\//i,
	/\/news-/i,
	/\/breaking\//i,
	/\/latest\//i,
	/\/headlines\//i,
	/\/press\//i,
	/\/press-release/i,
	/\/media\//i,
	/\/newsroom\//i,

	// Article patterns
	/\/article\//i,
	/\/articles\//i,
	/\/story\//i,
	/\/stories\//i,
	/\/post\//i,
	/\/posts\//i,
	/\/read\//i,

	// Release/Update patterns
	/\/releases\//i,
	/\/release\//i,
	/\/changelog\//i,
	/\/updates\//i,
	/\/update\//i,
	/\/whats-new/i,
	/\/announcements?\//i,

	// Editorial patterns
	/\/editorial\//i,
	/\/opinion\//i,
	/\/perspectives?\//i,
	/\/insights?\//i,
	/\/analysis\//i,
	/\/reports?\//i,
	/\/review\//i,
	/\/reviews\//i,

	// Publication patterns
	/\/publication\//i,
	/\/publications\//i,
	/\/journal\//i,
	/\/magazine\//i,
	/\/digest\//i,

	// Date-based article URLs (common pattern: /2024/01/article-name)
	/\/\d{4}\/\d{1,2}\/[a-z0-9-]+/i,

	// Content type indicators
	/\/content\//i,
	/\/featured\//i,
	/\/trending\//i,
	/\/popular\//i,
	/\/spotlight\//i,

	// Tech/Dev specific
	/\/devblog\//i,
	/\/engineering\//i,
	/\/tech-blog\//i,
	/\/developer-blog\//i,

	// Company blog patterns
	/\/company-news\//i,
	/\/corporate\//i,
	/\/about\/news/i,

	// Newsletter patterns
	/\/newsletter\//i,
	/\/subscribe\//i,
];

/**
 * Check if URL path matches news/blog patterns
 * @param {string} url - Full URL to check
 * @returns {boolean}
 */
function isNewsPath(url) {
	try {
		const urlObj = new URL(url);
		const fullPath = urlObj.pathname + urlObj.search;

		for (const pattern of NEWS_PATH_PATTERNS) {
			if (pattern.test(fullPath)) {
				return true;
			}
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Categorize a domain (enhanced with path detection)
 * @param {string} domain - Domain to categorize
 * @param {string} url - Full URL for path-based detection
 * @returns {string} Category name
 */
function categorize(domain, url = '') {
	// First check domain-based rules
	for (const [category, patterns] of Object.entries(CATEGORY_RULES)) {
		for (const pattern of patterns) {
			if (pattern.test(domain)) {
				return category;
			}
		}
	}

	// Check URL path for news/blog patterns (for sites not in domain list)
	if (url && isNewsPath(url)) {
		return 'news';
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
		// Initialize ALL categories from CATEGORY_RULES + 'other'
		const categoryStats = {};
		for (const category of Object.keys(CATEGORY_RULES)) {
			categoryStats[category] = 0;
		}
		categoryStats.other = 0;

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

			// Category stats - NOW WITH URL PATH DETECTION
			const category = categorize(domain, item.url);
			categoryStats[category] = (categoryStats[category] || 0) + visitCount;

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
