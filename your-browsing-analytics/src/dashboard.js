/**
 * Your Browsing Analytics - Dashboard Script
 * Full analytics dashboard with Chart.js visualizations
 */

// State
let analyticsData = null;
let charts = {};
let currentPage = 1;
const PAGE_SIZE = 10;
let customStartDate = null;
let customEndDate = null;
let selectedDays = 30;

// DOM Elements
const elements = {
	totalPages: document.getElementById('total-pages'),
	uniqueDomains: document.getElementById('unique-domains'),
	peakHour: document.getElementById('peak-hour'),
	peakDay: document.getElementById('peak-day'),
	// Custom select elements
	customSelect: document.getElementById('date-range-select'),
	selectTrigger: document.getElementById('select-trigger'),
	selectValue: document.getElementById('select-value'),
	selectOptions: document.getElementById('select-options'),
	// Date picker
	dateRangePicker: document.getElementById('date-range-picker'),
	dateStart: document.getElementById('date-start'),
	dateEnd: document.getElementById('date-end'),
	btnApplyRange: document.getElementById('btn-apply-range'),
	// Other
	btnExport: document.getElementById('btn-export'),
	btnRefresh: document.getElementById('btn-refresh'),
	loadingOverlay: document.getElementById('loading-overlay'),
	pagesTbody: document.getElementById('pages-tbody'),
	pagination: document.getElementById('pagination'),
	pageSearch: document.getElementById('page-search'),
	categoryLegend: document.getElementById('category-legend'),
};

// Utility functions
function formatNumber(num) {
	if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
	if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
	return num.toString();
}

function getHourLabel(hour) {
	if (hour === 0) return '12am';
	if (hour === 12) return '12pm';
	if (hour < 12) return `${hour}am`;
	return `${hour - 12}pm`;
}

function getDayName(index) {
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	return days[index] || '';
}

function getCategoryColor(category) {
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

function getCategoryIcon(category) {
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

function calcPercentage(value, total) {
	if (total === 0) return '0%';
	return ((value / total) * 100).toFixed(1) + '%';
}

function truncateUrl(url, maxLength = 50) {
	if (!url) return '';
	if (url.length <= maxLength) return url;
	try {
		const urlObj = new URL(url);
		const path = urlObj.pathname + urlObj.search;
		return urlObj.hostname + (path.length > 30 ? path.substring(0, 30) + '...' : path);
	} catch {
		return url.substring(0, maxLength) + '...';
	}
}

function escapeHtml(text) {
	if (!text) return '';
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

function debounce(fn, delay) {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
}

// API functions
async function getAnalytics(days = 30, startTimestamp = null, endTimestamp = null) {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{
				type: 'GET_ANALYTICS',
				days,
				startTimestamp,
				endTimestamp,
			},
			(response) => {
				if (chrome.runtime.lastError) {
					reject(chrome.runtime.lastError);
					return;
				}
				resolve(response);
			}
		);
	});
}

function downloadAsJson(data, filename = 'browsing-analytics.json') {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// Initialize dashboard
async function init() {
	setupCustomSelect();
	setupEventListeners();
	await loadAnalytics();
}

/**
 * Setup custom select functionality
 */
function setupCustomSelect() {
	// Toggle dropdown
	elements.selectTrigger?.addEventListener('click', (e) => {
		e.stopPropagation();
		elements.customSelect?.classList.toggle('open');
	});

	// Handle option selection
	elements.selectOptions?.addEventListener('click', (e) => {
		const option = e.target.closest('.custom-select-option');
		if (!option) return;

		const value = option.dataset.value;
		const text = option.textContent.trim();

		// Update selected state
		elements.selectOptions.querySelectorAll('.custom-select-option').forEach((opt) => {
			opt.classList.remove('selected');
		});
		option.classList.add('selected');

		// Close dropdown
		elements.customSelect?.classList.remove('open');

		if (value === 'custom') {
			// Show date picker
			elements.dateRangePicker?.classList.add('visible');
			elements.selectValue.textContent = 'Custom Range';
		} else {
			// Hide date picker and load data
			elements.dateRangePicker?.classList.remove('visible');
			elements.selectValue.textContent = text;
			customStartDate = null;
			customEndDate = null;
			selectedDays = parseInt(value);
			loadAnalytics();
		}
	});

	// Close dropdown when clicking outside
	document.addEventListener('click', (e) => {
		if (!e.target.closest('.custom-select')) {
			elements.customSelect?.classList.remove('open');
		}
	});

	// Set default dates for custom picker
	const today = new Date();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	if (elements.dateEnd) {
		elements.dateEnd.valueAsDate = today;
	}
	if (elements.dateStart) {
		elements.dateStart.valueAsDate = thirtyDaysAgo;
	}
}

function setupEventListeners() {
	elements.btnApplyRange?.addEventListener('click', handleApplyCustomRange);
	elements.btnExport?.addEventListener('click', handleExport);
	elements.btnRefresh?.addEventListener('click', () => {
		// Clear cache and reload
		chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, () => {
			loadAnalytics();
		});
	});

	// Fix search - use direct handler with debounce
	if (elements.pageSearch) {
		let searchTimeout;
		elements.pageSearch.addEventListener('input', (e) => {
			clearTimeout(searchTimeout);
			searchTimeout = setTimeout(() => {
				currentPage = 1;
				renderPagesTable(e.target.value);
			}, 300);
		});
	}
}

