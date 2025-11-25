/**
 * Tooltip Manager Module
 * Manages tooltip display for link inspection
 */

const TooltipManager = (() => {
	let tooltipElement = null;
	let isVisible = false;

	/**
	 * Create tooltip element
	 */
	function createTooltip() {
		if (tooltipElement) return tooltipElement;

		tooltipElement = document.createElement('div');
		tooltipElement.id = 'lip-tooltip';
		tooltipElement.className = 'lip-tooltip';
		tooltipElement.style.cssText = `
			position: fixed;
			z-index: 2147483647;
			background: #1a1a2e;
			color: #e4e4eb;
			padding: 12px 16px;
			border-radius: 8px;
			font-family: -apple-system, BlinkMacSystemFont, sans-serif;
			font-size: 12px;
			max-width: 350px;
			box-shadow: 0 4px 20px rgba(0,0,0,0.4);
			border: 1px solid rgba(139, 92, 246, 0.3);
			display: none;
			pointer-events: none;
		`;
		document.body.appendChild(tooltipElement);
		return tooltipElement;
	}

	/**
	 * Show tooltip
	 * @param {string} content - HTML content
	 * @param {number} x - X position
	 * @param {number} y - Y position
	 */
	function show(content, x, y) {
		const tooltip = createTooltip();
		tooltip.innerHTML = content;
		tooltip.style.display = 'block';

		// Position tooltip
		const rect = tooltip.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let left = x + 10;
		let top = y + 10;

		// Adjust if overflowing right
		if (left + rect.width > viewportWidth) {
			left = x - rect.width - 10;
		}

		// Adjust if overflowing bottom
		if (top + rect.height > viewportHeight) {
			top = y - rect.height - 10;
		}

		tooltip.style.left = `${Math.max(10, left)}px`;
		tooltip.style.top = `${Math.max(10, top)}px`;
		isVisible = true;
	}

	/**
	 * Hide tooltip
	 */
	function hide() {
		if (tooltipElement) {
			tooltipElement.style.display = 'none';
		}
		isVisible = false;
	}

	/**
	 * Check if tooltip is visible
	 * @returns {boolean}
	 */
	function isTooltipVisible() {
		return isVisible;
	}

	/**
	 * Update tooltip content
	 * @param {string} content - HTML content
	 */
	function update(content) {
		if (tooltipElement && isVisible) {
			tooltipElement.innerHTML = content;
		}
	}

	return {
		show,
		hide,
		update,
		isTooltipVisible,
	};
})();

// Expose to global scope
window.TooltipManager = TooltipManager;
