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

// DOM Elements - will be initialized after DOM loads
let elements = {};

// Utility functions
function formatNumber(num) {
	if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
	if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
	return num.toString();
}

function getHourLabel(hour) {
	return `${hour.toString().padStart(2, '0')}:00`;
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
		search: '#8b5cf6',
		finance: '#14b8a6',
		education: '#f97316',
		ai: '#06b6d4',
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
		search: '🔍',
		finance: '💰',
		education: '📚',
		ai: '🤖',
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
	// Initialize DOM elements
	elements = {
		totalPages: document.getElementById('total-pages'),
		uniqueDomains: document.getElementById('unique-domains'),
		peakHour: document.getElementById('peak-hour'),
		peakDay: document.getElementById('peak-day'),
		customSelect: document.getElementById('date-range-select'),
		selectTrigger: document.getElementById('select-trigger'),
		selectValue: document.getElementById('select-value'),
		selectOptions: document.getElementById('select-options'),
		dateRangePicker: document.getElementById('date-range-picker'),
		dateStart: document.getElementById('date-start'),
		dateEnd: document.getElementById('date-end'),
		btnApplyRange: document.getElementById('btn-apply-range'),
		btnExport: document.getElementById('btn-export'),
		btnRefresh: document.getElementById('btn-refresh'),
		loadingOverlay: document.getElementById('loading-overlay'),
		pagesTbody: document.getElementById('pages-tbody'),
		pagination: document.getElementById('pagination'),
		pageSearch: document.getElementById('page-search'),
		categoryLegend: document.getElementById('category-legend'),
	};

	setupCustomSelect();
	setupEventListeners();
	await loadAnalytics();
}

function setupCustomSelect() {
	if (!elements.selectTrigger) return;

	elements.selectTrigger.addEventListener('click', (e) => {
		e.stopPropagation();
		elements.customSelect?.classList.toggle('open');
	});

	elements.selectOptions?.addEventListener('click', (e) => {
		const option = e.target.closest('.custom-select-option');
		if (!option) return;

		const value = option.dataset.value;
		const text = option.textContent.trim();

		elements.selectOptions.querySelectorAll('.custom-select-option').forEach((opt) => {
			opt.classList.remove('selected');
		});
		option.classList.add('selected');

		elements.customSelect?.classList.remove('open');

		if (value === 'custom') {
			elements.dateRangePicker?.classList.add('visible');
			if (elements.selectValue) elements.selectValue.textContent = 'Custom Range';
		} else {
			elements.dateRangePicker?.classList.remove('visible');
			if (elements.selectValue) elements.selectValue.textContent = text;
			customStartDate = null;
			customEndDate = null;
			selectedDays = parseInt(value);
			loadAnalytics();
		}
	});

	document.addEventListener('click', (e) => {
		if (!e.target.closest('.custom-select')) {
			elements.customSelect?.classList.remove('open');
		}
	});

	const today = new Date();
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	if (elements.dateEnd) elements.dateEnd.valueAsDate = today;
	if (elements.dateStart) elements.dateStart.valueAsDate = thirtyDaysAgo;
}

function setupEventListeners() {
	elements.btnApplyRange?.addEventListener('click', handleApplyCustomRange);
	elements.btnExport?.addEventListener('click', handleExport);
	elements.btnRefresh?.addEventListener('click', () => {
		chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, () => {
			loadAnalytics();
		});
	});

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

	const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	if (elements.selectValue) elements.selectValue.textContent = `${startStr} - ${endStr}`;

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

	const totalVisits = analyticsData.totalVisits || analyticsData.topDomains?.reduce((sum, d) => sum + d.visits, 0) || 0;

	animateValue(elements.totalPages, totalVisits);
	animateValue(elements.uniqueDomains, analyticsData.topDomains?.length || 0);

	if (analyticsData.hourlyActivity) {
		const maxActivity = Math.max(...analyticsData.hourlyActivity);
		if (maxActivity > 0) {
			const peakHourIndex = analyticsData.hourlyActivity.indexOf(maxActivity);
			if (elements.peakHour) elements.peakHour.textContent = getHourLabel(peakHourIndex);
		} else {
			if (elements.peakHour) elements.peakHour.textContent = '--';
		}
	}

	if (analyticsData.dailyActivity) {
		const maxActivity = Math.max(...analyticsData.dailyActivity);
		if (maxActivity > 0) {
			const peakDayIndex = analyticsData.dailyActivity.indexOf(maxActivity);
			if (elements.peakDay) elements.peakDay.textContent = getDayName(peakDayIndex);
		} else {
			if (elements.peakDay) elements.peakDay.textContent = '--';
		}
	}
}

