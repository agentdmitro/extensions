/**
 * Your Browsing Analytics - Popup Script
 * Displays quick stats and navigation to full dashboard
 */

// Utility functions
function formatNumber(num) {
	if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
	if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
	return num.toString();
}

function generateSparklinePath(data, width, height) {
	if (!data || data.length === 0) return '';
	const max = Math.max(...data, 1);
	const points = data.map((val, i) => {
		const x = (i / (data.length - 1)) * width;
		const y = height - (val / max) * height;
		return `${x},${y}`;
	});
	return 'M' + points.join(' L');
}

async function getTodayStats() {
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

// DOM Elements
const elements = {
	todayVisits: document.getElementById('today-visits'),
	topSites: document.getElementById('top-sites'),
	sparkline: document.querySelector('.sparkline-path'),
	btnDashboard: document.getElementById('btn-dashboard'),
	btnRefresh: document.getElementById('btn-refresh'),
};

async function init() {
	setupEventListeners();
	await loadStats();
}

function setupEventListeners() {
	elements.btnDashboard?.addEventListener('click', () => {
		chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html') });
		window.close();
	});

	elements.btnRefresh?.addEventListener('click', async () => {
		if (elements.btnRefresh) {
			elements.btnRefresh.disabled = true;
			elements.btnRefresh.textContent = '⏳ Loading...';
		}
		await loadStats();
		if (elements.btnRefresh) {
			elements.btnRefresh.disabled = false;
			elements.btnRefresh.innerHTML = '<span class="icon">🔄</span> Refresh';
		}
	});
}

async function loadStats() {
	try {
		const stats = await getTodayStats();

		if (!stats) {
			showError();
			return;
		}

		// Use todayVisits which now comes from actual visit counting
		if (elements.todayVisits) {
			elements.todayVisits.textContent = formatNumber(stats.todayVisits || 0);
		}

		if (elements.sparkline && stats.hourlyActivity?.length > 0) {
			// Only show sparkline if there's actual activity
			const hasActivity = stats.hourlyActivity.some((v) => v > 0);
			if (hasActivity) {
				const path = generateSparklinePath(stats.hourlyActivity, 100, 30);
				elements.sparkline.setAttribute('d', path);
			}
		}

		renderTopSites(stats.topDomains || []);
	} catch (error) {
		console.error('Failed to load stats:', error);
		showError();
	}
}

function renderTopSites(sites) {
	if (!elements.topSites) return;

	if (!sites || sites.length === 0) {
		elements.topSites.innerHTML = `
			<li class="empty-state">
				<div class="empty-state-icon">🔍</div>
				<div class="empty-state-text">No browsing data yet</div>
			</li>
		`;
		return;
	}

	elements.topSites.innerHTML = sites
		.slice(0, 3)
		.map(
			(site) => `
		<li>
			<div class="site-info">
				<div class="site-favicon">${getFaviconEmoji(site.domain)}</div>
				<span class="site-domain">${escapeHtml(site.domain)}</span>
			</div>
			<span class="site-visits">${formatNumber(site.visits)}</span>
		</li>
	`
		)
		.join('');
}

function getFaviconEmoji(domain) {
	const emojiMap = {
		google: '🔍',
		youtube: '▶️',
		github: '🐙',
		twitter: '🐦',
		'x.com': '𝕏',
		facebook: '📘',
		instagram: '📷',
		linkedin: '💼',
		reddit: '🤖',
		stackoverflow: '📚',
		amazon: '📦',
		netflix: '🎬',
		spotify: '🎵',
		discord: '💬',
		slack: '💬',
		notion: '📝',
		figma: '🎨',
	};
	for (const [key, emoji] of Object.entries(emojiMap)) {
		if (domain.includes(key)) return emoji;
	}
	return '🌐';
}

function showError() {
	if (elements.todayVisits) elements.todayVisits.textContent = '--';
	if (elements.topSites) {
		elements.topSites.innerHTML = `
			<li class="empty-state">
				<div class="empty-state-icon">⚠️</div>
				<div class="empty-state-text">Unable to load data</div>
			</li>
		`;
	}
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', init);
