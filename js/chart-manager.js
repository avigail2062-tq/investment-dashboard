/**
 * chart-manager.js - Chart.js Chart Management
 * Investment Dashboard - Hebrew RTL, Dark Theme
 *
 * Creates and manages three Chart.js charts:
 * 1. Sector doughnut chart
 * 2. Stock performance horizontal bar chart
 * 3. Timeline bar chart
 *
 * Also handles KPI card updates, stock card updates,
 * sparkline mini-charts, and portfolio total value.
 *
 * Requires: Chart.js 4.4.1 + ChartDataLabels plugin loaded via CDN
 */

class ChartManager {
  constructor() {
    /** @type {Chart|null} Sector allocation doughnut chart */
    this.sectorChart = null;

    /** @type {Chart|null} Stock performance horizontal bar chart */
    this.stockChart = null;

    /** @type {Chart|null} Timeline bar chart */
    this.timelineChart = null;

    /** @type {Object.<string, Chart>} Sparkline chart instances keyed by symbol */
    this.sparklines = {};

    /** @type {boolean} Whether charts have been initialized */
    this.initialized = false;

    /** Default Chart.js configuration for dark theme */
    this._defaultFontConfig = {
      family: "'Heebo', sans-serif",
      size: 12,
      color: '#ffffff'
    };
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize all charts. Call once after DOM is ready.
   * Registers the ChartDataLabels plugin globally if available.
   */
  init() {
    if (this.initialized) return;

    // Set global Chart.js defaults for dark theme + Hebrew
    this._setGlobalDefaults();

    // Create charts
    this._createSectorChart();
    this._createStockChart();
    this._createTimelineChart();

    this.initialized = true;
    console.log('[ChartManager] All charts initialized');
  }

  /**
   * Set global Chart.js defaults for dark theme and Heebo font
   */
  _setGlobalDefaults() {
    if (typeof Chart === 'undefined') {
      console.error('[ChartManager] Chart.js is not loaded');
      return;
    }

    Chart.defaults.font.family = this._defaultFontConfig.family;
    Chart.defaults.font.size = this._defaultFontConfig.size;
    Chart.defaults.color = this._defaultFontConfig.color;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation = {
      duration: PORTFOLIO_CONFIG.ui.chartAnimationDuration
    };

    // Register ChartDataLabels plugin if available
    if (typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
      // Disable globally, enable per-chart
      Chart.defaults.plugins.datalabels = { display: false };
    }
  }

  // ---------------------------------------------------------------------------
  // Sector Doughnut Chart
  // ---------------------------------------------------------------------------

  _createSectorChart() {
    const canvas = document.getElementById('sectorChart');
    if (!canvas) {
      console.warn('[ChartManager] #sectorChart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const sectorNames = Object.keys(PORTFOLIO_CONFIG.sectors);
    const sectorColors = sectorNames.map(name => PORTFOLIO_CONFIG.sectors[name].color);

    // Initial placeholder data (equal slices)
    const initialData = sectorNames.map(() => 1);

    this.sectorChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sectorNames,
        datasets: [{
          data: initialData,
          backgroundColor: sectorColors,
          borderColor: 'rgba(15, 23, 42, 0.8)',
          borderWidth: 3,
          hoverBorderColor: '#ffffff',
          hoverBorderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        cutout: '65%',
        layout: {
          padding: 10
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            rtl: true,
            textDirection: 'rtl',
            labels: {
              color: '#ffffff',
              font: {
                family: "'Heebo', sans-serif",
                size: 12
              },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              generateLabels: (chart) => {
                const data = chart.data;
                if (!data.labels.length) return [];
                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return {
                    text: `${label} (${pct}%)`,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    strokeStyle: 'transparent',
                    lineWidth: 0,
                    hidden: false,
                    index: i,
                    pointStyle: 'circle'
                  };
                });
              }
            }
          },
          tooltip: {
            rtl: true,
            textDirection: 'rtl',
            backgroundColor: CHART_COLORS.tooltipBg,
            borderColor: CHART_COLORS.tooltipBorder,
            borderWidth: 1,
            titleFont: { family: "'Heebo', sans-serif", size: 14, weight: 'bold' },
            bodyFont: { family: "'Heebo', sans-serif", size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const value = ctx.parsed;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${ctx.label}: ${Utils.formatCurrency(value, true)} (${pct}%)`;
              }
            }
          },
          datalabels: {
            display: false
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Stock Performance Horizontal Bar Chart
  // ---------------------------------------------------------------------------

  _createStockChart() {
    const canvas = document.getElementById('stockChart');
    if (!canvas) {
      console.warn('[ChartManager] #stockChart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    const symbols = Object.keys(PORTFOLIO_CONFIG.stocks);
    const stockLabels = symbols.map(s => `${PORTFOLIO_CONFIG.stocks[s].nameHe} (${s})`);
    const stockColors = symbols.map(s => PORTFOLIO_CONFIG.stocks[s].color);

    // Initial placeholder data
    const initialData = symbols.map(() => 0);

    this.stockChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: stockLabels,
        datasets: [{
          label: LABELS.dailyChange,
          data: initialData,
          backgroundColor: stockColors.map(c => c + 'CC'),
          borderColor: stockColors,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }]
      },
      options: {
        indexAxis: 'y',
        layout: {
          padding: { left: 10, right: 20 }
        },
        scales: {
          x: {
            grid: {
              color: CHART_COLORS.gridColor,
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'Heebo', sans-serif", size: 11 },
              callback: (value) => value.toFixed(2) + '%'
            },
            title: {
              display: true,
              text: 'שינוי יומי (%)',
              color: '#94a3b8',
              font: { family: "'Heebo', sans-serif", size: 12 }
            }
          },
          y: {
            position: 'right',
            grid: {
              display: false
            },
            ticks: {
              color: '#ffffff',
              font: { family: "'Heebo', sans-serif", size: 11 },
              mirror: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            rtl: true,
            textDirection: 'rtl',
            backgroundColor: CHART_COLORS.tooltipBg,
            borderColor: CHART_COLORS.tooltipBorder,
            borderWidth: 1,
            titleFont: { family: "'Heebo', sans-serif", size: 14, weight: 'bold' },
            bodyFont: { family: "'Heebo', sans-serif", size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return symbols[idx];
              },
              label: (ctx) => {
                const idx = ctx.dataIndex;
                const symbol = symbols[idx];
                const pct = ctx.parsed.x;
                const sign = pct >= 0 ? '+' : '';
                return ` ${LABELS.dailyChange}: ${sign}${pct.toFixed(2)}%`;
              }
            }
          },
          datalabels: {
            display: true,
            anchor: (ctx) => ctx.dataset.data[ctx.dataIndex] >= 0 ? 'end' : 'start',
            align: (ctx) => ctx.dataset.data[ctx.dataIndex] >= 0 ? 'end' : 'start',
            color: '#e2e8f0',
            font: { family: "'Heebo', sans-serif", size: 11, weight: 'bold' },
            formatter: (value) => {
              const sign = value >= 0 ? '+' : '';
              return `${sign}${value.toFixed(2)}%`;
            },
            padding: 4
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Timeline Bar Chart
  // ---------------------------------------------------------------------------

  _createTimelineChart() {
    const canvas = document.getElementById('timelineChart');
    if (!canvas) {
      console.warn('[ChartManager] #timelineChart canvas not found');
      return;
    }

    const ctx = canvas.getContext('2d');

    // Initial placeholder with last 7 days
    const today = new Date();
    const labels = [];
    const initialData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }));
      initialData.push(0);
    }

    this.timelineChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: LABELS.dailyChange,
          data: initialData,
          backgroundColor: initialData.map(v =>
            v >= 0 ? CHART_COLORS.positive + '99' : CHART_COLORS.negative + '99'
          ),
          borderColor: initialData.map(v =>
            v >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative
          ),
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6,
          categoryPercentage: 0.7
        }]
      },
      options: {
        layout: {
          padding: { top: 10, bottom: 5 }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'Heebo', sans-serif", size: 11 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7
            }
          },
          y: {
            position: 'right',
            grid: {
              color: CHART_COLORS.gridColor,
              drawBorder: false
            },
            ticks: {
              color: '#94a3b8',
              font: { family: "'Heebo', sans-serif", size: 11 },
              callback: (value) => Utils.formatCurrency(value, true)
            },
            title: {
              display: true,
              text: 'שינוי יומי ($)',
              color: '#94a3b8',
              font: { family: "'Heebo', sans-serif", size: 12 }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            rtl: true,
            textDirection: 'rtl',
            backgroundColor: CHART_COLORS.tooltipBg,
            borderColor: CHART_COLORS.tooltipBorder,
            borderWidth: 1,
            titleFont: { family: "'Heebo', sans-serif", size: 14, weight: 'bold' },
            bodyFont: { family: "'Heebo', sans-serif", size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                const sign = val >= 0 ? '+' : '';
                return ` ${LABELS.dailyChange}: ${sign}${Utils.formatCurrency(val)}`;
              }
            }
          },
          datalabels: {
            display: false
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Update from Data
  // ---------------------------------------------------------------------------

  /**
   * Main update method: refreshes all UI elements from market data
   * @param {object} marketData - The market data object from DataLoader
   */
  updateFromData(marketData) {
    if (!marketData || !marketData.stocks) {
      console.warn('[ChartManager] No valid market data to update from');
      return;
    }

    this._updateKPICards(marketData);
    this._updateStockCards(marketData);
    this._updateSectorChart(marketData);
    this._updateStockChart(marketData);
    this._updateTimelineChart(marketData);
    this._updateLastUpdated();
    this._updatePortfolioTotal(marketData);
    this._updateSparklines(marketData);

    console.log('[ChartManager] All UI updated from market data');
  }

  // ---------------------------------------------------------------------------
  // KPI Cards
  // ---------------------------------------------------------------------------

  _updateKPICards(marketData) {
    // Total portfolio value
    const totalValue = this._calculatePortfolioValue(marketData);
    this._setElementText('kpi-total-value', Utils.formatCurrency(totalValue, true));

    // Daily change
    const dailyChange = this._calculateDailyChange(marketData);
    const dailyEl = document.getElementById('kpi-daily-change');
    if (dailyEl) {
      dailyEl.textContent = `${Utils.getChangeSign(dailyChange.amount)}${Utils.formatCurrency(dailyChange.amount)} (${Utils.formatPercent(dailyChange.percent)})`;
      dailyEl.className = `kpi-value ${Utils.getChangeClass(dailyChange.amount)}`;
    }

    // Total return
    const totalReturn = this._calculateTotalReturn(marketData);
    const returnEl = document.getElementById('kpi-total-return');
    if (returnEl) {
      returnEl.textContent = `${Utils.getChangeSign(totalReturn.amount)}${Utils.formatCurrency(totalReturn.amount)} (${Utils.formatPercent(totalReturn.percent)})`;
      returnEl.className = `kpi-value ${Utils.getChangeClass(totalReturn.amount)}`;
    }

    // Best performer
    const best = this._findBestPerformer(marketData);
    if (best) {
      this._setElementText('kpi-best-symbol', best.symbol);
      const bestValEl = document.getElementById('kpi-best-value');
      if (bestValEl) {
        bestValEl.textContent = `+${best.changePercent.toFixed(2)}%`;
        bestValEl.className = 'kpi-highlight positive';
      }
    }

    // Worst performer
    const worst = this._findWorstPerformer(marketData);
    if (worst) {
      this._setElementText('kpi-worst-symbol', worst.symbol);
      const worstValEl = document.getElementById('kpi-worst-value');
      if (worstValEl) {
        worstValEl.textContent = `${worst.changePercent.toFixed(2)}%`;
        worstValEl.className = 'kpi-highlight negative';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stock Cards
  // ---------------------------------------------------------------------------

  _updateStockCards(marketData) {
    for (const [symbol, config] of Object.entries(PORTFOLIO_CONFIG.stocks)) {
      const stockData = marketData.stocks[symbol];
      if (!stockData) continue;

      // Find live data container by data-ticker attribute
      const liveDataEl = document.querySelector(`.stock-live-data[data-ticker="${symbol}"]`);
      if (liveDataEl) {
        const priceEl = liveDataEl.querySelector('.live-price');
        const changeEl = liveDataEl.querySelector('.live-change');

        if (priceEl) {
          priceEl.textContent = Utils.formatCurrency(stockData.price);
        }

        if (changeEl) {
          const change = stockData.change || 0;
          const changePct = stockData.changePercent || 0;
          const sign = change >= 0 ? '+' : '';
          changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
          changeEl.className = `live-change ${change >= 0 ? 'positive' : 'negative'}`;
        }
      }

      // Also try ID-based elements (if they exist on the page)
      this._setElementText(`stock-price-${symbol}`, Utils.formatCurrency(stockData.price));
      this._setElementText(`stock-value-${symbol}`, Utils.formatCurrency(stockData.price * config.shares));

      if (stockData.volume) {
        this._setElementText(`stock-volume-${symbol}`, Utils.formatNumber(stockData.volume));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Chart Updates
  // ---------------------------------------------------------------------------

  _updateSectorChart(marketData) {
    if (!this.sectorChart) return;

    const sectorValues = {};
    for (const [sectorName, sectorConfig] of Object.entries(PORTFOLIO_CONFIG.sectors)) {
      let sectorTotal = 0;
      for (const symbol of sectorConfig.stocks) {
        const stockData = marketData.stocks[symbol];
        if (stockData && stockData.price) {
          sectorTotal += stockData.price * PORTFOLIO_CONFIG.stocks[symbol].shares;
        }
      }
      sectorValues[sectorName] = sectorTotal;
    }

    const sectorNames = Object.keys(PORTFOLIO_CONFIG.sectors);
    const newData = sectorNames.map(name => sectorValues[name] || 0);

    this.sectorChart.data.datasets[0].data = newData;
    this.sectorChart.update('none');
  }

  _updateStockChart(marketData) {
    if (!this.stockChart) return;

    const symbols = Object.keys(PORTFOLIO_CONFIG.stocks);
    const newData = symbols.map(symbol => {
      const stockData = marketData.stocks[symbol];
      return stockData ? (stockData.changePercent || 0) : 0;
    });

    // Update bar colors based on positive/negative
    const stockColors = symbols.map(s => PORTFOLIO_CONFIG.stocks[s].color);
    const bgColors = newData.map((val, i) => {
      if (val >= 0) return stockColors[i] + 'CC';
      return CHART_COLORS.negative + '99';
    });
    const borderColors = newData.map((val, i) => {
      if (val >= 0) return stockColors[i];
      return CHART_COLORS.negative;
    });

    this.stockChart.data.datasets[0].data = newData;
    this.stockChart.data.datasets[0].backgroundColor = bgColors;
    this.stockChart.data.datasets[0].borderColor = borderColors;
    this.stockChart.update('none');
  }

  _updateTimelineChart(marketData) {
    if (!this.timelineChart) return;

    // Use timeline data if available
    if (marketData.timeline && Array.isArray(marketData.timeline)) {
      const labels = marketData.timeline.map(entry => {
        const d = new Date(entry.date);
        return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
      });
      const data = marketData.timeline.map(entry => entry.portfolioChange || 0);

      this.timelineChart.data.labels = labels;
      this.timelineChart.data.datasets[0].data = data;
      this.timelineChart.data.datasets[0].backgroundColor = data.map(v =>
        v >= 0 ? CHART_COLORS.positive + '99' : CHART_COLORS.negative + '99'
      );
      this.timelineChart.data.datasets[0].borderColor = data.map(v =>
        v >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative
      );
    }

    this.timelineChart.update('none');
  }

  // ---------------------------------------------------------------------------
  // Sparklines
  // ---------------------------------------------------------------------------

  /**
   * Create or update sparkline mini-charts for stock cards
   * @param {object} marketData - Market data with history arrays
   */
  _updateSparklines(marketData) {
    for (const [symbol, config] of Object.entries(PORTFOLIO_CONFIG.stocks)) {
      // Try ID first, then query selector by data-ticker
      let canvas = document.getElementById(`sparkline-${symbol}`);
      if (!canvas) {
        const container = document.querySelector(`.sparkline-container[data-ticker="${symbol}"]`);
        canvas = container ? container.querySelector('canvas') : null;
      }
      if (!canvas) continue;

      const stockData = marketData.stocks[symbol];
      if (!stockData || !stockData.history || !Array.isArray(stockData.history)) continue;

      // Take last N days for sparkline
      const days = PORTFOLIO_CONFIG.ui.sparklineDays;
      const history = stockData.history.slice(-days);
      if (history.length < 2) continue;

      const prices = history.map(h => h.close || h.price || 0);
      const trend = prices[prices.length - 1] >= prices[0] ? 'up' : 'down';
      const lineColor = trend === 'up' ? CHART_COLORS.positive : CHART_COLORS.negative;

      // Destroy existing sparkline chart if it exists
      if (this.sparklines[symbol]) {
        this.sparklines[symbol].destroy();
      }

      const ctx = canvas.getContext('2d');

      this.sparklines[symbol] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: prices.map((_, i) => i),
          datasets: [{
            data: prices,
            borderColor: lineColor,
            borderWidth: 1.5,
            fill: {
              target: 'origin',
              above: lineColor + '20',
              below: lineColor + '20'
            },
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          layout: { padding: 0 },
          scales: {
            x: { display: false },
            y: { display: false }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            datalabels: { display: false }
          },
          elements: {
            line: {
              borderCapStyle: 'round',
              borderJoinStyle: 'round'
            }
          }
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Portfolio Calculations
  // ---------------------------------------------------------------------------

  _calculatePortfolioValue(marketData) {
    let total = 0;
    for (const [symbol, config] of Object.entries(PORTFOLIO_CONFIG.stocks)) {
      const stockData = marketData.stocks[symbol];
      if (stockData && stockData.price) {
        total += stockData.price * config.shares;
      }
    }
    return total;
  }

  _calculateDailyChange(marketData) {
    let changeAmount = 0;
    let previousTotal = 0;

    for (const [symbol, config] of Object.entries(PORTFOLIO_CONFIG.stocks)) {
      const stockData = marketData.stocks[symbol];
      if (stockData) {
        const change = (stockData.change || 0) * config.shares;
        changeAmount += change;
        const prevPrice = (stockData.price || 0) - (stockData.change || 0);
        previousTotal += prevPrice * config.shares;
      }
    }

    const percent = previousTotal > 0 ? (changeAmount / previousTotal) * 100 : 0;
    return { amount: changeAmount, percent };
  }

  _calculateTotalReturn(marketData) {
    const currentValue = this._calculatePortfolioValue(marketData);
    let costBasis = 0;

    for (const config of Object.values(PORTFOLIO_CONFIG.stocks)) {
      costBasis += config.avgCost * config.shares;
    }

    const amount = currentValue - costBasis;
    const percent = costBasis > 0 ? (amount / costBasis) * 100 : 0;
    return { amount, percent };
  }

  _findBestPerformer(marketData) {
    let best = null;
    for (const [symbol, stockData] of Object.entries(marketData.stocks)) {
      if (!PORTFOLIO_CONFIG.stocks[symbol]) continue;
      const pct = stockData.changePercent || 0;
      if (!best || pct > best.changePercent) {
        best = { symbol, changePercent: pct };
      }
    }
    return best;
  }

  _findWorstPerformer(marketData) {
    let worst = null;
    for (const [symbol, stockData] of Object.entries(marketData.stocks)) {
      if (!PORTFOLIO_CONFIG.stocks[symbol]) continue;
      const pct = stockData.changePercent || 0;
      if (!worst || pct < worst.changePercent) {
        worst = { symbol, changePercent: pct };
      }
    }
    return worst;
  }

  // ---------------------------------------------------------------------------
  // UI Helpers
  // ---------------------------------------------------------------------------

  _updateLastUpdated() {
    const el = document.getElementById('lastUpdated') || document.getElementById('last-updated');
    if (el) {
      const now = new Date();
      el.textContent = `${LABELS.lastUpdated}: ${Utils.formatDate(now)}`;
    }
  }

  _updatePortfolioTotal(marketData) {
    const total = this._calculatePortfolioValue(marketData);
    this._setElementText('portfolio-total', Utils.formatCurrency(total, true));
  }

  /**
   * Safely set text content of an element by ID
   * @param {string} id - Element ID
   * @param {string} text - Text content to set
   */
  _setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = text;
    }
  }

  // ---------------------------------------------------------------------------
  // Alerts UI
  // ---------------------------------------------------------------------------

  /**
   * Render alerts into the alerts container
   * @param {object} alertsData - Alerts data from DataLoader
   */
  updateAlerts(alertsData) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    if (!alertsData || !alertsData.alerts || alertsData.alerts.length === 0) {
      container.innerHTML = `<div class="no-alerts">${LABELS.noAlerts}</div>`;
      // Update badge
      this._setElementText('alerts-badge', '0');
      return;
    }

    const alerts = alertsData.alerts.filter(a => !a.dismissed);
    this._setElementText('alerts-badge', String(alerts.length));

    container.innerHTML = '';
    for (const alert of alerts) {
      const alertType = PORTFOLIO_CONFIG.alerts.types[alert.type] || {
        label: alert.type,
        icon: 'bell',
        severity: 'info'
      };

      const alertEl = Utils.createElement('div', {
        className: `alert-item alert-${alertType.severity}`,
        dataset: { alertId: alert.id }
      }, [
        Utils.createElement('div', { className: 'alert-icon' }, [alertType.icon]),
        Utils.createElement('div', { className: 'alert-content' }, [
          Utils.createElement('div', { className: 'alert-title' }, [
            `${alertType.label}: ${alert.symbol || ''}`
          ]),
          Utils.createElement('div', { className: 'alert-message' }, [alert.message || '']),
          Utils.createElement('div', { className: 'alert-time' }, [
            alert.timestamp ? Utils.formatDate(alert.timestamp, { relative: true }) : ''
          ])
        ])
      ]);

      container.appendChild(alertEl);
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Destroy all charts and clean up resources
   */
  destroy() {
    if (this.sectorChart) { this.sectorChart.destroy(); this.sectorChart = null; }
    if (this.stockChart) { this.stockChart.destroy(); this.stockChart = null; }
    if (this.timelineChart) { this.timelineChart.destroy(); this.timelineChart = null; }

    for (const [symbol, chart] of Object.entries(this.sparklines)) {
      chart.destroy();
    }
    this.sparklines = {};

    this.initialized = false;
    console.log('[ChartManager] All charts destroyed');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
window.chartManager = new ChartManager();
