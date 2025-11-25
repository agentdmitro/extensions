/**
 * Your Browsing Analytics - Popup Script
 * Displays quick stats and navigation to full dashboard
 */

import { getTodayStats } from './history.js';
import { formatNumber, generateSparklinePath } from './utils.js';

// DOM Elements
const elements = {
	todayVisits: document.getElementById('today-visits'),
	topSites: document.getElementById('top-sites'),
	sparkline: document.querySelector('.sparkline-path'),
	btnDashboard: document.getElementById('btn-dashboard'),
	btnRefresh: document.getElementById('btn-refresh'),
};

/**
 * Initialize popup
 */
async function init() {
	setupEventListeners();
	await loadStats();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
	// Open dashboard
	elements.btnDashboard.addEventListener('click', () => {
		chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard.html') });
		window.close();
	});

	// Refresh data
	elements.btnRefresh.addEventListener('click', async () => {
		elements.btnRefresh.disabled = true;
		elements.btnRefresh.textContent = '⏳ Loading...';
		await loadStats();
		elements.btnRefresh.disabled = false;
		elements.btnRefresh.innerHTML = '<span class="icon">🔄</span> Refresh';
	});
}

/**
 * Load and display stats
 */
async function loadStats() {
	try {
		const stats = await getTodayStats();

		if (!stats) {
			showError();
			return;
		}

		// Update visit count
		elements.todayVisits.textContent = formatNumber(stats.todayVisits || 0);

		// Update sparkline
		if (stats.hourlyActivity && stats.hourlyActivity.length > 0) {
			const path = generateSparklinePath(stats.hourlyActivity, 100, 30);
			elements.sparkline.setAttribute('d', path);
		}

		// Update top sites
		renderTopSites(stats.topDomains || []);
	} catch (error) {
		console.error('Failed to load stats:', error);
		showError();
	}
}

/**
 * Render top sites list
 * @param {Array} sites - Top sites array
 */
function renderTopSites(sites) {
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

/**
 * Get favicon emoji based on domain
 * @param {string} domain - Domain name
 * @returns {string} Emoji
 */
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

/**
 * Show error state
 */
function showError() {
	elements.todayVisits.textContent = '--';
	elements.topSites.innerHTML = `
    <li class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">Unable to load data</div>
    </li>
  `;
}

/**
 * Escape HTML entities
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

// Initialize
init();
