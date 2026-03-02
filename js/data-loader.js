/**
 * data-loader.js - Data Loading & Event System
 * Investment Dashboard - Hebrew RTL, Dark Theme
 *
 * Fetches JSON data files from ./data/ with cache-busting,
 * provides an event system for reactive updates, and
 * supports auto-refresh on a configurable interval.
 */

class DataLoader {
  constructor() {
    /** @type {Object.<string, Function[]>} */
    this._listeners = {};

    /** @type {object|null} Current market data */
    this.marketData = null;

    /** @type {object|null} Current alerts data */
    this.alertsData = null;

    /** @type {object|null} Current short-term analysis data */
    this.shortTermData = null;

    /** @type {number|null} Auto-refresh interval ID */
    this._refreshInterval = null;

    /** @type {boolean} Whether initial load has completed */
    this.isLoaded = false;

    /** @type {boolean} Whether a load is currently in progress */
    this.isLoading = false;

    /** @type {Date|null} Timestamp of last successful data load */
    this.lastUpdated = null;

    /** @type {string|null} Last error message, if any */
    this.lastError = null;

    /** @type {string} Base path for data files */
    this.dataPath = PORTFOLIO_CONFIG.refresh.dataPath || './data/';

    /** @type {number} Refresh interval in milliseconds */
    this.refreshIntervalMs = PORTFOLIO_CONFIG.refresh.intervalMs || 5 * 60 * 1000;
  }