/**
 * Handle apply custom date range
 */
function handleApplyCustomRange() {
	const startDate = elements.dateStart?.value;
	const endDate = elements.dateEnd?.value;

	if (!startDate || !endDate) {
		alert('Please select both start and end dates');
		return;
	}

	const start = new Date(startDate);
	const end = new Date(endDate);
	end.setHours(23, 59, 59, 999);

	if (start > end) {
		alert('Start date must be before end date');
		return;
	}

	customStartDate = start.getTime();
	customEndDate = end.getTime();

	// Update select display
	const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	elements.selectValue.textContent = `${startStr} - ${endStr}`;

	loadAnalytics();
}

function showLoading() {
	elements.loadingOverlay?.classList.add('visible');
}

function hideLoading() {
	elements.loadingOverlay?.classList.remove('visible');
}

async function loadAnalytics() {
	showLoading();

	try {
		let data;

		if (customStartDate && customEndDate) {
			const days = Math.ceil((customEndDate - customStartDate) / (24 * 60 * 60 * 1000));
			data = await getAnalytics(days, customStartDate, customEndDate);
		} else {
			data = await getAnalytics(selectedDays);
		}

		analyticsData = data;

		if (!analyticsData) {
			throw new Error('No data received');
		}

		// Update all UI elements
		updateStats();
		renderCharts();
		renderPagesTable();
		renderCategoryLegend();
	} catch (error) {
		console.error('Failed to load analytics:', error);
		showError();
	} finally {
		hideLoading();
	}
}

function showError() {
	if (elements.totalPages) elements.totalPages.textContent = '--';
	if (elements.uniqueDomains) elements.uniqueDomains.textContent = '--';
	if (elements.peakHour) elements.peakHour.textContent = '--';
	if (elements.peakDay) elements.peakDay.textContent = '--';
}

function updateStats() {
	if (!analyticsData) return;

	// Calculate total visits
	const totalVisits = analyticsData.totalVisits || analyticsData.topDomains?.reduce((sum, d) => sum + d.visits, 0) || 0;

	// Update DOM elements with animation
	animateValue(elements.totalPages, totalVisits);
	animateValue(elements.uniqueDomains, analyticsData.topDomains?.length || 0);

	// Peak hour
	if (analyticsData.hourlyActivity) {
		const maxActivity = Math.max(...analyticsData.hourlyActivity);
		if (maxActivity > 0) {
			const peakHourIndex = analyticsData.hourlyActivity.indexOf(maxActivity);
			if (elements.peakHour) {
				elements.peakHour.textContent = getHourLabel(peakHourIndex);
			}
		} else {
			if (elements.peakHour) elements.peakHour.textContent = '--';
		}
	}

	// Peak day
	if (analyticsData.dailyActivity) {
		const maxActivity = Math.max(...analyticsData.dailyActivity);
		if (maxActivity > 0) {
			const peakDayIndex = analyticsData.dailyActivity.indexOf(maxActivity);
			if (elements.peakDay) {
				elements.peakDay.textContent = getDayName(peakDayIndex);
			}
		} else {
			if (elements.peakDay) elements.peakDay.textContent = '--';
		}
	}
}

/**
 * Animate number value
 */
