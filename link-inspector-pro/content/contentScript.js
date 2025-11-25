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

	let isInitialized = false;
	let overlayMode = false;
	let overlayElements = [];
	let currentHighlightedSection = null;

	/**
	 * Analyze a link element
	 * @param {HTMLAnchorElement} link - Link to analyze
	 * @returns {Object} Analysis result
	 */
	function analyzeLink(link) {
		const result = {
			utm: null,
			anchor: null,
			popup: null,
		};

		try {
			if (typeof window.UTMParser !== 'undefined') {
				result.utm = window.UTMParser.parse(link.href, link);
			}
			if (typeof window.AnchorInspector !== 'undefined') {
				result.anchor = window.AnchorInspector.analyze(link);
			}
			if (typeof window.PopupDetector !== 'undefined') {
				result.popup = window.PopupDetector.analyze(link);
			}
		} catch (e) {
			console.error('Link Inspector: Error analyzing link', e);
		}

		return result;
	}

	/**
	 * Handle messages from popup and background
	 * @param {Object} message - Message object
	 * @param {Object} sender - Sender info
	 * @param {Function} sendResponse - Response callback
	 */
	function handleMessage(message, sender, sendResponse) {
		// Always handle COLLECT_PAGE_DATA
		if (message.type === 'COLLECT_PAGE_DATA') {
			try {
				const data = collectPageData();
				sendResponse(data);
			} catch (e) {
				console.error('Link Inspector: Error collecting page data', e);
				sendResponse({ error: e.message, url: window.location.href, title: document.title, utmLinks: [], anchors: [], popups: [] });
			}
			return true; // Keep channel open for async response
		}

		if (message.type === 'SETTINGS_UPDATED') {
			settings = message.settings;
			if (overlayMode) {
				createOverlays();
			}
			sendResponse({ success: true });
			return true;
		}

		// For unknown messages, don't respond
		return false;
	}

	/**
	 * Collect page data for popup
	 * @returns {Object} Page data
	 */
	function collectPageData() {
		const data = {
			url: window.location.href,
			title: document.title,
			utmLinks: [],
			anchors: [],
			popups: [],
		};

		try {
			// Collect UTM links
			if (typeof window.UTMParser !== 'undefined') {
				const utmResults = window.UTMParser.scanPage();
				data.utmLinks = utmResults.map((item) => ({
					href: item.href,
					text: item.text,
					parameters: item.parameters,
					hasTracking: item.hasTracking,
					affiliate: item.affiliate,
				}));
			}

			// Collect anchors
			if (typeof window.AnchorInspector !== 'undefined') {
				const anchorResults = window.AnchorInspector.scanPage();
				data.anchors = anchorResults.map((item) => ({
					href: item.href,
					anchorId: item.anchorId,
					hasTarget: item.hasTarget,
					sectionTitle: item.sectionInfo?.title || item.anchorId,
				}));
			}

			// Collect popups
			if (typeof window.PopupDetector !== 'undefined') {
				const popupResults = window.PopupDetector.scanPage();
				data.popups = popupResults.map((item) => ({
					href: item.href,
					typeName: item.typeName,
					purposeName: item.purposeName,
					description: item.description,
				}));
			}
		} catch (e) {
			console.error('Link Inspector: Error scanning page', e);
		}

		return data;
	}

	/**
	 * Initialize the content script
	 */
	function init() {
		if (isInitialized) return;
		isInitialized = true;

		// Listen for messages FIRST - this is critical
		chrome.runtime.onMessage.addListener(handleMessage);

		// Load settings async (don't block initialization)
		chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })
			.then((response) => {
				if (response) {
					settings = response;
				}
			})
			.catch((e) => {
				console.log('Link Inspector: Using default settings');
			});

		// Set up keyboard shortcuts
		setupKeyboardShortcuts();

		// Set up anchor navigation highlighting
		setupAnchorHighlighting();

		// Inject overlay styles
		injectOverlayStyles();

		// Check if page loaded with a hash
		if (window.location.hash) {
			setTimeout(() => highlightAnchorTarget(window.location.hash), 300);
		}

		console.log('Link Inspector Pro: Content script initialized');
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

			// Escape: Disable overlay
			if (e.key === 'Escape') {
				if (typeof window.TooltipManager !== 'undefined') {
					window.TooltipManager.hide();
				}
				if (overlayMode) {
					toggleOverlayMode();
				}
			}

			// C: Copy current link URL (when hovering)
			if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
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
	 * Setup anchor navigation highlighting
	 */
	function setupAnchorHighlighting() {
		// Listen for hash changes (back/forward navigation, programmatic changes)
		window.addEventListener('hashchange', (e) => {
			if (window.location.hash) {
				highlightAnchorTarget(window.location.hash);
			}
		});

		// Listen for clicks on anchor links
		document.addEventListener('click', (e) => {
			const link = e.target.closest('a[href*="#"]');
			if (!link) return;

			const href = link.getAttribute('href');
			if (!href) return;

			// Check if it's a same-page anchor
			let targetHash = null;
			
			if (href.startsWith('#')) {
				targetHash = href;
			} else {
				try {
					const url = new URL(href, window.location.origin);
					if (url.pathname === window.location.pathname && url.hash) {
						targetHash = url.hash;
					}
				} catch {}
			}

			if (targetHash && targetHash.length > 1) {
				// Small delay to let the browser scroll first
				setTimeout(() => highlightAnchorTarget(targetHash), 100);
			}
		});
	}

	/**
	 * Highlight the target section of an anchor
	 * @param {string} hash - The hash including # symbol
	 */
	function highlightAnchorTarget(hash) {
		if (!hash || hash.length <= 1) return;

		const targetId = hash.substring(1);
		let targetElement = document.getElementById(targetId);
		
		// Try name attribute if ID not found
		if (!targetElement) {
			targetElement = document.querySelector(`[name="${targetId}"]`);
		}

		if (!targetElement) return;

		// Remove previous highlight
		removeAnchorHighlight();

		// Add highlight class
		targetElement.classList.add('lip-anchor-target-highlight');
		currentHighlightedSection = targetElement;

		// Show feedback toast
		const sectionName = getSectionName(targetElement);
		showCopyFeedback(`📍 Jumped to: ${sectionName}`);

		// Remove highlight after animation completes (3 seconds)
		setTimeout(() => {
			removeAnchorHighlight();
		}, 3000);
	}

	/**
	 * Remove anchor highlight from current element
	 */
	function removeAnchorHighlight() {
		if (currentHighlightedSection) {
			currentHighlightedSection.classList.remove('lip-anchor-target-highlight');
			currentHighlightedSection = null;
		}
		// Also clean up any orphaned highlights
		document.querySelectorAll('.lip-anchor-target-highlight').forEach(el => {
			el.classList.remove('lip-anchor-target-highlight');
		});
	}

	/**
	 * Get a human-readable name for a section
	 * @param {HTMLElement} element - The target element
	 * @returns {string} Section name
	 */
	function getSectionName(element) {
		// Try to find a heading inside
		const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
		if (heading) {
			return heading.textContent.trim().substring(0, 40);
		}

		// Try aria-label
		if (element.getAttribute('aria-label')) {
			return element.getAttribute('aria-label').substring(0, 40);
		}

		// If element is a heading itself
		if (/^H[1-6]$/.test(element.tagName)) {
			return element.textContent.trim().substring(0, 40);
		}

		// Format ID as name
		if (element.id) {
			return element.id
				.replace(/[-_]/g, ' ')
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				.replace(/\b\w/g, c => c.toUpperCase())
				.substring(0, 40);
		}

		return 'Section';
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
			@keyframes lip-toast-in {
				from { opacity: 0; transform: translateX(-50%) translateY(20px); }
				to { opacity: 1; transform: translateX(-50%) translateY(0); }
			}
			
			/* Anchor target highlight styles */
			.lip-anchor-target-highlight {
				position: relative;
				animation: lip-anchor-highlight 3s ease-out forwards;
			}
			
			.lip-anchor-target-highlight::before {
				content: '';
				position: absolute;
				inset: -8px;
				background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%);
				border: 2px solid rgba(139, 92, 246, 0.5);
				border-radius: 8px;
				pointer-events: none;
				animation: lip-anchor-border-pulse 3s ease-out forwards;
				z-index: 9999;
			}
			
			.lip-anchor-target-highlight::after {
				content: '📍';
				position: absolute;
				top: -12px;
				left: -12px;
				font-size: 20px;
				animation: lip-anchor-icon-fade 3s ease-out forwards;
				z-index: 10000;
				filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
			}
			
			@keyframes lip-anchor-highlight {
				0% {
					outline: 3px solid rgba(139, 92, 246, 0.8);
					outline-offset: 4px;
					box-shadow: 0 0 30px rgba(139, 92, 246, 0.4);
				}
				70% {
					outline: 3px solid rgba(139, 92, 246, 0.6);
					outline-offset: 4px;
					box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
				}
				100% {
					outline: 3px solid transparent;
					outline-offset: 4px;
					box-shadow: 0 0 0 transparent;
				}
			}
			
			@keyframes lip-anchor-border-pulse {
				0% {
					opacity: 1;
					transform: scale(1);
				}
				50% {
					opacity: 0.8;
					transform: scale(1.02);
				}
				70% {
					opacity: 0.5;
				}
				100% {
					opacity: 0;
					transform: scale(1.05);
				}
			}
			
			@keyframes lip-anchor-icon-fade {
				0% {
					opacity: 1;
					transform: scale(1) translateY(0);
				}
				20% {
					opacity: 1;
					transform: scale(1.2) translateY(-5px);
				}
				70% {
					opacity: 0.8;
					transform: scale(1) translateY(0);
				}
				100% {
					opacity: 0;
					transform: scale(0.8) translateY(5px);
				}
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
