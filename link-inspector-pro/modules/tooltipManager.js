/**
 * Tooltip Manager Module
 * Handles tooltip creation, positioning, and rendering
 */

const TooltipManager = (() => {
	let tooltipElement = null;
	let isVisible = false;
	let hideTimeout = null;

	/**
	 * Create tooltip element
	 */
	function createTooltip() {
		if (tooltipElement) return;

		tooltipElement = document.createElement('div');
		tooltipElement.id = 'link-inspector-tooltip';
		tooltipElement.className = 'link-inspector-tooltip';
		document.body.appendChild(tooltipElement);
	}

	/**
	 * Position tooltip near cursor avoiding overlap
	 * @param {number} x - Mouse X position
	 * @param {number} y - Mouse Y position
	 */
	function position(x, y) {
		if (!tooltipElement) return;

		const rect = tooltipElement.getBoundingClientRect();
		const padding = 15;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let left = x + padding;
		let top = y + padding;

		// Adjust if tooltip goes off right edge
		if (left + rect.width > viewportWidth - padding) {
			left = x - rect.width - padding;
		}

		// Adjust if tooltip goes off bottom edge
		if (top + rect.height > viewportHeight - padding) {
			top = y - rect.height - padding;
		}

		// Ensure not off left or top
		left = Math.max(padding, left);
		top = Math.max(padding, top);

		tooltipElement.style.left = `${left}px`;
		tooltipElement.style.top = `${top}px`;
	}

	/**
	 * Generate UTM tooltip content
	 * @param {Object} utmData - Parsed UTM data
	 * @returns {string} HTML content
	 */
	function renderUtmContent(utmData) {
		if (!utmData.hasTracking) return '';

		let html = '<div class="tooltip-section tooltip-utm">';
		html += '<div class="tooltip-header"><span class="tooltip-icon">📊</span> UTM Parameters</div>';

		utmData.parameters.forEach((param) => {
			html += `
        <div class="tooltip-param">
          <div class="param-name">${param.name}</div>
          <div class="param-value">${escapeHtml(param.value)}</div>
          <div class="param-meaning">${param.meaning}</div>
        </div>
      `;
		});

		html += '</div>';
		return html;
	}

	/**
	 * Generate anchor tooltip content
	 * @param {Object} anchorData - Anchor analysis data
	 * @returns {string} HTML content
	 */
	function renderAnchorContent(anchorData) {
		if (!anchorData) return '';

		let html = '<div class="tooltip-section tooltip-anchor">';
		html += '<div class="tooltip-header"><span class="tooltip-icon">⚓</span> Anchor Link</div>';

		const status = anchorData.hasTarget ? '✓ Target found' : '✗ Target not found';
		const statusClass = anchorData.hasTarget ? 'status-found' : 'status-missing';

		html += `<div class="anchor-status ${statusClass}">${status}</div>`;

		if (anchorData.sectionInfo) {
			html += `
        <div class="anchor-info">
          <div class="section-title">Scrolls to: ${escapeHtml(anchorData.sectionInfo.title)}</div>
          <div class="section-type">Type: ${anchorData.sectionInfo.type}</div>
          ${anchorData.sectionInfo.description ? `<div class="section-desc">${escapeHtml(anchorData.sectionInfo.description)}</div>` : ''}
        </div>
      `;
		}

		html += '</div>';
		return html;
	}

	/**
	 * Generate popup tooltip content
	 * @param {Object} popupData - Popup analysis data
	 * @returns {string} HTML content
	 */
	function renderPopupContent(popupData) {
		if (!popupData?.hasPopup) return '';

		let html = '<div class="tooltip-section tooltip-popup">';
		html += '<div class="tooltip-header"><span class="tooltip-icon">🪟</span> Popup Trigger</div>';

		html += `
      <div class="popup-info">
        <div class="popup-type">${popupData.typeName}</div>
        <div class="popup-purpose">${popupData.purposeName}</div>
        <div class="popup-desc">${escapeHtml(popupData.description)}</div>
      </div>
    `;

		html += '</div>';
		return html;
	}

	/**
	 * Escape HTML entities
	 * @param {string} text - Text to escape
	 * @returns {string}
	 */
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Show tooltip with content
	 * @param {Object} data - Combined analysis data
	 * @param {number} x - Mouse X
	 * @param {number} y - Mouse Y
	 */
	function show(data, x, y) {
		createTooltip();

		if (hideTimeout) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}

		let content = '';

		if (data.utm) {
			content += renderUtmContent(data.utm);
		}

		if (data.anchor) {
			content += renderAnchorContent(data.anchor);
		}

		if (data.popup) {
			content += renderPopupContent(data.popup);
		}

		if (!content) {
			hide();
			return;
		}

		tooltipElement.innerHTML = content;
		tooltipElement.classList.add('visible');
		isVisible = true;

		// Position after content is set (for accurate dimensions)
		requestAnimationFrame(() => position(x, y));
	}

	/**
	 * Update tooltip position
	 * @param {number} x - Mouse X
	 * @param {number} y - Mouse Y
	 */
	function updatePosition(x, y) {
		if (isVisible) {
			position(x, y);
		}
	}

	/**
	 * Hide tooltip
	 * @param {number} delay - Delay before hiding (ms)
	 */
	function hide(delay = 0) {
		if (delay > 0) {
			hideTimeout = setTimeout(() => {
				if (tooltipElement) {
					tooltipElement.classList.remove('visible');
					isVisible = false;
				}
			}, delay);
		} else {
			if (tooltipElement) {
				tooltipElement.classList.remove('visible');
				isVisible = false;
			}
		}
	}

	/**
	 * Check if tooltip is currently visible
	 * @returns {boolean}
	 */
	function isTooltipVisible() {
		return isVisible;
	}

	/**
	 * Destroy tooltip element
	 */
	function destroy() {
		if (tooltipElement) {
			tooltipElement.remove();
			tooltipElement = null;
			isVisible = false;
		}
	}

	return {
		show,
		hide,
		updatePosition,
		isTooltipVisible,
		destroy,
	};
})();

// Expose to global scope
window.TooltipManager = TooltipManager;
