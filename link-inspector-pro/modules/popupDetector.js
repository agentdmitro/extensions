/**
 * Popup Detector Module
 * Detects and analyzes popup/modal trigger links
 */

const PopupDetector = (() => {
	// Patterns that indicate popup triggers
	const POPUP_PATTERNS = {
		id: [/popup/i, /modal/i, /dialog/i, /drawer/i, /offcanvas/i, /overlay/i, /lightbox/i, /slideover/i, /sheet/i],
		dataAttr: [
			'data-popup',
			'data-modal',
			'data-toggle',
			'data-bs-toggle',
			'data-dialog',
			'data-drawer',
			'data-overlay',
			'data-fancybox',
			'data-lightbox',
			'data-micromodal-trigger',
		],
		classes: [/popup/i, /modal/i, /dialog/i, /drawer/i, /offcanvas/i, /overlay/i, /lightbox/i, /fancybox/i],
	};

	// Type detection keywords
	const TYPE_KEYWORDS = {
		modal: ['modal', 'dialog', 'lightbox'],
		popup: ['popup', 'popover', 'tooltip'],
		drawer: ['drawer', 'slideover', 'sidebar', 'offcanvas'],
		sheet: ['sheet', 'bottom-sheet', 'action-sheet'],
		overlay: ['overlay', 'backdrop'],
	};

	// Purpose detection keywords
	const PURPOSE_KEYWORDS = {
		subscription: ['subscribe', 'newsletter', 'email', 'signup', 'sign-up'],
		login: ['login', 'signin', 'sign-in', 'auth'],
		contact: ['contact', 'inquiry', 'message', 'form'],
		cart: ['cart', 'basket', 'checkout'],
		search: ['search', 'find'],
		menu: ['menu', 'nav', 'navigation'],
		share: ['share', 'social'],
		video: ['video', 'youtube', 'vimeo', 'player'],
		image: ['gallery', 'image', 'photo', 'lightbox'],
		confirmation: ['confirm', 'delete', 'remove', 'warning'],
	};

	/**
	 * Check if link triggers a popup
	 * @param {HTMLAnchorElement} link - Link to check
	 * @returns {boolean}
	 */
	function isPopupTrigger(link) {
		const href = link.getAttribute('href') || '';

		// Check href for popup patterns
		for (const pattern of POPUP_PATTERNS.id) {
			if (pattern.test(href)) return true;
		}

		// Check data attributes
		for (const attr of POPUP_PATTERNS.dataAttr) {
			if (link.hasAttribute(attr)) return true;
		}

		// Check classes on link
		for (const pattern of POPUP_PATTERNS.classes) {
			if (pattern.test(link.className)) return true;
		}

		// Check role attribute
		if (link.getAttribute('role') === 'button') {
			const ariaControls = link.getAttribute('aria-controls');
			if (ariaControls) {
				for (const pattern of POPUP_PATTERNS.id) {
					if (pattern.test(ariaControls)) return true;
				}
			}
		}

		return false;
	}

	/**
	 * Find popup element associated with link
	 * @param {HTMLAnchorElement} link - Trigger link
	 * @returns {HTMLElement|null}
	 */
	function findPopupElement(link) {
		const href = link.getAttribute('href') || '';

		// Try by ID from href
		if (href.startsWith('#') && href.length > 1) {
			const id = href.substring(1);
			const element = document.getElementById(id);
			if (element) return element;
		}

		// Try aria-controls
		const ariaControls = link.getAttribute('aria-controls');
		if (ariaControls) {
			const element = document.getElementById(ariaControls);
			if (element) return element;
		}

		// Try data-target (Bootstrap)
		const dataTarget = link.dataset.target || link.dataset.bsTarget;
		if (dataTarget) {
			const element = document.querySelector(dataTarget);
			if (element) return element;
		}

		// Try data-popup
		const dataPopup = link.dataset.popup || link.dataset.modal;
		if (dataPopup) {
			const element = document.getElementById(dataPopup) || document.querySelector(`[data-popup-id="${dataPopup}"]`);
			if (element) return element;
		}

		return null;
	}

	/**
	 * Detect popup type
	 * @param {HTMLElement} element - Popup element
	 * @param {HTMLAnchorElement} link - Trigger link
	 * @returns {string}
	 */
	function detectType(element, link) {
		const searchText = [element?.className || '', element?.id || '', link.className, link.getAttribute('href') || '', link.getAttribute('aria-controls') || '']
			.join(' ')
			.toLowerCase();

		for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
			for (const keyword of keywords) {
				if (searchText.includes(keyword)) return type;
			}
		}

		return 'popup';
	}

	/**
	 * Detect popup purpose
	 * @param {HTMLElement} element - Popup element
	 * @param {HTMLAnchorElement} link - Trigger link
	 * @returns {string}
	 */
	function detectPurpose(element, link) {
		const searchText = [
			element?.className || '',
			element?.id || '',
			element?.getAttribute('aria-label') || '',
			element?.textContent?.substring(0, 200) || '',
			link.textContent || '',
			link.getAttribute('href') || '',
		]
			.join(' ')
			.toLowerCase();

		for (const [purpose, keywords] of Object.entries(PURPOSE_KEYWORDS)) {
			for (const keyword of keywords) {
				if (searchText.includes(keyword)) return purpose;
			}
		}

		return 'general';
	}

	/**
	 * Get popup description
	 * @param {HTMLElement} element - Popup element
	 * @returns {string}
	 */
	function getPopupDescription(element) {
		if (!element) return 'Unknown popup';

		// Try aria-label
		const ariaLabel = element.getAttribute('aria-label');
		if (ariaLabel) return ariaLabel;

		// Try title
		const title = element.getAttribute('title');
		if (title) return title;

		// Try heading inside
		const heading = element.querySelector('h1, h2, h3, h4, h5, h6, .modal-title, .dialog-title');
		if (heading) return heading.textContent.trim().substring(0, 50);

		// Try first paragraph
		const para = element.querySelector('p');
		if (para) return para.textContent.trim().substring(0, 50) + '...';

		// Fallback to ID
		if (element.id) {
			return element.id
				.replace(/[-_]/g, ' ')
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				.replace(/\b\w/g, (c) => c.toUpperCase());
		}

		return 'Popup content';
	}

	/**
	 * Analyze popup trigger
	 * @param {HTMLAnchorElement} link - Link to analyze
	 * @returns {Object|null}
	 */
	function analyze(link) {
		if (!isPopupTrigger(link)) return null;

		const popupElement = findPopupElement(link);
		const type = detectType(popupElement, link);
		const purpose = detectPurpose(popupElement, link);
		const description = getPopupDescription(popupElement);

		// Format type name
		const typeNames = {
			modal: 'Modal Window',
			popup: 'Popup',
			drawer: 'Slide-out Drawer',
			sheet: 'Bottom Sheet',
			overlay: 'Overlay',
		};

		// Format purpose
		const purposeNames = {
			subscription: 'Subscription Form',
			login: 'Login/Authentication',
			contact: 'Contact Form',
			cart: 'Shopping Cart',
			search: 'Search',
			menu: 'Navigation Menu',
			share: 'Share Options',
			video: 'Video Player',
			image: 'Image Gallery',
			confirmation: 'Confirmation Dialog',
			general: 'General Content',
		};

		return {
			hasPopup: true,
			popupElement,
			type,
			typeName: typeNames[type] || 'Popup',
			purpose,
			purposeName: purposeNames[purpose] || 'General',
			description,
			linkText: link.textContent.trim().substring(0, 50),
		};
	}

	/**
	 * Scan page for popup triggers
	 * @returns {Array}
	 */
	function scanPage() {
		const links = document.querySelectorAll('a[href], button, [role="button"]');
		const popups = [];
		const seen = new Set();

		links.forEach((link) => {
			const data = analyze(link);
			if (data) {
				// Deduplicate by popup element
				const key = data.popupElement?.id || link.getAttribute('href') || Math.random();
				if (!seen.has(key)) {
					seen.add(key);
					popups.push({
						element: link,
						href: link.getAttribute('href'),
						...data,
					});
				}
			}
		});

		return popups;
	}

	return {
		isPopupTrigger,
		findPopupElement,
		detectType,
		detectPurpose,
		analyze,
		scanPage,
	};
})();

// Expose to global scope
window.PopupDetector = PopupDetector;
