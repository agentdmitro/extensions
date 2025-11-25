/**
 * Link Inspector Pro - Popup Script
 * Handles popup UI and communication with content scripts
 */

(function () {
	'use strict';

	// DOM Elements
	const elements = {
		toggleEnabled: document.getElementById('toggle-enabled'),
		toggleUtm: document.getElementById('toggle-utm'),
		toggleAnchors: document.getElementById('toggle-anchors'),
		togglePopups: document.getElementById('toggle-popups'),
		loading: document.getElementById('loading'),
		error: document.getElementById('error'),
		results: document.getElementById('results'),
		noResults: document.getElementById('no-results'),
		// Stats
		statUtm: document.getElementById('stat-utm'),
		statAnchors: document.getElementById('stat-anchors'),
		statPopups: document.getElementById('stat-popups'),
		statExternal: document.getElementById('stat-external'),
		// Counts
		utmCount: document.getElementById('utm-count'),
		anchorCount: document.getElementById('anchor-count'),
		popupCount: document.getElementById('popup-count'),
		externalCount: document.getElementById('external-count'),
		// Lists
		utmList: document.getElementById('utm-list'),
		anchorList: document.getElementById('anchor-list'),
		popupList: document.getElementById('popup-list'),
		externalList: document.getElementById('external-list'),
		// Groups
		utmGroup: document.getElementById('utm-group'),
		anchorGroup: document.getElementById('anchor-group'),
		popupGroup: document.getElementById('popup-group'),
		externalGroup: document.getElementById('external-group'),
		// Actions
		btnCopyUtms: document.getElementById('btn-copy-utms'),
		btnExport: document.getElementById('btn-export'),
		btnRefresh: document.getElementById('btn-refresh'),
		// Add new elements
		searchInput: document.getElementById('search-input'),
		shortcutsHelp: document.getElementById('shortcuts-help'),
		linkHelp: document.getElementById('link-help'),
	};

	// State
	let settings = {
		enabled: true,
		showUtm: true,
		showAnchors: true,
		showPopups: true,
	};

	let pageData = null;
	let filteredData = null;
	let focusedItemIndex = -1;

	/**
	 * Initialize popup
	 */
	async function init() {
		await loadSettings();
		setupEventListeners();
		await loadPageData();
	}

	/**
	 * Load settings from storage
	 */
	async function loadSettings() {
		try {
			const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
			if (response) {
				settings = response;
				updateToggles();
			}
		} catch (e) {
			console.error('Failed to load settings:', e);
		}
	}

	/**
	 * Update toggle states based on settings
	 */
	function updateToggles() {
		elements.toggleEnabled.checked = settings.enabled;
		elements.toggleUtm.checked = settings.showUtm;
		elements.toggleAnchors.checked = settings.showAnchors;
		elements.togglePopups.checked = settings.showPopups;

		// Disable feature toggles if main toggle is off
		const featureToggles = [elements.toggleUtm, elements.toggleAnchors, elements.togglePopups];
		featureToggles.forEach((toggle) => {
			toggle.disabled = !settings.enabled;
		});
	}

	/**
	 * Save settings to storage
	 */
	async function saveSettings() {
		try {
			await chrome.runtime.sendMessage({
				type: 'UPDATE_SETTINGS',
				settings,
			});
		} catch (e) {
			console.error('Failed to save settings:', e);
		}
	}

	/**
	 * Setup event listeners
	 */
	function setupEventListeners() {
		// Master toggle
		elements.toggleEnabled.addEventListener('change', async (e) => {
			settings.enabled = e.target.checked;
			updateToggles();
			await saveSettings();
		});

		// Feature toggles
		elements.toggleUtm.addEventListener('change', async (e) => {
			settings.showUtm = e.target.checked;
			await saveSettings();
		});

		elements.toggleAnchors.addEventListener('change', async (e) => {
			settings.showAnchors = e.target.checked;
			await saveSettings();
		});

		elements.togglePopups.addEventListener('change', async (e) => {
			settings.showPopups = e.target.checked;
			await saveSettings();
		});

		// Action buttons
		elements.btnCopyUtms.addEventListener('click', copyUtmParameters);
		elements.btnExport.addEventListener('click', exportData);
		elements.btnRefresh.addEventListener('click', loadPageData);

		// Collapsible groups
		document.querySelectorAll('.result-group h3').forEach((header) => {
			header.addEventListener('click', () => {
				const list = header.nextElementSibling;
				list.style.display = list.style.display === 'none' ? 'block' : 'none';
			});
		});

		// Search functionality
		elements.searchInput?.addEventListener('input', debounce(handleSearch, 150));

		// Keyboard navigation
		document.addEventListener('keydown', handleKeyDown);

		// Help link
		elements.linkHelp?.addEventListener('click', (e) => {
			e.preventDefault();
			elements.shortcutsHelp?.classList.toggle('hidden');
		});

		// Close shortcuts on outside click
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.shortcuts-help') && !e.target.closest('#link-help')) {
				elements.shortcutsHelp?.classList.add('hidden');
			}
		});
	}

	/**
	 * Load page data from content script
	 */
	async function loadPageData() {
		showLoading();

		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

			if (!tab || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
				showError();
				return;
			}

			const response = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_PAGE_DATA' });

			if (response && !response.error) {
				pageData = response;
				// Add external links analysis
				pageData.externalLinks = await getExternalLinks(tab.url);
				renderResults();
			} else {
				showError();
			}
		} catch (e) {
			console.error('Failed to load page data:', e);
			showError();
		}
	}

	/**
	 * Get external links from page
	 */
	async function getExternalLinks(currentUrl) {
		try {
			const currentDomain = new URL(currentUrl).hostname;
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

			const result = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: (domain) => {
					const links = document.querySelectorAll('a[href]');
					const external = [];

					links.forEach((link) => {
						try {
							const url = new URL(link.href);
							if (url.hostname && url.hostname !== domain && !url.hostname.endsWith('.' + domain)) {
								external.push({
									href: link.href,
									text: link.textContent.trim().substring(0, 50) || url.hostname,
									domain: url.hostname,
								});
							}
						} catch {}
					});

					// Deduplicate by href
					const seen = new Set();
					return external.filter((item) => {
						if (seen.has(item.href)) return false;
						seen.add(item.href);
						return true;
					});
				},
				args: [currentDomain],
			});

			return result[0]?.result || [];
		} catch (e) {
			return [];
		}
	}

	/**
	 * Show loading state
	 */
	function showLoading() {
		elements.loading.classList.remove('hidden');
		elements.error.classList.add('hidden');
		elements.results.classList.add('hidden');
	}

	/**
	 * Show error state
	 */
	function showError() {
		elements.loading.classList.add('hidden');
		elements.error.classList.remove('hidden');
		elements.results.classList.add('hidden');

		// Reset stats
		elements.statUtm.textContent = '-';
		elements.statAnchors.textContent = '-';
		elements.statPopups.textContent = '-';
		elements.statExternal.textContent = '-';
	}

	/**
	 * Handle search input
	 */
	function handleSearch(e) {
		const query = e.target.value.toLowerCase().trim();

		if (!query) {
			filteredData = null;
			renderResults();
			return;
		}

		filteredData = {
			utmLinks: (pageData?.utmLinks || []).filter(
				(item) =>
					item.href.toLowerCase().includes(query) ||
					item.text.toLowerCase().includes(query) ||
					item.parameters?.some((p) => p.key.toLowerCase().includes(query) || p.value.toLowerCase().includes(query))
			),
			anchors: (pageData?.anchors || []).filter((item) => item.anchorId.toLowerCase().includes(query) || item.sectionTitle.toLowerCase().includes(query)),
			popups: (pageData?.popups || []).filter((item) => item.description.toLowerCase().includes(query) || item.typeName.toLowerCase().includes(query)),
			externalLinks: (pageData?.externalLinks || []).filter(
				(item) => item.href.toLowerCase().includes(query) || item.text.toLowerCase().includes(query) || item.domain.toLowerCase().includes(query)
			),
		};

		renderResults();
	}

	/**
	 * Handle keyboard navigation
	 */
	function handleKeyDown(e) {
		const allItems = document.querySelectorAll('.result-item');

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				focusedItemIndex = Math.min(focusedItemIndex + 1, allItems.length - 1);
				updateFocus(allItems);
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusedItemIndex = Math.max(focusedItemIndex - 1, 0);
				updateFocus(allItems);
				break;
			case 'Enter':
				if (focusedItemIndex >= 0 && allItems[focusedItemIndex]) {
					allItems[focusedItemIndex].click();
				}
				break;
			case 'Escape':
				window.close();
				break;
			case '/':
				if (document.activeElement !== elements.searchInput) {
					e.preventDefault();
					elements.searchInput?.focus();
				}
				break;
		}
	}

	/**
	 * Update focus state
	 */
	function updateFocus(items) {
		items.forEach((item, index) => {
			item.classList.toggle('focused', index === focusedItemIndex);
			if (index === focusedItemIndex) {
				item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
			}
		});
	}

	/**
	 * Render results
	 */
	function renderResults() {
		elements.loading.classList.add('hidden');
		elements.error.classList.add('hidden');
		elements.results.classList.remove('hidden');

		const data = filteredData || pageData;
		const { utmLinks = [], anchors = [], popups = [], externalLinks = [] } = data;

		// Update stats (show original counts, not filtered)
		elements.statUtm.textContent = pageData?.utmLinks?.length || 0;
		elements.statAnchors.textContent = pageData?.anchors?.length || 0;
		elements.statPopups.textContent = pageData?.popups?.length || 0;
		elements.statExternal.textContent = pageData?.externalLinks?.length || 0;

		// Update counts (show filtered counts)
		elements.utmCount.textContent = utmLinks.length;
		elements.anchorCount.textContent = anchors.length;
		elements.popupCount.textContent = popups.length;
		elements.externalCount.textContent = externalLinks.length;

		// Show/hide groups based on content
		elements.utmGroup.classList.toggle('hidden', utmLinks.length === 0);
		elements.anchorGroup.classList.toggle('hidden', anchors.length === 0);
		elements.popupGroup.classList.toggle('hidden', popups.length === 0);
		elements.externalGroup.classList.toggle('hidden', externalLinks.length === 0);

		// Render lists
		renderUtmList(utmLinks);
		renderAnchorList(anchors);
		renderPopupList(popups);
		renderExternalList(externalLinks);

		// Reset focus index
		focusedItemIndex = -1;

		// Show no results if everything is empty
		const hasResults = utmLinks.length || anchors.length || popups.length || externalLinks.length;
		elements.noResults.classList.toggle('hidden', hasResults);
	}

	/**
	 * Render UTM links list
	 */
	function renderUtmList(items) {
		elements.utmList.innerHTML = items
			.map(
				(item) => `
      <li class="result-item" data-url="${escapeHtml(item.href)}">
        <div class="result-item-header">
          <span class="result-item-title">${escapeHtml(item.text) || 'Untitled link'}</span>
          <span class="result-item-badge badge-utm">${item.parameters?.length || 0} params</span>
        </div>
        <div class="result-item-url">${escapeHtml(truncateUrl(item.href))}</div>
        <div class="result-item-params">
          ${(item.parameters || []).map((p) => `<span class="param-tag">${escapeHtml(p.key)}=${escapeHtml(truncate(p.value, 15))}</span>`).join('')}
        </div>
      </li>
    `
			)
			.join('');

		// Add click handlers
		elements.utmList.querySelectorAll('.result-item').forEach((item) => {
			item.addEventListener('click', () => copyToClipboard(item.dataset.url, 'URL copied!'));
		});
	}

	/**
	 * Render anchor links list
	 */
	function renderAnchorList(items) {
		elements.anchorList.innerHTML = items
			.map(
				(item) => `
      <li class="result-item" data-anchor="${escapeHtml(item.anchorId)}">
        <div class="result-item-header">
          <span class="result-item-title">#${escapeHtml(item.anchorId)}</span>
          <span class="result-item-badge ${item.hasTarget ? 'badge-anchor' : 'badge-popup'}">
            ${item.hasTarget ? '✓ Found' : '✗ Missing'}
          </span>
        </div>
        <div class="result-item-url">${escapeHtml(item.sectionTitle)}</div>
      </li>
    `
			)
			.join('');
	}

	/**
	 * Render popup triggers list
	 */
	function renderPopupList(items) {
		elements.popupList.innerHTML = items
			.map(
				(item) => `
      <li class="result-item">
        <div class="result-item-header">
          <span class="result-item-title">${escapeHtml(item.description)}</span>
          <span class="result-item-badge badge-popup">${escapeHtml(item.typeName)}</span>
        </div>
        <div class="result-item-url">${escapeHtml(item.purposeName)}</div>
      </li>
    `
			)
			.join('');
	}

	/**
	 * Render external links list
	 */
	function renderExternalList(items) {
		elements.externalList.innerHTML = items
			.slice(0, 20)
			.map(
				(item) => `
      <li class="result-item" data-url="${escapeHtml(item.href)}">
        <div class="result-item-header">
          <span class="result-item-title">${escapeHtml(item.text)}</span>
          <span class="result-item-badge badge-external">↗</span>
        </div>
        <div class="result-item-url">${escapeHtml(item.domain)}</div>
      </li>
    `
			)
			.join('');

		// Add click handlers
		elements.externalList.querySelectorAll('.result-item').forEach((item) => {
			item.addEventListener('click', () => copyToClipboard(item.dataset.url, 'URL copied!'));
		});
	}

	/**
	 * Copy all UTM parameters to clipboard
	 */
	async function copyUtmParameters() {
		if (!pageData?.utmLinks?.length) {
			showToast('No UTM parameters to copy');
			return;
		}

		const utmText = pageData.utmLinks
			.map((link) => {
				const params = link.parameters?.map((p) => `  ${p.key}: ${p.value}`).join('\n') || '';
				return `URL: ${link.href}\n${params}`;
			})
			.join('\n\n');

		await copyToClipboard(utmText, 'UTM parameters copied!');
		elements.btnCopyUtms.classList.add('success');
		setTimeout(() => elements.btnCopyUtms.classList.remove('success'), 2000);
	}

	/**
	 * Export analysis data as JSON
	 */
	async function exportData() {
		if (!pageData) {
			showToast('No data to export');
			return;
		}

		const exportObj = {
			url: pageData.url,
			title: pageData.title,
			analyzedAt: new Date().toISOString(),
			summary: {
				utmLinks: pageData.utmLinks?.length || 0,
				anchors: pageData.anchors?.length || 0,
				popups: pageData.popups?.length || 0,
				externalLinks: pageData.externalLinks?.length || 0,
			},
			data: pageData,
		};

		const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		a.download = `link-analysis-${Date.now()}.json`;
		a.click();

		URL.revokeObjectURL(url);
		showToast('Data exported!');
	}

	/**
	 * Copy text to clipboard
	 */
	async function copyToClipboard(text, message = 'Copied!') {
		try {
			await navigator.clipboard.writeText(text);
			showToast(message);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	/**
	 * Show toast notification
	 */
	function showToast(message) {
		const existing = document.querySelector('.copy-tooltip');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.className = 'copy-tooltip';
		toast.textContent = message;
		document.body.appendChild(toast);

		setTimeout(() => toast.remove(), 2000);
	}

	/**
	 * Escape HTML
	 */
	function escapeHtml(text) {
		if (!text) return '';
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Truncate string
	 */
	function truncate(str, len) {
		if (!str) return '';
		return str.length > len ? str.substring(0, len) + '...' : str;
	}

	/**
	 * Truncate URL for display
	 */
	function truncateUrl(url) {
		if (!url) return '';
		try {
			const u = new URL(url);
			const path = u.pathname + u.search;
			return path.length > 40 ? path.substring(0, 40) + '...' : path;
		} catch {
			return url.substring(0, 40);
		}
	}

	// Initialize
	init();
})();
