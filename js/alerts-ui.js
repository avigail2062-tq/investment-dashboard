/**
 * AlertsUI - Alert Banner System for Investment Dashboard
 * Renders color-coded alert banners from alerts.json data.
 * Hebrew RTL, dark theme.
 */
class AlertsUI {
    constructor() {
        this.alerts = [];
        this.previousAlertIds = this._loadPreviousAlertIds();
        this.dismissedAlerts = this._loadDismissedAlerts();
        this._pruneDismissedAlerts();
        this._injectStyles();
        this._createContainer();
        this._createNotificationBadge();
        this._loadAlerts();
    }

    /* ------------------------------------------------------------------ */
    /*  Severity configuration                                            */
    /* ------------------------------------------------------------------ */

    static get SEVERITY_MAP() {
        return {
            danger: {
                icon: '\uD83D\uDD34',
                bg: 'rgba(239, 68, 68, 0.10)',
                border: '#ef4444',
                label: '\u05E1\u05DB\u05E0\u05D4'
            },
            warning: {
                icon: '\uD83D\uDFE1',
                bg: 'rgba(245, 158, 11, 0.10)',
                border: '#f59e0b',
                label: '\u05D0\u05D6\u05D4\u05E8\u05D4'
            },
            info: {
                icon: '\uD83D\uDD35',
                bg: 'rgba(59, 130, 246, 0.10)',
                border: '#3b82f6',
                label: '\u05DE\u05D9\u05D3\u05E2'
            },
            opportunity: {
                icon: '\uD83D\uDFE2',
                bg: 'rgba(16, 185, 129, 0.10)',
                border: '#10b981',
                label: '\u05D4\u05D6\u05D3\u05DE\u05E0\u05D5\u05EA'
            }
        };
    }

    /* ------------------------------------------------------------------ */
    /*  LocalStorage helpers                                              */
    /* ------------------------------------------------------------------ */

