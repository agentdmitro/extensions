/**
 * Link Inspector Pro - Content Script
 * Main entry point for page inspection
 */

(function () {
	'use strict';

	// State
	let settings = {
		enabled: true,
		showUtm: true,
		showAnchors: true,
		showPopups: true,
	};

	let currentHighlightedElement = null;
	let isInitialized = false;
	let overlayMode = false;
	let overlayElements = [];

	/**
	 * Initialize the content script
	 */
	async function init() {
		if (isInitialized) return;
		isInitialized = true;

		// Load settings
		try {
			const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
			if (response) {
				settings = response;
			}
		} catch (e) {
			console.log('Link Inspector: Using default settings');
		}

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

		// Set up event listeners
		setupEventListeners();

		// Set up keyboard shortcuts
		setupKeyboardShortcuts();

		// Listen for settings updates
		chrome.runtime.onMessage.addListener(handleMessage);

		// Inject overlay styles
		injectOverlayStyles();
	}

	/**
	 * Setup keyboard shortcuts
	 */
	function setupKeyboardShortcuts() {
		document.addEventListener('keydown', (e) => {
			// Alt+L: Toggle overlay mode
			if (e.altKey && e.key.toLowerCase() === 'l' && !e.shiftKey) {
				e.preventDefault();
				toggleOverlayMode();
			}

			// Escape: Hide tooltip and disable overlay
			if (e.key === 'Escape') {
				TooltipManager.hide();
				if (overlayMode) {
					toggleOverlayMode();
				}
			}

			// C: Copy current link URL (when tooltip visible)
			if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && TooltipManager.isTooltipVisible()) {
				const activeLink = document.querySelector('a:hover');
				if (activeLink) {
					navigator.clipboard.writeText(activeLink.href);
					showCopyFeedback('URL copied!');
				}
			}
		});
	}

	/**
	 * Toggle overlay mode
	 */
	function toggleOverlayMode() {
		overlayMode = !overlayMode;

		if (overlayMode) {
			createOverlays();
			showCopyFeedback('Overlay mode ON');
		} else {
			removeOverlays();
			showCopyFeedback('Overlay mode OFF');
		}
	}

	/**
	 * Create visual overlays for all special links
	 */
	function createOverlays() {
		removeOverlays(); // Clean up first

		const links = document.querySelectorAll('a[href]');

		links.forEach((link) => {
			const data = analyzeLink(link);
			const badges = [];

			if (settings.showUtm && data.utm?.hasTracking) {
				badges.push({ type: 'utm', label: 'UTM', color: '#8b5cf6' });
			}
			if (settings.showUtm && data.utm?.affiliate) {
				badges.push({ type: 'affiliate', label: data.utm.affiliate.network, color: '#10b981' });
			}
			if (settings.showAnchors && data.anchor) {
				badges.push({
					type: 'anchor',
					label: data.anchor.hasTarget ? '⚓' : '⚓!',
					color: data.anchor.hasTarget ? '#22c55e' : '#ef4444',
				});
			}
			if (settings.showPopups && data.popup?.hasPopup) {
				badges.push({ type: 'popup', label: '🪟', color: '#ec4899' });
			}

			if (badges.length > 0) {
				const overlay = createBadgeOverlay(link, badges);
				overlayElements.push(overlay);
			}
		});
	}

	/**
	 * Create badge overlay element
	 */
	function createBadgeOverlay(link, badges) {
		const container = document.createElement('span');
		container.className = 'lip-badge-container';
		container.style.cssText = `
			display: inline-flex;
			gap: 2px;
			margin-left: 4px;
			vertical-align: middle;
		`;

		badges.forEach((badge) => {
			const el = document.createElement('span');
			el.className = `lip-badge lip-badge-${badge.type}`;
			el.textContent = badge.label;
			el.style.cssText = `
				display: inline-block;
				padding: 1px 4px;
				font-size: 9px;
				font-weight: 600;
				border-radius: 3px;
				background: ${badge.color};
				color: white;
				line-height: 1.2;
				font-family: -apple-system, sans-serif;
			`;
			container.appendChild(el);
		});

		link.appendChild(container);
		return container;
	}

	/**
	 * Remove all overlays
	 */
	function removeOverlays() {
		overlayElements.forEach((el) => el.remove());
		overlayElements = [];
		document.querySelectorAll('.lip-badge-container').forEach((el) => el.remove());
	}

	/**
	 * Inject overlay styles
	 */
	function injectOverlayStyles() {
		if (document.getElementById('lip-overlay-styles')) return;

		const style = document.createElement('style');
		style.id = 'lip-overlay-styles';
		style.textContent = `
			.lip-badge-container {
				pointer-events: none;
				animation: lip-fade-in 0.2s ease;
			}
			@keyframes lip-fade-in {
				from { opacity: 0; transform: scale(0.8); }
				to { opacity: 1; transform: scale(1); }
			}
		`;
		document.head.appendChild(style);
	}

	/**
	 * Show copy feedback toast
	 */
	function showCopyFeedback(message) {
		const existing = document.querySelector('.lip-toast');
		if (existing) existing.remove();

		const toast = document.createElement('div');
		toast.className = 'lip-toast';
		toast.textContent = message;
		toast.style.cssText = `
			position: fixed;
			bottom: 20px;
			left: 50%;
			transform: translateX(-50%);
			padding: 10px 20px;
			background: #10b981;
			color: white;
			border-radius: 8px;
			font-size: 13px;
			font-weight: 500;
			font-family: -apple-system, sans-serif;
			box-shadow: 0 4px 12px rgba(0,0,0,0.3);
			z-index: 2147483647;
			animation: lip-toast-in 0.3s ease;
		`;
		document.body.appendChild(toast);
		setTimeout(() => toast.remove(), 2000);
	}

	/**
	 * Initialize when DOM is ready
	 */
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
