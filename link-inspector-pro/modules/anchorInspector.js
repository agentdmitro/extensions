/**
 * Anchor Inspector Module
 * Detects and analyzes internal anchor links and their target sections
 */

const AnchorInspector = (() => {
	// Cache for section data
	let sectionCache = new Map();

	/**
	 * Check if a link is an anchor link
	 * @param {HTMLAnchorElement} link - Link element to check
	 * @returns {boolean}
	 */
	function isAnchorLink(link) {
		const href = link.getAttribute('href');
		if (!href) return false;

		// Check for # in href
		if (href.startsWith('#') && href.length > 1) return true;

		// Check for same-page anchor
		try {
			const url = new URL(href, window.location.origin);
			return url.pathname === window.location.pathname && url.hash && url.hash.length > 1;
		} catch {
			return false;
		}
	}

	/**
	 * Extract anchor ID from link
	 * @param {HTMLAnchorElement} link - Link element
	 * @returns {string|null} Anchor ID without #
	 */
	function getAnchorId(link) {
		const href = link.getAttribute('href');
		if (!href) return null;

		const hashIndex = href.indexOf('#');
		if (hashIndex === -1) return null;

		return href.substring(hashIndex + 1);
	}

	/**
	 * Find target element for anchor
	 * @param {string} anchorId - Anchor ID to find
	 * @returns {HTMLElement|null}
	 */
	function findTargetElement(anchorId) {
		if (!anchorId) return null;

		// Try by ID first
		let target = document.getElementById(anchorId);
		if (target) return target;

		// Try by name attribute
		target = document.querySelector(`[name="${anchorId}"]`);
		if (target) return target;

		// Try data attributes
		target = document.querySelector(`[data-anchor="${anchorId}"]`);
		return target;
	}

	/**
	 * Get section information
	 * @param {HTMLElement} element - Target element
	 * @returns {Object} Section information
	 */
	function getSectionInfo(element) {
		if (!element) return null;

		// Check cache
		const cached = sectionCache.get(element);
		if (cached) return cached;

		const info = {
			id: element.id,
			tagName: element.tagName.toLowerCase(),
			title: null,
			description: null,
			type: 'element',
		};

		// Determine section type
		if (element.tagName === 'SECTION') info.type = 'section';
		else if (element.tagName === 'ARTICLE') info.type = 'article';
		else if (element.tagName === 'DIV') info.type = 'container';
		else if (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3' || element.tagName === 'H4') {
			info.type = 'heading';
		}

		// Try to find title
		// First check for heading inside
		const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
		if (heading) {
			info.title = heading.textContent.trim().substring(0, 60);
		}

		// Check aria-label
		if (!info.title && element.getAttribute('aria-label')) {
			info.title = element.getAttribute('aria-label');
		}

		// Check data-title
		if (!info.title && element.dataset.title) {
			info.title = element.dataset.title;
		}

		// If element is a heading itself
		if (!info.title && info.type === 'heading') {
			info.title = element.textContent.trim().substring(0, 60);
		}

		// Fallback to formatted ID
		if (!info.title) {
			info.title = formatIdAsTitle(element.id);
		}

		// Get brief description
		const firstP = element.querySelector('p');
		if (firstP) {
			info.description = firstP.textContent.trim().substring(0, 80) + '...';
		}

		// Cache result
		sectionCache.set(element, info);
		return info;
	}

	/**
	 * Format ID as human-readable title
	 * @param {string} id - Element ID
	 * @returns {string} Formatted title
	 */
	function formatIdAsTitle(id) {
		if (!id) return 'Unknown Section';
		return id
			.replace(/[-_]/g, ' ')
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Analyze anchor link
	 * @param {HTMLAnchorElement} link - Link to analyze
	 * @returns {Object|null} Anchor analysis
	 */
	function analyze(link) {
		if (!isAnchorLink(link)) return null;

		const anchorId = getAnchorId(link);
		if (!anchorId) return null;

		const target = findTargetElement(anchorId);
		const sectionInfo = getSectionInfo(target);

		return {
			anchorId,
			hasTarget: !!target,
			target,
			sectionInfo,
			linkText: link.textContent.trim().substring(0, 50),
		};
	}

	/**
	 * Highlight target section
	 * @param {HTMLElement} element - Element to highlight
	 */
	function highlightSection(element) {
		if (!element) return;
		element.classList.add('link-inspector-highlight');
	}

	/**
	 * Remove highlight from section
	 * @param {HTMLElement} element - Element to unhighlight
	 */
	function unhighlightSection(element) {
		if (!element) return;
		element.classList.remove('link-inspector-highlight');
	}

	/**
	 * Scan page for all anchor links
	 * @returns {Array} All anchor links with their data
	 */
	function scanPage() {
		const links = document.querySelectorAll('a[href*="#"]');
		const anchors = [];

		links.forEach((link) => {
			const data = analyze(link);
			if (data) {
				anchors.push({
					element: link,
					href: link.getAttribute('href'),
					...data,
				});
			}
		});

		return anchors;
	}

	/**
	 * Clear section cache
	 */
	function clearCache() {
		sectionCache.clear();
	}

	return {
		isAnchorLink,
		getAnchorId,
		findTargetElement,
		getSectionInfo,
		analyze,
		highlightSection,
		unhighlightSection,
		scanPage,
		clearCache,
	};
})();

// Expose to global scope
window.AnchorInspector = AnchorInspector;