    _loadDismissedAlerts() {
        try {
            const raw = localStorage.getItem('dismissedAlerts');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    _saveDismissedAlerts() {
        localStorage.setItem('dismissedAlerts', JSON.stringify(this.dismissedAlerts));
    }

    /**
     * Remove dismissed entries older than 7 days.
     * Each entry is stored as { id, dismissedAt }.
     */
    _pruneDismissedAlerts() {
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        this.dismissedAlerts = this.dismissedAlerts.filter(entry => {
            if (typeof entry === 'string') return false; // legacy format — discard
            return (now - entry.dismissedAt) < SEVEN_DAYS;
        });
        this._saveDismissedAlerts();
    }

    _isDismissed(alertId) {
        return this.dismissedAlerts.some(entry => entry.id === alertId);
    }

    _dismissAlert(alertId) {
        if (!this._isDismissed(alertId)) {
            this.dismissedAlerts.push({ id: alertId, dismissedAt: Date.now() });
            this._saveDismissedAlerts();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Track previously seen alert IDs (for new-alert sound)             */
    /* ------------------------------------------------------------------ */

    _loadPreviousAlertIds() {
        try {
            const raw = localStorage.getItem('previousAlertIds');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    _savePreviousAlertIds(ids) {
        localStorage.setItem('previousAlertIds', JSON.stringify(ids));
    }

    /* ------------------------------------------------------------------ */
    /*  DOM creation                                                      */
    /* ------------------------------------------------------------------ */

    _createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'alerts-container';

        const nav = document.querySelector('.nav');
        if (nav && nav.parentNode) {
            nav.parentNode.insertBefore(this.container, nav.nextSibling);
        } else {
            // Fallback: prepend to body
            document.body.prepend(this.container);
        }
    }

    _createNotificationBadge() {
        this.badge = document.createElement('span');
        this.badge.className = 'alerts-badge';
        this.badge.style.display = 'none';

        // Insert badge into header-meta (or header-content)
        const headerMeta = document.querySelector('.header-meta');
        if (headerMeta) {
            headerMeta.style.position = 'relative';
            headerMeta.prepend(this.badge);
        }
    }

    _updateBadge() {
        const visibleCount = this.alerts.filter(a => !this._isDismissed(a.id)).length;
        if (visibleCount > 0) {
            this.badge.textContent = visibleCount;
            this.badge.style.display = 'inline-flex';
        } else {
            this.badge.style.display = 'none';
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Data loading                                                      */
    /* ------------------------------------------------------------------ */

    async _loadAlerts() {
        try {
            const response = await fetch('./data/alerts.json');
            if (!response.ok) throw new Error('Failed to fetch alerts');
            const data = await response.json();
            this.alerts = data.activeAlerts || [];
            this._render();
            this._checkForNewAlerts();
        } catch (err) {
            console.warn('AlertsUI: \u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05D4\u05EA\u05E8\u05D0\u05D5\u05EA', err);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Sound for NEW alerts                                              */
    /* ------------------------------------------------------------------ */

    _checkForNewAlerts() {
        const currentIds = this.alerts.map(a => a.id);
        const newIds = currentIds.filter(id => !this.previousAlertIds.includes(id));

        if (newIds.length > 0) {
            this._playAlertSound();
        }

        this._savePreviousAlertIds(currentIds);
        this.previousAlertIds = currentIds;
    }

    _playAlertSound() {
        try {
            const audio = new Audio('./assets/sounds/alert.wav');
            audio.volume = 0.5;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Autoplay blocked by browser policy — silently ignore
                });
            }
        } catch {
            // Audio not available — silently ignore
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Rendering                                                         */
    /* ------------------------------------------------------------------ */

    _render() {
        this.container.innerHTML = '';

        this.alerts.forEach(alert => {
            if (this._isDismissed(alert.id)) return;

            const severity = AlertsUI.SEVERITY_MAP[alert.severity] || AlertsUI.SEVERITY_MAP.info;
            const banner = document.createElement('div');
            banner.className = 'alert-banner';
            banner.setAttribute('data-alert-id', alert.id);
            banner.style.background = severity.bg;
            banner.style.borderRight = '4px solid ' + severity.border;

            banner.innerHTML =
                '<div class="alert-banner-content">' +
                    '<span class="alert-icon">' + severity.icon + '</span>' +
                    '<div class="alert-text">' +
                        '<strong class="alert-title">' + this._escape(alert.titleHe) + '</strong>' +
                        '<span class="alert-message">' + this._escape(alert.messageHe) + '</span>' +
                    '</div>' +
                    '<button class="alert-dismiss" title="\u05E1\u05D2\u05D5\u05E8">\u2715</button>' +
                '</div>';

            const dismissBtn = banner.querySelector('.alert-dismiss');
            dismissBtn.addEventListener('click', () => {
                this._dismissAlert(alert.id);
                banner.style.opacity = '0';
                banner.style.maxHeight = '0';
                banner.style.marginBottom = '0';
                banner.style.padding = '0';
                setTimeout(() => {
                    banner.remove();
                    this._updateBadge();
                }, 300);
            });

            this.container.appendChild(banner);
        });

        this._updateBadge();
    }

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    /* ------------------------------------------------------------------ */
    /*  Styles                                                            */
    /* ------------------------------------------------------------------ */

    _injectStyles() {
        if (document.getElementById('alerts-ui-styles')) return;

        const style = document.createElement('style');
        style.id = 'alerts-ui-styles';
        style.textContent = `
/* AlertsUI */
.alerts-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0.75rem 2rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.alert-banner {
    border-radius: 8px;
    padding: 0.75rem 1rem;
    transition: opacity 0.3s ease, max-height 0.3s ease, margin-bottom 0.3s ease, padding 0.3s ease;
    overflow: hidden;
    max-height: 200px;
}

.alert-banner-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.alert-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
}

.alert-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
}

.alert-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-primary, #e8ecf4);
}

.alert-message {
    font-size: 0.85rem;
    color: var(--text-secondary, #8b95a8);
    line-height: 1.5;
}

.alert-dismiss {
    background: none;
    border: none;
    color: var(--text-muted, #5a6578);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: color 0.2s, background 0.2s;
    flex-shrink: 0;
    line-height: 1;
}

.alert-dismiss:hover {
    color: var(--text-primary, #e8ecf4);
    background: rgba(255,255,255,0.08);
}

/* Notification badge */
.alerts-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #fff;
    background: #ef4444;
    border-radius: 11px;
    margin-inline-end: 0.75rem;
}

/* Responsive */
@media (max-width: 768px) {
    .alerts-container {
        padding: 0.5rem 1rem 0;
    }
    .alert-banner-content {
        flex-wrap: wrap;
    }
}
`;
        document.head.appendChild(style);
    }
}

/* Singleton */
window.alertsUI = new AlertsUI();