function animateValue(element, targetValue) {
	if (!element) return;
	const formattedValue = formatNumber(targetValue);
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
		console.error('Chart.js not loaded - please ensure chart.umd.min.js is in src/lib/');
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

	const currentHour = new Date().getHours();
	const isToday = selectedDays === 1 && !customStartDate;

	let hourlyData = [...analyticsData.hourlyActivity];
	let labels = Array.from({ length: 24 }, (_, i) => getHourLabel(i));

	if (isToday) {
		hourlyData = hourlyData.slice(0, currentHour + 1);
		labels = labels.slice(0, currentHour + 1);
	}

	const maxVal = Math.max(...hourlyData, 1);

	charts.hourly = new Chart(ctx, {
		type: 'line',
		data: {
			labels: labels,
			datasets: [
				{
					label: 'Activity',
					data: hourlyData,
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
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (context) => `${context.parsed.y} visits`,
					},
				},
			},
			scales: {
				x: { grid: { display: false }, ticks: { maxRotation: 45 } },
				y: {
					grid: { color: 'rgba(0,0,0,0.05)' },
					beginAtZero: true,
					ticks: {
						stepSize: maxVal > 100 ? Math.ceil(maxVal / 10) : maxVal > 10 ? Math.ceil(maxVal / 5) : 1,
					},
				},
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
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (context) => `${context.parsed.y} visits`,
					},
				},
			},
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

	if (categories.length === 0) return;

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

	if (searchQuery && searchQuery.trim()) {
		const query = searchQuery.toLowerCase().trim();
		pages = pages.filter((p) => (p.title || '').toLowerCase().includes(query) || (p.url || '').toLowerCase().includes(query));
	}

	const totalPages = Math.ceil(pages.length / PAGE_SIZE);

	if (currentPage > totalPages && totalPages > 0) {
		currentPage = 1;
	}

	const start = (currentPage - 1) * PAGE_SIZE;
	const paginatedPages = pages.slice(start, start + PAGE_SIZE);

	if (paginatedPages.length === 0) {
		elements.pagesTbody.innerHTML = `<tr><td colspan="4" class="loading">No pages match "${escapeHtml(searchQuery)}"</td></tr>`;
		if (elements.pagination) elements.pagination.innerHTML = '';
		return;
	}

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

	renderPagination(totalPages, pages.length, searchQuery);
}

function renderPagination(totalPages, totalItems, searchQuery = '') {
	if (!elements.pagination) return;

	if (totalPages <= 1) {
		elements.pagination.innerHTML = totalItems > 0 ? `<span class="pagination-info">${totalItems} item${totalItems !== 1 ? 's' : ''}</span>` : '';
		return;
	}

	// Create pagination container
	const container = document.createElement('div');
	container.className = 'pagination-buttons';

	// Previous button
	const prevBtn = document.createElement('button');
	prevBtn.className = 'page-btn';
	prevBtn.textContent = '← Prev';
	prevBtn.disabled = currentPage === 1;
	prevBtn.addEventListener('click', () => goToPage(currentPage - 1, searchQuery));
	container.appendChild(prevBtn);

	// Page numbers
	const maxVisible = 5;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	let endPage = Math.min(totalPages, startPage + maxVisible - 1);

	if (endPage - startPage < maxVisible - 1) {
		startPage = Math.max(1, endPage - maxVisible + 1);
	}

	if (startPage > 1) {
		const firstBtn = document.createElement('button');
		firstBtn.className = 'page-btn';
		firstBtn.textContent = '1';
		firstBtn.addEventListener('click', () => goToPage(1, searchQuery));
		container.appendChild(firstBtn);

		if (startPage > 2) {
			const ellipsis = document.createElement('span');
			ellipsis.className = 'page-ellipsis';
			ellipsis.textContent = '...';
			container.appendChild(ellipsis);
		}
	}

	for (let i = startPage; i <= endPage; i++) {
		const pageBtn = document.createElement('button');
		pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
		pageBtn.textContent = i.toString();
		pageBtn.addEventListener('click', () => goToPage(i, searchQuery));
		container.appendChild(pageBtn);
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			const ellipsis = document.createElement('span');
			ellipsis.className = 'page-ellipsis';
			ellipsis.textContent = '...';
			container.appendChild(ellipsis);
		}

		const lastBtn = document.createElement('button');
		lastBtn.className = 'page-btn';
		lastBtn.textContent = totalPages.toString();
		lastBtn.addEventListener('click', () => goToPage(totalPages, searchQuery));
		container.appendChild(lastBtn);
	}

	// Next button
	const nextBtn = document.createElement('button');
	nextBtn.className = 'page-btn';
	nextBtn.textContent = 'Next →';
	nextBtn.disabled = currentPage === totalPages;
	nextBtn.addEventListener('click', () => goToPage(currentPage + 1, searchQuery));
	container.appendChild(nextBtn);

	// Info
	const info = document.createElement('span');
	info.className = 'pagination-info';
	info.textContent = `${totalItems} items`;
	container.appendChild(info);

	elements.pagination.innerHTML = '';
	elements.pagination.appendChild(container);
}

function goToPage(page, searchQuery = '') {
	currentPage = page;
	renderPagesTable(searchQuery || elements.pageSearch?.value || '');
	document.getElementById('pages-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function handleExport() {
	if (!analyticsData) {
		alert('No data to export');
		return;
	}

	const exportData = {
		...analyticsData,
		exportedAt: new Date().toISOString(),
		customRange: customStartDate && customEndDate ? { start: new Date(customStartDate).toISOString(), end: new Date(customEndDate).toISOString() } : null,
	};

	downloadAsJson(exportData, `browsing-analytics-${new Date().toISOString().split('T')[0]}.json`);
}

// Add transition style for stat values
const style = document.createElement('style');
style.textContent = `.stat-value { transition: opacity 0.15s, transform 0.15s; }`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
