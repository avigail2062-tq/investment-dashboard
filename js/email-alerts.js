/**
 * email-alerts.js - Email Alert Service
 * Investment Dashboard - Hebrew RTL, Dark Theme
 *
 * Dynamically loads the EmailJS SDK from CDN and provides methods
 * to send individual alert emails and daily summary digests.
 * Configuration is persisted in localStorage.
 */

class EmailAlertService {
  constructor() {
    /** @type {boolean} Whether the EmailJS SDK has been loaded */
    this._sdkLoaded = false;

    /** @type {boolean} Whether the service is initialized */
    this._initialized = false;

    /** @type {string|null} EmailJS service ID */
    this._serviceId = null;

    /** @type {string|null} EmailJS template ID */
    this._templateId = null;

    /** @type {string|null} EmailJS public key */
    this._publicKey = null;

    /** @type {string} CDN URL for EmailJS SDK */
    this._sdkUrl = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

    /** @type {object[]} Queue of unsent alerts if SDK not ready */
    this._pendingQueue = [];

    // Load any saved config from localStorage
    this._loadConfig();
  }

  // ---------------------------------------------------------------------------
  // SDK Loading
  // ---------------------------------------------------------------------------

  /**
   * Dynamically load the EmailJS SDK from CDN
   * @returns {Promise<void>}
   */
  async _loadSDK() {
    if (this._sdkLoaded) return;

    // Check if already loaded globally
    if (typeof emailjs !== 'undefined') {
      this._sdkLoaded = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this._sdkUrl;
      script.type = 'text/javascript';
      script.async = true;

      script.onload = () => {
        this._sdkLoaded = true;
        console.log('[EmailAlertService] EmailJS SDK loaded successfully');
        resolve();
      };

      script.onerror = () => {
        console.error('[EmailAlertService] Failed to load EmailJS SDK');
        reject(new Error('Failed to load EmailJS SDK from CDN'));
      };

      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  /**
   * Initialize the email alert service
   * @param {string} serviceId - EmailJS service ID
   * @param {string} templateId - EmailJS template ID
   * @param {string} publicKey - EmailJS public key
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async init(serviceId, templateId, publicKey) {
    this._serviceId = serviceId || this._serviceId;
    this._templateId = templateId || this._templateId;
    this._publicKey = publicKey || this._publicKey;

    if (!this._serviceId || !this._templateId || !this._publicKey) {
      console.warn('[EmailAlertService] Missing EmailJS configuration. Emails will not be sent.');
      return false;
    }

    // Check for placeholder values
    if (this._serviceId.startsWith('YOUR_') ||
        this._templateId.startsWith('YOUR_') ||
        this._publicKey.startsWith('YOUR_')) {
      console.warn('[EmailAlertService] EmailJS still has placeholder values. Configure in settings.');
      return false;
    }

    try {
      await this._loadSDK();

      // Initialize EmailJS with the public key
      emailjs.init(this._publicKey);

      this._initialized = true;
      this._saveConfig();

      console.log('[EmailAlertService] Initialized successfully');

      // Process any pending queue
      await this._processPendingQueue();

      return true;
    } catch (err) {
      console.error('[EmailAlertService] Initialization failed:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Configuration Persistence
  // ---------------------------------------------------------------------------

  /**
   * Load configuration from localStorage
   */
  _loadConfig() {
    try {
      this._serviceId = localStorage.getItem('emailjs_service_id') || null;
      this._templateId = localStorage.getItem('emailjs_template_id') || null;
      this._publicKey = localStorage.getItem('emailjs_public_key') || null;
    } catch (err) {
      console.warn('[EmailAlertService] Could not read localStorage:', err);
    }
  }

  /**
   * Save current configuration to localStorage
   */
  _saveConfig() {
    try {
      if (this._serviceId) localStorage.setItem('emailjs_service_id', this._serviceId);
      if (this._templateId) localStorage.setItem('emailjs_template_id', this._templateId);
      if (this._publicKey) localStorage.setItem('emailjs_public_key', this._publicKey);
    } catch (err) {
      console.warn('[EmailAlertService] Could not write to localStorage:', err);
    }
  }

  /**
   * Update and persist configuration
   * @param {object} config - Configuration object
   * @param {string} [config.serviceId] - EmailJS service ID
   * @param {string} [config.templateId] - EmailJS template ID
   * @param {string} [config.publicKey] - EmailJS public key
   * @param {string} [config.recipientEmail] - Default recipient email
   * @param {boolean} [config.enabled] - Whether email alerts are enabled
   */
  updateConfig(config) {
    if (config.serviceId) this._serviceId = config.serviceId;
    if (config.templateId) this._templateId = config.templateId;
    if (config.publicKey) this._publicKey = config.publicKey;

    if (config.recipientEmail !== undefined) {
      localStorage.setItem('emailjs_recipient', config.recipientEmail);
    }
    if (config.enabled !== undefined) {
      localStorage.setItem('emailjs_enabled', String(config.enabled));
    }

    this._saveConfig();
  }

  /**
   * Get current configuration (safe, no secrets exposed)
   * @returns {object} Current configuration status
   */
  getConfig() {
    return {
      serviceId: this._serviceId ? '***' + this._serviceId.slice(-4) : null,
      templateId: this._templateId ? '***' + this._templateId.slice(-4) : null,
      hasPublicKey: !!this._publicKey,
      recipientEmail: localStorage.getItem('emailjs_recipient') || '',
      enabled: localStorage.getItem('emailjs_enabled') === 'true',
      initialized: this._initialized,
      sdkLoaded: this._sdkLoaded
    };
  }

  // ---------------------------------------------------------------------------
  // Send Alert Email
  // ---------------------------------------------------------------------------

  /**
   * Send an email for a single alert
   * @param {object} alert - Alert object with type, symbol, message, timestamp
   * @param {string} recipientEmail - Email address to send to
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendAlertEmail(alert, recipientEmail) {
    const recipient = recipientEmail || localStorage.getItem('emailjs_recipient');

    if (!recipient) {
      return { success: false, message: 'לא הוגדר כתובת דוא"ל' };
    }

    if (!this._initialized) {
      // Queue for later
      this._pendingQueue.push({ type: 'single', alert, recipientEmail: recipient });
      console.warn('[EmailAlertService] Not initialized. Alert queued.');
      return { success: false, message: 'שירות הדוא"ל לא אותחל. ההתראה נשמרה בתור.' };
    }

    const alertType = PORTFOLIO_CONFIG.alerts.types[alert.type] || {
      label: alert.type,
      icon: '',
      severity: 'info'
    };

    const templateParams = {
      to_email: recipient,
      subject: `${alertType.icon} התראת תיק: ${alertType.label} - ${alert.symbol || ''}`,
      alert_type: alertType.label,
      alert_severity: this._getSeverityLabel(alertType.severity),
      stock_symbol: alert.symbol || '',
      alert_message: alert.message || '',
      alert_time: alert.timestamp
        ? Utils.formatDate(alert.timestamp)
        : Utils.formatDate(new Date()),
      dashboard_name: LABELS.dashboard,
      portfolio_name: LABELS.portfolio
    };

    try {
      const response = await emailjs.send(
        this._serviceId,
        this._templateId,
        templateParams
      );

      console.log('[EmailAlertService] Alert email sent:', response.status);
      return { success: true, message: 'התראה נשלחה בהצלחה' };
    } catch (err) {
      console.error('[EmailAlertService] Failed to send alert email:', err);
      return { success: false, message: `שגיאה בשליחת דוא"ל: ${err.text || err.message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Send Daily Summary Email
  // ---------------------------------------------------------------------------

  /**
   * Send a daily summary email containing all alerts
   * Consolidates multiple alerts into a single email to save EmailJS quota
   * @param {object[]} alerts - Array of alert objects
   * @param {string} recipientEmail - Email address to send to
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendDailySummary(alerts, recipientEmail) {
    const recipient = recipientEmail || localStorage.getItem('emailjs_recipient');

    if (!recipient) {
      return { success: false, message: 'לא הוגדר כתובת דוא"ל' };
    }

    if (!this._initialized) {
      return { success: false, message: 'שירות הדוא"ל לא אותחל' };
    }

    if (!alerts || alerts.length === 0) {
      return { success: false, message: 'אין התראות לשליחה' };
    }

    // Build summary content
    const summaryLines = alerts.map((alert, index) => {
      const alertType = PORTFOLIO_CONFIG.alerts.types[alert.type] || {
        label: alert.type,
        icon: '',
        severity: 'info'
      };
      const time = alert.timestamp
        ? Utils.formatDate(alert.timestamp, { includeDate: false })
        : '';

      return `${index + 1}. ${alertType.icon} [${alertType.label}] ${alert.symbol || ''}: ${alert.message || ''} (${time})`;
    }).join('\n');

    // Build portfolio summary if data available
    let portfolioSummary = '';
    if (window.dataLoader && window.dataLoader.marketData) {
      const totalValue = window.dataLoader.getPortfolioValue();
      const totalReturn = window.dataLoader.getPortfolioReturn();
      const sign = totalReturn.amount >= 0 ? '+' : '';

      portfolioSummary = [
        `\n--- סיכום תיק ---`,
        `שווי כולל: ${Utils.formatCurrency(totalValue)}`,
        `תשואה כוללת: ${sign}${Utils.formatCurrency(totalReturn.amount)} (${sign}${totalReturn.percent.toFixed(2)}%)`
      ].join('\n');
    }

    const now = new Date();
    const dateStr = Utils.formatDate(now, { includeTime: false });

    const templateParams = {
      to_email: recipient,
      subject: `סיכום יומי - ${LABELS.dashboard} - ${dateStr}`,
      alert_type: 'סיכום יומי',
      alert_severity: `${alerts.length} התראות`,
      stock_symbol: '',
      alert_message: `סיכום התראות ל-${dateStr}:\n\n${summaryLines}${portfolioSummary}`,
      alert_time: Utils.formatDate(now),
      dashboard_name: LABELS.dashboard,
      portfolio_name: LABELS.portfolio
    };

    try {
      const response = await emailjs.send(
        this._serviceId,
        this._templateId,
        templateParams
      );

      console.log('[EmailAlertService] Daily summary sent:', response.status);
      return {
        success: true,
        message: `סיכום יומי עם ${alerts.length} התראות נשלח בהצלחה`
      };
    } catch (err) {
      console.error('[EmailAlertService] Failed to send daily summary:', err);
      return {
        success: false,
        message: `שגיאה בשליחת סיכום יומי: ${err.text || err.message}`
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Pending Queue
  // ---------------------------------------------------------------------------

  /**
   * Process any alerts that were queued before initialization
   * @returns {Promise<void>}
   */
  async _processPendingQueue() {
    if (this._pendingQueue.length === 0) return;

    console.log(`[EmailAlertService] Processing ${this._pendingQueue.length} pending alerts`);

    // Gather all single alerts into one summary to save quota
    const pendingAlerts = this._pendingQueue
      .filter(item => item.type === 'single')
      .map(item => item.alert);

    const recipient = this._pendingQueue[0]?.recipientEmail ||
                      localStorage.getItem('emailjs_recipient');

    // Clear the queue
    this._pendingQueue = [];

    if (pendingAlerts.length > 0 && recipient) {
      if (pendingAlerts.length === 1) {
        await this.sendAlertEmail(pendingAlerts[0], recipient);
      } else {
        await this.sendDailySummary(pendingAlerts, recipient);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Test Email
  // ---------------------------------------------------------------------------

  /**
   * Send a test email to verify configuration
   * @param {string} recipientEmail - Email address to test
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async sendTestEmail(recipientEmail) {
    const testAlert = {
      id: 'test_' + Date.now(),
      type: 'PORTFOLIO_ALERT',
      symbol: '',
      message: 'זוהי הודעת בדיקה מלוח הבקרה. אם קיבלת הודעה זו, ההגדרות תקינות.',
      timestamp: new Date().toISOString()
    };

    return this.sendAlertEmail(testAlert, recipientEmail);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Get Hebrew label for severity level
   * @param {string} severity - Severity key
   * @returns {string} Hebrew severity label
   */
  _getSeverityLabel(severity) {
    const labels = {
      critical: 'קריטי',
      warning: 'אזהרה',
      info: 'מידע',
      success: 'הצלחה'
    };
    return labels[severity] || severity;
  }

  /**
   * Check if the service is ready to send emails
   * @returns {boolean}
   */
  isReady() {
    return this._initialized && this._sdkLoaded;
  }

  /**
   * Check if email alerts are enabled by the user
   * @returns {boolean}
   */
  isEnabled() {
    return localStorage.getItem('emailjs_enabled') === 'true';
  }

  /**
   * Destroy the service and clean up
   */
  destroy() {
    this._pendingQueue = [];
    this._initialized = false;
    console.log('[EmailAlertService] Service destroyed');
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------
window.emailAlertService = new EmailAlertService();
