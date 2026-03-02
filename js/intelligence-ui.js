// intelligence-ui.js — Smart Intelligence Page Logic

class IntelligencePage {
    constructor() {
        this.data = null;
        this.currentFilter = 'all';
    }

    async init() {
        const loader = window.dataLoader;
        loader.on('intelligenceUpdated', (data) => {
            this.data = data;
            this.render(data);
        });
        loader.on('dataError', () => {
            this.showLoading();
        });
        this.showLoading();
        loader.startAutoRefresh();
    }

    showLoading() {
        const el = document.getElementById('intelSummaryGrid');
        if (el) {
            el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">⏳ טוען נתונים...</div>';
        }
    }

    render(data) {
        this.renderSummary(data.summary);
        this.renderRecommendations(data.recommendations);
        this.renderEvents(data.events);
        this.renderInsiderActivity(data.insiderActivity);
        this.renderSocialPulse(data.socialPulse);
        this.updateLastUpdated(data.lastUpdated);
    }

    updateLastUpdated(timestamp) {
        const el = document.getElementById('lastUpdated');
        if (el && timestamp) {
            const date = new Date(timestamp);
            el.textContent = 'עדכון: ' + date.toLocaleString('he-IL', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    renderSummary(summary) {
        const container = document.getElementById('intelSummaryGrid');
        if (!container || !summary) return;

        const moodClass = summary.marketMood || 'neutral';

        container.innerHTML = `
            <div class="intel-summary-card fade-in">
                <div class="intel-summary-icon">🔍</div>
                <div class="intel-summary-label">אירועים שזוהו</div>
                <div class="intel-summary-value blue">${summary.totalEventsDetected || 0}</div>
            </div>
            <div class="intel-summary-card fade-in">
                <div class="intel-summary-icon">🟢</div>
                <div class="intel-summary-label">המלצות קנייה</div>
                <div class="intel-summary-value bullish">${summary.buyRecommendations || 0}</div>
            </div>
            <div class="intel-summary-card fade-in">
                <div class="intel-summary-icon">🔴</div>
                <div class="intel-summary-label">המלצות מכירה</div>
                <div class="intel-summary-value bearish">${summary.sellRecommendations || 0}</div>
            </div>
            <div class="intel-summary-card fade-in">
                <div class="intel-summary-icon">📊</div>
                <div class="intel-summary-label">מצב שוק</div>
                <div class="intel-summary-value ${moodClass}">${summary.marketMoodHe || 'ניטראלי'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;">${summary.topEventHe ? 'אירוע מוביל: ' + summary.topEventHe : ''}</div>
            </div>
        `;
    }

    renderRecommendations(recs) {
        const container = document.getElementById('recommendationsGrid');
        if (!container || !recs) return;

        const filtered = this.currentFilter === 'all'
            ? recs
            : recs.filter(r => r.action === this.currentFilter);

        if (filtered.length === 0) {
            container.innerHTML = '<div class="no-signals"><div class="no-signals-icon">📭</div><p>אין המלצות בקטגוריה זו</p></div>';
            return;
        }

        container.innerHTML = filtered.map(rec => {
            const actionClass = rec.action.toLowerCase();
            const confidenceClass = rec.confidence.score >= 70 ? 'high' : (rec.confidence.score >= 50 ? 'medium' : 'low');
            const urgencyIcon = rec.urgency === 'high' ? '🔥' : (rec.urgency === 'medium' ? '⚡' : '💤');

            return `
                <div class="rec-card fade-in" data-action="${rec.action}">
                    <div class="rec-card-header">
                        <div class="rec-card-info">
                            <span class="rec-event-icon">${rec.primaryEventIcon || '📰'}</span>
                            <div>
                                <div class="rec-ticker">${rec.ticker}</div>
                                <div class="rec-ticker-name">${rec.tickerName || ''}</div>
                            </div>
                        </div>
                        <div class="rec-badges">
                            <span class="rec-action-badge ${actionClass}">${rec.actionHe}</span>
                            <span class="rec-urgency">${urgencyIcon} ${rec.urgencyHe}</span>
                        </div>
                    </div>
                    <div class="rec-card-body">
                        <div class="confidence-container">
                            <div class="confidence-label">
                                <span>רמת ביטחון</span>
                                <span class="confidence-score ${confidenceClass}">${rec.confidence.score}%</span>
                            </div>
                            <div class="confidence-bar">
                                <div class="confidence-fill ${confidenceClass}" style="width: ${rec.confidence.score}%"></div>
                            </div>
                        </div>
                        <div class="rec-reason">
                            <div class="rec-reason-label">נימוק:</div>
                            <p>${rec.reasonHe || ''}</p>
                        </div>
                        <div class="rec-supporting-data">
                            ${rec.supportingData.newsSourceCount ? `<span class="rec-data-tag">📰 ${rec.supportingData.newsSourceCount} מקורות</span>` : ''}
                            ${rec.supportingData.insiderActivity ? `<span class="rec-data-tag">👔 ${rec.supportingData.insiderActivity === 'buying' ? 'רכישה פנימית' : 'מכירה פנימית'}</span>` : ''}
                            ${rec.supportingData.socialBullishPct !== null && rec.supportingData.socialBullishPct !== undefined ? `<span class="rec-data-tag">💬 ${rec.supportingData.socialBullishPct}% שוריים</span>` : ''}
                        </div>
                        <div class="rec-meta">
                            <span class="rec-direction ${rec.direction}">${rec.directionHe}</span>
                            <span class="rec-time">${this.formatTimeAgo(rec.timestamp)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEvents(events) {
        const container = document.getElementById('eventsTimeline');
        if (!container || !events) return;

        if (events.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">לא זוהו אירועים</div>';
            return;
        }

        // Show max 30 events
        const display = events.slice(0, 30);

        container.innerHTML = display.map(evt => {
            const sentimentClass = evt.sentiment?.label || 'neutral';
            const tickers = (evt.affectedTickers || []).slice(0, 5);

            return `
                <div class="event-item fade-in ${sentimentClass}">
                    <div class="event-dot ${sentimentClass}"></div>
                    <div class="event-content">
                        <div class="event-header">
                            <span class="event-category-icon">${evt.icon || '📰'}</span>
                            <span class="event-category">${evt.categoryHe || evt.category}</span>
                            <span class="event-severity ${evt.eventSeverity}">${evt.eventSeverityHe}</span>
                            <span class="event-source">${evt.source}</span>
                            <span class="event-time">${this.formatTimeAgo(evt.publishedAt)}</span>
                        </div>
                        <div class="event-headline">${evt.headline}</div>
                        <div class="event-footer">
                            <div class="event-sentiment">
                                <span class="sentiment-dot ${sentimentClass}"></span>
                                <span>${evt.sentiment?.labelHe || 'ניטראלי'} (${evt.sentiment?.compound || 0})</span>
                            </div>
                            <div class="event-tickers">
                                ${tickers.map(t => `<span class="event-ticker-badge">${t}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderInsiderActivity(insiderData) {
        const container = document.getElementById('insiderGrid');
        if (!container || !insiderData) return;

        if (insiderData.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">אין נתוני מסחר פנימי</div>';
            return;
        }

        container.innerHTML = insiderData.map(item => {
            const dirClass = item.netDirection === 'buying' ? 'bullish' : (item.netDirection === 'selling' ? 'bearish' : 'neutral');

            return `
                <div class="insider-card fade-in">
                    <div class="insider-card-header">
                        <div class="insider-ticker">${item.ticker}</div>
                        <div class="insider-ticker-name">${item.tickerName}</div>
                        <span class="insider-direction ${dirClass}">${item.netDirectionHe}</span>
                    </div>
                    <div class="insider-stats">
                        <div class="insider-stat">
                            <span class="insider-stat-label">רכישות</span>
                            <span class="insider-stat-value bullish">${item.purchaseCount || 0}</span>
                        </div>
                        <div class="insider-stat">
                            <span class="insider-stat-label">מכירות</span>
                            <span class="insider-stat-value bearish">${item.saleCount || 0}</span>
                        </div>
                        <div class="insider-stat">
                            <span class="insider-stat-label">סה"כ</span>
                            <span class="insider-stat-value">${item.transactionCount || 0}</span>
                        </div>
                    </div>
                    ${item.recentTransactions && item.recentTransactions.length > 0 ? `
                        <div class="insider-transactions">
                            ${item.recentTransactions.slice(0, 3).map(txn => `
                                <div class="insider-txn">
                                    <span class="insider-txn-name">${txn.name}</span>
                                    <span class="insider-txn-type ${txn.type === 'purchase' ? 'bullish' : 'bearish'}">${txn.typeHe}</span>
                                    <span class="insider-txn-shares">${txn.shares?.toLocaleString() || 0} מניות</span>
                                    <span class="insider-txn-date">${txn.date}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderSocialPulse(socialData) {
        const container = document.getElementById('socialGrid');
        if (!container || !socialData) return;

        // Filter to those with meaningful data
        const meaningful = socialData.filter(s =>
            (s.stocktwits && s.stocktwits.totalMessages > 0) ||
            (s.reddit && s.reddit.mentions > 0)
        );

        if (meaningful.length === 0) {
            container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">אין נתוני סנטימנט חברתי</div>';
            return;
        }

        container.innerHTML = meaningful.map(item => {
            const st = item.stocktwits || {};
            const rd = item.reddit || {};
            const stSentiment = st.sentiment || 'neutral';
            const bullishPct = st.bullishPct || 50;
            const bearishPct = 100 - bullishPct;

            return `
                <div class="social-card fade-in">
                    <div class="social-card-header">
                        <div class="social-ticker">${item.ticker}</div>
                        <div class="social-ticker-name">${item.tickerName}</div>
                        ${rd.trending ? '<span class="trending-badge">🔥 במגמה</span>' : ''}
                    </div>
                    ${st.totalMessages > 0 ? `
                        <div class="social-section">
                            <div class="social-section-label">StockTwits</div>
                            <div class="sentiment-bar-container">
                                <div class="sentiment-bar-fill bullish" style="width: ${bullishPct}%"></div>
                                <div class="sentiment-bar-fill bearish" style="width: ${bearishPct}%"></div>
                            </div>
                            <div class="sentiment-bar-labels">
                                <span class="bullish">🟢 ${st.bullishCount || 0} שורי (${bullishPct}%)</span>
                                <span class="bearish">🔴 ${st.bearishCount || 0} דובי</span>
                            </div>
                        </div>
                    ` : ''}
                    ${rd.mentions > 0 ? `
                        <div class="social-section">
                            <div class="social-section-label">Reddit</div>
                            <div class="reddit-stats">
                                <span>📝 ${rd.mentions} אזכורים</span>
                                <span>⬆️ ${rd.totalUpvotes?.toLocaleString() || 0} הצבעות</span>
                                ${rd.topSubreddits ? `<span>📌 ${rd.topSubreddits.join(', ')}</span>` : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    filterRecommendations(filter) {
        this.currentFilter = filter;

        document.querySelectorAll('.signal-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        if (this.data) {
            this.renderRecommendations(this.data.recommendations);
        }
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 60) return `לפני ${diffMins} דקות`;
            if (diffHours < 24) return `לפני ${diffHours} שעות`;
            if (diffDays < 7) return `לפני ${diffDays} ימים`;
            return date.toLocaleDateString('he-IL');
        } catch {
            return '';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.intelligencePage = new IntelligencePage();
    window.intelligencePage.init();
});