  // ---------------------------------------------------------------------------
  // Event System
  // ---------------------------------------------------------------------------

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this._listeners[event] = this._listeners[event].filter(fn => fn !== callback);
    };
  }

  /**
   * Emit an event to all registered listeners
   * @param {string} event - Event name
   * @param {*} data - Event data payload
   */
  emit(event, data) {
    const listeners = this._listeners[event];
    if (!listeners || listeners.length === 0) return;

    for (const callback of listeners) {
      try {
        callback(data);
      } catch (err) {
        console.error(`[DataLoader] Error in "${event}" listener:`, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single JSON file with cache-busting
   * @param {string} filename - Name of the JSON file (e.g., 'market-data.json')
   * @returns {Promise<object|null>} Parsed JSON or null on failure
   */
  async fetchFile(filename) {
    const url = `${this.dataPath}${filename}?t=${Date.now()}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`[DataLoader] Could not load ${filename}:`, err.message);
      return null;
    }
  }

  /**
   * Load all data files in parallel
   * Emits 'dataUpdated' and 'alertsUpdated' events on success
   * Falls back gracefully if files are not found
   * @returns {Promise<void>}
   */
  async loadAll() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.lastError = null;

    this.emit('loadingStart', null);

    try {
      const [marketResult, alertsResult, shortTermResult] = await Promise.allSettled([
        this.fetchFile('market-data.json'),
        this.fetchFile('alerts.json'),
        this.fetchFile('short-term.json')
      ]);

      const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
      const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : null;
      const shortTerm = shortTermResult.status === 'fulfilled' ? shortTermResult.value : null;

      let hasAnyData = false;

      // Update market data
      if (market) {
        this.marketData = market;
        hasAnyData = true;
        this.emit('dataUpdated', this.marketData);
      }

      // Update alerts data
      if (alerts) {
        this.alertsData = alerts;
        hasAnyData = true;
        this.emit('alertsUpdated', this.alertsData);
      }

      // Update short-term analysis data
      if (shortTerm) {
        this.shortTermData = shortTerm;
        hasAnyData = true;
        this.emit('shortTermUpdated', this.shortTermData);
      }

      if (hasAnyData) {
        this.lastUpdated = new Date();
        this.isLoaded = true;
        this.emit('loadComplete', {
          marketData: this.marketData,
          alertsData: this.alertsData,
          shortTermData: this.shortTermData,
          timestamp: this.lastUpdated
        });
      } else {
        // No data files found at all - show awaiting state
        this.lastError = 'awaiting';
        this.emit('awaitingData', {
          message: LABELS.awaitingUpdate
        });
      }
    } catch (err) {
      console.error('[DataLoader] Unexpected error during loadAll:', err);
      this.lastError = err.message;
      this.emit('loadError', {
        message: LABELS.error,
        error: err.message
      });
    } finally {
      this.isLoading = false;
      this.emit('loadingEnd', null);
    }
  }

  /**
   * Refresh only market data (lighter update)
   * @returns {Promise<void>}
   */
  async refreshMarketData() {
    const market = await this.fetchFile('market-data.json');
    if (market) {
      this.marketData = market;
      this.lastUpdated = new Date();
      this.emit('dataUpdated', this.marketData);
    }
  }

  /**
   * Refresh only alerts data
   * @returns {Promise<void>}
   */
  async refreshAlerts() {
    const alerts = await this.fetchFile('alerts.json');
    if (alerts) {
      this.alertsData = alerts;
      this.emit('alertsUpdated', this.alertsData);
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-Refresh
  // ---------------------------------------------------------------------------

  /**
   * Start auto-refreshing data at the configured interval
   * @param {number} [intervalMs] - Override interval in milliseconds
   */
  startAutoRefresh(intervalMs) {
    this.stopAutoRefresh();

    const interval = intervalMs || this.refreshIntervalMs;

    console.log(`[DataLoader] Auto-refresh started (every ${interval / 1000}s)`);

    this._refreshInterval = setInterval(() => {
      console.log('[DataLoader] Auto-refreshing data...');
      this.loadAll();
    }, interval);
  }

  /**
   * Stop auto-refreshing data
   */
  stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
      console.log('[DataLoader] Auto-refresh stopped');
    }
  }

  // ---------------------------------------------------------------------------
  // Convenience Getters
  // ---------------------------------------------------------------------------

  /**
   * Get the current price for a stock symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {number|null} Current price or null
   */
  getStockPrice(symbol) {
    if (!this.marketData || !this.marketData.stocks) return null;
    const stock = this.marketData.stocks[symbol];
    return stock ? stock.price : null;
  }

  /**
   * Get daily change for a stock symbol
   * @param {string} symbol - Stock ticker symbol
   * @returns {{ amount: number, percent: number }|null}
   */
  getStockChange(symbol) {
    if (!this.marketData || !this.marketData.stocks) return null;
    const stock = this.marketData.stocks[symbol];
    if (!stock) return null;
    return {
      amount: stock.change || 0,
      percent: stock.changePercent || 0
    };
  }

  /**
   * Get all active (unread/new) alerts
   * @returns {object[]} Array of alert objects
   */
  getActiveAlerts() {
    if (!this.alertsData || !Array.isArray(this.alertsData.alerts)) return [];
    return this.alertsData.alerts.filter(a => !a.dismissed);
  }

  /**
   * Get the total portfolio value based on current prices
   * @returns {number} Total portfolio value
   */
  getPortfolioValue() {
    if (!this.marketData || !this.marketData.stocks) return 0;

    let total = 0;
    for (const [symbol, config] of Object.entries(PORTFOLIO_CONFIG.stocks)) {
      const stockData = this.marketData.stocks[symbol];
      if (stockData && stockData.price) {
        total += stockData.price * config.shares;
      }
    }
    return total;
  }

  /**
   * Get the total cost basis of the portfolio
   * @returns {number} Total cost basis
   */
  getPortfolioCost() {
    let total = 0;
    for (const config of Object.values(PORTFOLIO_CONFIG.stocks)) {
      total += config.avgCost * config.shares;
    }
    return total;
  }

  /**
   * Get portfolio return (value - cost)
   * @returns {{ amount: number, percent: number }}
   */
  getPortfolioReturn() {
    const value = this.getPortfolioValue();
    const cost = this.getPortfolioCost();
    const amount = value - cost;
    const percent = cost > 0 ? (amount / cost) * 100 : 0;
    return { amount, percent };
  }

  /**
   * Get the formatted last-updated string
   * @returns {string} Hebrew-formatted date/time or awaiting message
   */
  getLastUpdatedFormatted() {
    if (!this.lastUpdated) return LABELS.awaitingUpdate;
    return Utils.formatDate(this.lastUpdated);
  }

  /**
   * Destroy the loader, clean up intervals and listeners
   */
  destroy() {
    this.stopAutoRefresh();
    this._listeners = {};
    this.marketData = null;
    this.alertsData = null;
    this.shortTermData = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
window.dataLoader = new DataLoader();
