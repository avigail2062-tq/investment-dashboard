/**
 * utils.js - Utility Functions
 * Investment Dashboard - Hebrew RTL, Dark Theme
 */

const Utils = {

  /**
   * Format a number as currency (USD)
   * @param {number} value - The numeric value
   * @param {boolean} [compact=false] - Use compact notation for large numbers
   * @returns {string} Formatted currency string
   */
  formatCurrency(value, compact = false) {
    if (value == null || isNaN(value)) return '$0.00';

    if (compact && Math.abs(value) >= 1_000_000) {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
      }).format(value);
    }

    if (compact && Math.abs(value) >= 1_000) {
      return new Intl.NumberFormat('he-IL', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
      }).format(value);
    }

    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  },

  /**
   * Format a number as a percentage
   * @param {number} value - The numeric value (e.g., 5.25 for 5.25%)
   * @param {boolean} [showSign=true] - Whether to show +/- sign
   * @returns {string} Formatted percentage string
   */
  formatPercent(value, showSign = true) {
    if (value == null || isNaN(value)) return '0.00%';

    const formatted = new Intl.NumberFormat('he-IL', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: showSign ? 'exceptZero' : 'auto'
    }).format(value / 100);

    return formatted;
  },

  /**
   * Format a number with locale-aware separators
   * @param {number} value - The numeric value
   * @param {number} [decimals=0] - Number of decimal places
   * @returns {string} Formatted number string
   */
  formatNumber(value, decimals = 0) {
    if (value == null || isNaN(value)) return '0';

    if (Math.abs(value) >= 1_000_000) {
      return new Intl.NumberFormat('he-IL', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
      }).format(value);
    }

    return new Intl.NumberFormat('he-IL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  },

  /**
   * Format a date/time string in Hebrew locale
   * @param {string|Date|number} dateInput - Date to format
   * @param {object} [options] - Formatting options
   * @param {boolean} [options.includeTime=true] - Include time in output
   * @param {boolean} [options.includeDate=true] - Include date in output
   * @param {boolean} [options.relative=false] - Use relative time (e.g., "לפני 5 דקות")
   * @returns {string} Formatted date string
   */
  formatDate(dateInput, options = {}) {
    const {
      includeTime = true,
      includeDate = true,
      relative = false
    } = options;

    if (!dateInput) return LABELS.awaitingUpdate;

    let date;
    try {
      date = dateInput instanceof Date ? dateInput : new Date(dateInput);
      if (isNaN(date.getTime())) return LABELS.awaitingUpdate;
    } catch {
      return LABELS.awaitingUpdate;
    }

    if (relative) {
      return Utils.getRelativeTime(date);
    }

    const parts = {};

    if (includeDate) {
      parts.day = '2-digit';
      parts.month = '2-digit';
      parts.year = 'numeric';
    }

    if (includeTime) {
      parts.hour = '2-digit';
      parts.minute = '2-digit';
      parts.second = '2-digit';
      parts.hour12 = false;
    }

    return new Intl.DateTimeFormat('he-IL', parts).format(date);
  },

  /**
   * Get relative time description in Hebrew
   * @param {Date} date - The date to compare against now
   * @returns {string} Relative time string in Hebrew
   */
  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'הרגע';
    if (diffMin < 2) return 'לפני דקה';
    if (diffMin < 60) return `לפני ${diffMin} דקות`;
    if (diffHour < 2) return 'לפני שעה';
    if (diffHour < 24) return `לפני ${diffHour} שעות`;
    if (diffDay < 2) return 'אתמול';
    if (diffDay < 7) return `לפני ${diffDay} ימים`;

    return Utils.formatDate(date, { relative: false });
  },

  /**
   * Get CSS class name based on value change direction
   * @param {number} value - The change value
   * @returns {'positive'|'negative'|'neutral'} CSS class name
   */
  getChangeClass(value) {
    if (value == null || isNaN(value) || value === 0) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
  },

  /**
   * Get the sign prefix for a change value
   * @param {number} value - The change value
   * @returns {string} '+', '-', or ''
   */
  getChangeSign(value) {
    if (value == null || isNaN(value) || value === 0) return '';
    return value > 0 ? '+' : '';
  },

  /**
   * Create a DOM element with attributes and children
   * @param {string} tag - HTML tag name
   * @param {object} [attrs={}] - Attributes to set on the element
   * @param {(string|Node)[]} [children=[]] - Child nodes or text content
   * @returns {HTMLElement} The created element
   */
  createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        for (const [dataKey, dataValue] of Object.entries(value)) {
          el.dataset[dataKey] = dataValue;
        }
      } else if (key.startsWith('on') && typeof value === 'function') {
        const event = key.slice(2).toLowerCase();
        el.addEventListener(event, value);
      } else if (key === 'innerHTML') {
        el.innerHTML = value;
      } else if (key === 'textContent') {
        el.textContent = value;
      } else {
        el.setAttribute(key, value);
      }
    }

    if (!Array.isArray(children)) {
      children = [children];
    }

    for (const child of children) {
      if (child == null) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(String(child)));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    }

    return el;
  },

  /**
   * Get a CSS variable value from the document root
   * @param {string} name - CSS variable name (e.g., '--accent-blue')
   * @returns {string} The CSS variable value, trimmed
   */
  getCSSVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  },

  /**
   * Debounce a function call
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Safely parse JSON with a fallback value
   * @param {string} jsonString - JSON string to parse
   * @param {*} fallback - Fallback value if parsing fails
   * @returns {*} Parsed value or fallback
   */
  safeParseJSON(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  },

  /**
   * Clamp a number between min and max
   * @param {number} value - The value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Calculate percentage change between two values
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {number} Percentage change
   */
  percentChange(current, previous) {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  },

  /**
   * Generate a unique ID
   * @param {string} [prefix='id'] - Prefix for the ID
   * @returns {string} Unique ID string
   */
  uniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  },

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength - 1) + '\u2026';
  }
};

// Expose globally
if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
