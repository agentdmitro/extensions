/**
 * UTM Parser Module
 * Detects and explains UTM and tracking parameters in URLs
 */

const UTMParser = (() => {
	// Parameter definitions with descriptions
	const PARAM_DEFINITIONS = {
		// Standard UTM parameters
		utm_source: {
			name: 'UTM Source',
			meaning: 'Traffic source - which platform sent the visitor',
			category: 'utm',
		},
		utm_medium: {
			name: 'UTM Medium',
			meaning: 'Marketing medium - type of traffic (cpc, email, social, etc.)',
			category: 'utm',
		},
		utm_campaign: {
			name: 'UTM Campaign',
			meaning: 'Campaign name - identifies specific marketing campaign',
			category: 'utm',
		},
		utm_term: {
			name: 'UTM Term',
			meaning: 'Paid search keyword - the keyword that triggered the ad',
			category: 'utm',
		},
		utm_content: {
			name: 'UTM Content',
			meaning: 'Content variant - differentiates similar links/ads',
			category: 'utm',
		},
		utm_id: {
			name: 'UTM ID',
			meaning: 'Campaign ID - unique identifier for the campaign',
			category: 'utm',
		},

		// Google Ads
		gclid: {
			name: 'Google Click ID',
			meaning: 'Google Ads click identifier for conversion tracking',
			category: 'ads',
		},
		gclsrc: {
			name: 'Google Click Source',
			meaning: 'Google Ads click source type',
			category: 'ads',
		},

		// Facebook/Meta
		fbclid: {
			name: 'Facebook Click ID',
			meaning: 'Facebook/Meta click identifier for conversion tracking',
			category: 'ads',
		},
		fb_action_ids: {
			name: 'Facebook Action IDs',
			meaning: 'Facebook action tracking identifiers',
			category: 'ads',
		},

		// Microsoft/Bing
		msclkid: {
			name: 'Microsoft Click ID',
			meaning: 'Microsoft/Bing Ads click identifier',
			category: 'ads',
		},

		// Other common tracking
		ref: {
			name: 'Referrer',
			meaning: 'Referral source or affiliate identifier',
			category: 'tracking',
		},
		source: {
			name: 'Source',
			meaning: 'Generic traffic source identifier',
			category: 'tracking',
		},
		campaign: {
			name: 'Campaign',
			meaning: 'Generic campaign identifier',
			category: 'tracking',
		},
		affiliate_id: {
			name: 'Affiliate ID',
			meaning: 'Affiliate partner identifier',
			category: 'tracking',
		},
		aff_id: {
			name: 'Affiliate ID',
			meaning: 'Affiliate partner identifier (shorthand)',
			category: 'tracking',
		},
		promo: {
			name: 'Promo Code',
			meaning: 'Promotional campaign code',
			category: 'tracking',
		},
		cid: {
			name: 'Client/Campaign ID',
			meaning: 'Client or campaign identifier',
			category: 'tracking',
		},
		mc_cid: {
			name: 'Mailchimp Campaign ID',
			meaning: 'Mailchimp email campaign identifier',
			category: 'email',
		},
		mc_eid: {
			name: 'Mailchimp Email ID',
			meaning: 'Mailchimp subscriber email identifier',
			category: 'email',
		},
	};

	// Affiliate network patterns
	const AFFILIATE_PATTERNS = {
		amazon: [/amazon\.\w+\/.*[?&]tag=/i, /amzn\.to/i],
		shareasale: [/shareasale\.com/i],
		cj: [/anrdoezrs\.net/i, /dpbolvw\.net/i, /jdoqocy\.com/i, /kqzyfj\.com/i, /tkqlhce\.com/i],
		rakuten: [/linksynergy\.com/i, /click\.linksynergy\.com/i],
		impact: [/impactradius\.com/i, /7eer\.net/i],
		awin: [/awin1\.com/i],
		partnerize: [/prf\.hn/i],
	};

	// REL attribute meanings
	const REL_MEANINGS = {
		nofollow: 'Search engines should not follow this link',
		sponsored: 'This is a paid/sponsored link',
		ugc: 'User-generated content link',
		noopener: 'Prevents new page from accessing window.opener',
		noreferrer: 'Prevents sending referrer header',
		external: 'Links to external site',
	};

	/**
	 * Detect if URL is an affiliate link
	 * @param {string} url - URL to check
	 * @returns {Object|null}
	 */
	function detectAffiliate(url) {
		for (const [network, patterns] of Object.entries(AFFILIATE_PATTERNS)) {
			for (const pattern of patterns) {
				if (pattern.test(url)) {
					return {
						isAffiliate: true,
						network: network.charAt(0).toUpperCase() + network.slice(1),
					};
				}
			}
		}
		return null;
	}

	/**
	 * Analyze rel attribute
	 * @param {HTMLAnchorElement} link - Link element
	 * @returns {Object}
	 */
	function analyzeRelAttribute(link) {
		const rel = link.getAttribute('rel') || '';
		const relValues = rel.toLowerCase().split(/\s+/).filter(Boolean);

		return {
			raw: rel,
			values: relValues,
			meanings: relValues.filter((v) => REL_MEANINGS[v]).map((v) => ({ value: v, meaning: REL_MEANINGS[v] })),
			hasNofollow: relValues.includes('nofollow'),
			hasSponsored: relValues.includes('sponsored'),
			hasUgc: relValues.includes('ugc'),
		};
	}

	/**
	 * Parse URL and extract tracking parameters - ENHANCED
	 * @param {string} url - URL to parse
	 * @param {HTMLAnchorElement} linkElement - Optional link element for rel analysis
	 * @returns {Object} Parsed UTM data
	 */
	function parse(url, linkElement = null) {
		try {
			const urlObj = new URL(url, window.location.origin);
			const params = urlObj.searchParams;
			const result = {
				hasTracking: false,
				parameters: [],
				categories: {},
				affiliate: detectAffiliate(url),
				rel: linkElement ? analyzeRelAttribute(linkElement) : null,
			};

			params.forEach((value, key) => {
				const keyLower = key.toLowerCase();
				const definition = PARAM_DEFINITIONS[keyLower];

				if (definition) {
					result.hasTracking = true;
					const param = {
						key: key,
						value: value,
						name: definition.name,
						meaning: definition.meaning,
						category: definition.category,
					};
					result.parameters.push(param);

					// Group by category
					if (!result.categories[definition.category]) {
						result.categories[definition.category] = [];
					}
					result.categories[definition.category].push(param);
				}
			});

			return result;
		} catch (e) {
			return { hasTracking: false, parameters: [], categories: {}, affiliate: null, rel: null };
		}
	}

	/**
	 * Check if URL has any tracking parameters
	 * @param {string} url - URL to check
	 * @returns {boolean}
	 */
	function hasTrackingParams(url) {
		try {
			const urlObj = new URL(url, window.location.origin);
			for (const key of urlObj.searchParams.keys()) {
				if (PARAM_DEFINITIONS[key.toLowerCase()]) {
					return true;
				}
			}
			return false;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Get all tracking parameters from current page - ENHANCED
	 * @returns {Array} All detected tracking links
	 */
	function scanPage() {
		const links = document.querySelectorAll('a[href]');
		const trackingLinks = [];

		links.forEach((link) => {
			const parsed = parse(link.href, link);
			if (parsed.hasTracking || parsed.affiliate) {
				trackingLinks.push({
					element: link,
					href: link.href,
					text: link.textContent.trim().substring(0, 50),
					...parsed,
				});
			}
		});

		return trackingLinks;
	}

	return {
		parse,
		hasTrackingParams,
		scanPage,
		detectAffiliate,
		analyzeRelAttribute,
		PARAM_DEFINITIONS,
		REL_MEANINGS,
	};
})();

// Expose to global scope for content script
window.UTMParser = UTMParser;
