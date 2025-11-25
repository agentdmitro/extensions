/**
 * Your Browsing Analytics - Utility Functions
 * Shared helpers for data formatting and processing
 */

/**
 * Format large numbers with K, M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted string
 */
export function formatNumber(num) {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + 'M';
	}
	if (num >= 1000) {
		return (num / 1000).toFixed(1) + 'K';
	}
	return num.toString();
}

/**
 * Format relative time
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Relative time string
 */
export function formatRelativeTime(timestamp) {
	const now = Date.now();
	const diff = now - timestamp;

	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return new Date(timestamp).toLocaleDateString();
}

/**
 * Truncate URL for display
 * @param {string} url - Full URL
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated URL
 */
export function truncateUrl(url, maxLength = 50) {
	if (!url) return '';
	if (url.length <= maxLength) return url;

	try {
		const urlObj = new URL(url);
		const path = urlObj.pathname + urlObj.search;
		const truncatedPath = path.length > 30 ? path.substring(0, 30) + '...' : path;
		return urlObj.hostname + truncatedPath;
	} catch {
		return url.substring(0, maxLength) + '...';
	}
}

/**
 * Get day name from index
 * @param {number} index - Day index (0 = Sunday)
 * @returns {string} Day name
 */
export function getDayName(index) {
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return days[index] || '';
}

/**
 * Get hour label
 * @param {number} hour - Hour (0-23)
 * @returns {string} Formatted hour
 */
export function getHourLabel(hour) {
	if (hour === 0) return '12am';
	if (hour === 12) return '12pm';
	if (hour < 12) return `${hour}am`;
	return `${hour - 12}pm`;
}

/**
 * Generate gradient colors for charts
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} startColor - Start color
 * @param {string} endColor - End color
 * @returns {CanvasGradient} Gradient object
 */
export function createGradient(ctx, startColor, endColor) {
	const gradient = ctx.createLinearGradient(0, 0, 0, 300);
	gradient.addColorStop(0, startColor);
	gradient.addColorStop(1, endColor);
	return gradient;
}

/**
 * Get category color
 * @param {string} category - Category name
 * @returns {string} Hex color
 */
export function getCategoryColor(category) {
	const colors = {
		work: '#6366f1',
		social: '#ec4899',
		entertainment: '#f59e0b',
		shopping: '#10b981',
		news: '#3b82f6',
		other: '#6b7280',
	};
	return colors[category] || colors.other;
}

/**
 * Get category icon
 * @param {string} category - Category name
 * @returns {string} Emoji icon
 */
export function getCategoryIcon(category) {
	const icons = {
		work: '💼',
		social: '💬',
		entertainment: '🎬',
		shopping: '🛒',
		news: '📰',
		other: '🌐',
	};
	return icons[category] || icons.other;
}

/**
 * Calculate percentage
 * @param {number} value - Part value
 * @param {number} total - Total value
 * @returns {string} Percentage string
 */
export function calcPercentage(value, total) {
	if (total === 0) return '0%';
	return ((value / total) * 100).toFixed(1) + '%';
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
}

/**
 * Generate sparkline SVG path
 * @param {number[]} data - Data points
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} SVG path d attribute
 */
export function generateSparklinePath(data, width, height) {
	if (!data || data.length === 0) return '';

	const max = Math.max(...data, 1);
	const points = data.map((val, i) => {
		const x = (i / (data.length - 1)) * width;
		const y = height - (val / max) * height;
		return `${x},${y}`;
	});

	return 'M' + points.join(' L');
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
	return JSON.parse(JSON.stringify(obj));
}