function animateValue(element, targetValue) {
	if (!element) return;

	const formattedValue = formatNumber(targetValue);

	// Simple fade animation
	element.style.opacity = '0';
	element.style.transform = 'translateY(-5px)';

	setTimeout(() => {
		element.textContent = formattedValue;
		element.style.opacity = '1';
		element.style.transform = 'translateY(0)';
	}, 150);
}

function renderCharts() {
	if (typeof Chart === 'undefined') {
		console.error('Chart.js not loaded');
		return;
	}

	renderDomainsChart();
	renderHourlyChart();
	renderDailyChart();
	renderCategoriesChart();
}

function renderDomainsChart() {
	const ctx = document.getElementById('chart-domains');
	if (!ctx || !analyticsData?.topDomains) return;

	if (charts.domains) charts.domains.destroy();

	const data = analyticsData.topDomains.slice(0, 10);

	charts.domains = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.map((d) => d.domain),
			datasets: [
				{
					label: 'Visits',
					data: data.map((d) => d.visits),
					backgroundColor: '#6366f1',
					borderRadius: 6,
				},
			],
		},
		options: {
			indexAxis: 'y',
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { color: 'rgba(0,0,0,0.05)' } },
				y: { grid: { display: false } },
			},
		},
	});
}

function renderHourlyChart() {
	const ctx = document.getElementById('chart-hourly');
	if (!ctx || !analyticsData?.hourlyActivity) return;

	if (charts.hourly) charts.hourly.destroy();

	charts.hourly = new Chart(ctx, {
		type: 'line',
		data: {
			labels: Array.from({ length: 24 }, (_, i) => getHourLabel(i)),
			datasets: [
				{
					label: 'Activity',
					data: analyticsData.hourlyActivity,
					fill: true,
					backgroundColor: 'rgba(99, 102, 241, 0.1)',
					borderColor: '#6366f1',
					borderWidth: 2,
					tension: 0.4,
					pointRadius: 3,
					pointBackgroundColor: '#6366f1',
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { display: false }, ticks: { maxRotation: 45 } },
				y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true },
			},
		},
	});
}

function renderDailyChart() {
	const ctx = document.getElementById('chart-daily');
	if (!ctx || !analyticsData?.dailyActivity) return;

	if (charts.daily) charts.daily.destroy();

	const reorderedData = [...analyticsData.dailyActivity.slice(1), analyticsData.dailyActivity[0]];
	const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

	charts.daily = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: labels,
			datasets: [
				{
					label: 'Activity',
					data: reorderedData,
					backgroundColor: labels.map((_, i) => (i < 5 ? '#6366f1' : '#a855f7')),
					borderRadius: 8,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: {
				x: { grid: { display: false } },
				y: { grid: { color: 'rgba(0,0,0,0.05)' }, beginAtZero: true },
			},
		},
	});
}

function renderCategoriesChart() {
	const ctx = document.getElementById('chart-categories');
	if (!ctx || !analyticsData?.categoryStats) return;

	if (charts.categories) charts.categories.destroy();

	const categories = Object.entries(analyticsData.categoryStats)
		.filter(([_, value]) => value > 0)
		.sort((a, b) => b[1] - a[1]);

	charts.categories = new Chart(ctx, {
		type: 'doughnut',
		data: {
			labels: categories.map(([name]) => name.charAt(0).toUpperCase() + name.slice(1)),
			datasets: [
				{
					data: categories.map(([_, value]) => value),
					backgroundColor: categories.map(([name]) => getCategoryColor(name)),
					borderWidth: 0,
					hoverOffset: 10,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			cutout: '60%',
			plugins: { legend: { display: false } },
		},
	});
}

function renderCategoryLegend() {
	if (!elements.categoryLegend || !analyticsData?.categoryStats) return;

	const categories = Object.entries(analyticsData.categoryStats)
		.filter(([_, value]) => value > 0)
		.sort((a, b) => b[1] - a[1]);

	const total = categories.reduce((sum, [_, val]) => sum + val, 0);

	elements.categoryLegend.innerHTML = categories
		.map(
			([name, value]) => `
		<div class="legend-item">
			<span class="legend-color" style="background: ${getCategoryColor(name)}"></span>
			<span>${getCategoryIcon(name)} ${name.charAt(0).toUpperCase() + name.slice(1)}</span>
			<span style="margin-left: 4px; opacity: 0.6">${calcPercentage(value, total)}</span>
		</div>
	`
		)
		.join('');
}

function renderPagesTable(searchQuery = '') {
	if (!elements.pagesTbody) return;

	if (!analyticsData?.topPages || analyticsData.topPages.length === 0) {
		elements.pagesTbody.innerHTML = '<tr><td colspan="4" class="loading">No data available</td></tr>';
		if (elements.pagination) elements.pagination.innerHTML = '';
		return;
	}

	let pages = [...analyticsData.topPages];

	// Apply search filter
	if (searchQuery && searchQuery.trim()) {
		const query = searchQuery.toLowerCase().trim();
		pages = pages.filter((p) => (p.title || '').toLowerCase().includes(query) || (p.url || '').toLowerCase().includes(query));
	}

	// Calculate pagination
	const totalPages = Math.ceil(pages.length / PAGE_SIZE);

	// Reset to page 1 if current page is out of bounds
	if (currentPage > totalPages) {
		currentPage = 1;
	}

	const start = (currentPage - 1) * PAGE_SIZE;
	const paginatedPages = pages.slice(start, start + PAGE_SIZE);

	// Show message if no results
	if (paginatedPages.length === 0) {
		elements.pagesTbody.innerHTML = `<tr><td colspan="4" class="loading">No pages match "${escapeHtml(searchQuery)}"</td></tr>`;
		if (elements.pagination) elements.pagination.innerHTML = '';
		return;
	}

	// Render table rows
	elements.pagesTbody.innerHTML = paginatedPages
		.map(
			(page, index) => `
		<tr>
			<td>${start + index + 1}</td>
			<td><span class="page-title" title="${escapeHtml(page.title || 'Untitled')}">${escapeHtml(page.title || 'Untitled')}</span></td>
			<td><a href="${escapeHtml(page.url)}" target="_blank" class="page-url" title="${escapeHtml(page.url)}">${escapeHtml(truncateUrl(page.url, 50))}</a></td>
			<td>${formatNumber(page.visits)}</td>
		</tr>
	`
		)
		.join('');

	// Render pagination
	renderPagination(totalPages, pages.length);
}

function renderPagination(totalPages, totalItems) {
	if (!elements.pagination) return;

	if (totalPages <= 1) {
		elements.pagination.innerHTML = totalItems > 0 ? `<span class="pagination-info">${totalItems} item${totalItems !== 1 ? 's' : ''}</span>` : '';
		return;
	}

	let html = '';

	// Previous button
	html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">← Prev</button>`;

	// Page numbers with ellipsis for many pages
	const maxVisible = 5;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	let endPage = Math.min(totalPages, startPage + maxVisible - 1);

	if (endPage - startPage < maxVisible - 1) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	if (startPage > 1) {
		html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
		if (startPage > 2) {
			html += `<span class="page-ellipsis">...</span>`;
		}
	}

	for (let i = startPage; i <= endPage; i++) {
		html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			html += `<span class="page-ellipsis">...</span>`;
		}
		html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
	}

	// Next button
	html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Next →</button>`;

	// Info
	html += `<span class="pagination-info">${totalItems} items</span>`;

	elements.pagination.innerHTML = html;
}

function goToPage(page) {
	const searchQuery = elements.pageSearch?.value || '';
	currentPage = page;
	renderPagesTable(searchQuery);

	// Scroll table into view
	document.getElementById('pages-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handlePageSearch(e) {
	currentPage = 1;
	renderPagesTable(e.target.value);
}

function handleExport() {
	if (!analyticsData) {
		alert('No data to export');
		return;
	}

	const exportData = {
		...analyticsData,
		exportedAt: new Date().toISOString(),
		customRange:
			customStartDate && customEndDate
				? {
						start: new Date(customStartDate).toISOString(),
						end: new Date(customEndDate).toISOString(),
				  }
				: null,
	};

	downloadAsJson(exportData, `browsing-analytics-${new Date().toISOString().split('T')[0]}.json`);
}

// Make goToPage global for onclick handlers
window.goToPage = goToPage;

// Add transition style for stat values
const style = document.createElement('style');
style.textContent = `
	.stat-value {
		transition: opacity 0.15s, transform 0.15s;
	}
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
