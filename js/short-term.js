// short-term.js — Short-Term Trading Page Logic

class ShortTermPage {
    constructor() {
        this.data = null;
        this.marketData = null;
        this.currentFilter = 'all';
    }

    async init() {
        const loader = window.dataLoader;
        // Listen for short-term specific data updates
        loader.on('shortTermUpdated', (shortTermData) => {
            this.data = shortTermData;
            this.render(shortTermData, loader.marketData);
        });
        // Also listen for market data updates (to refresh prices)
        loader.on('dataUpdated', (marketData) => {
            this.marketData = marketData;
            if (this.data) {
                this.render(this.data, marketData);
            }
        });
        loader.on('loadError', () => {
            this.showError();
        });
        loader.on('awaitingData', () => {
            this.showAwaiting();
        });
        this.showLoading();
        // Data loading & auto-refresh are handled by data-loader.js DOMContentLoaded
        // If data is already loaded, render immediately
        if (loader.shortTermData) {
            this.data = loader.shortTermData;
            this.render(loader.shortTermData, loader.marketData);
        }
    }

    showLoading() {
        const sentimentEl = document.getElementById('sentimentGrid');
        if (sentimentEl) {
            sentimentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">⏳ טוען נתונים...</div>';
        }
    }

    showError() {
        const sentimentEl = document.getElementById('sentimentGrid');
        if (sentimentEl) {
            sentimentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--accent-red);">❌ שגיאה בטעינת נתונים. ניסיון חוזר בעוד 5 דקות...</div>';
        }
    }

    showAwaiting() {
        const sentimentEl = document.getElementById('sentimentGrid');
        if (sentimentEl) {
            sentimentEl.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-muted);">📭 ממתין לנתונים ראשונים... הנתונים יעודכנו אוטומטית.</div>';
        }
    }

    render(shortTerm, marketData) {
        if (!shortTerm) return;
        const stocks = (marketData && marketData.stocks) ? marketData.stocks : {};
        this.renderSentiment(shortTerm.marketSentiment);
        this.renderSignalCards(shortTerm.signals || [], stocks);
        this.renderTradeIdeas(shortTerm.signals || [], 'dayTrade');
        this.renderTradeIdeas(shortTerm.signals || [], 'swingTrade');
        this.updateLastUpdated(shortTerm.lastUpdated);
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

    renderSentiment(sentiment) {
        const container = document.getElementById('sentimentGrid');
        if (!container || !sentiment) return;

        const vixClass = sentiment.vixInterpretation || 'normal';
        const spClass = sentiment.sp500Trend || 'neutral';
        const overallClass = sentiment.overallSignal || 'neutral';

        container.innerHTML = `
            <div class="sentiment-card fade-in">
                <div class="sentiment-icon">📊</div>
                <div class="sentiment-label">VIX (פחד)</div>
                <div class="sentiment-value ${vixClass}">${sentiment.vix || '—'}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.3rem;">${sentiment.vixInterpretationHe || ''}</div>
            </div>
            <div class="sentiment-card fade-in">
                <div class="sentiment-icon">📈</div>
                <div class="sentiment-label">S&P 500 מגמה</div>
                <div class="sentiment-value ${spClass}">${sentiment.sp500TrendHe || '—'}</div>
            </div>
            <div class="sentiment-card fade-in">
                <div class="sentiment-icon">🎯</div>
                <div class="sentiment-label">סנטימנט כללי</div>
                <div class="sentiment-value ${overallClass}">${sentiment.overallSignalHe || '—'}</div>
            </div>
            <div class="sentiment-card fade-in">
                <div class="sentiment-icon">📊</div>
                <div class="sentiment-label">סיגנלים</div>
                <div class="sentiment-value blue">${this.data ? this.data.signals.filter(s => s.signal === 'BUY').length : 0} קנייה / ${this.data ? this.data.signals.filter(s => s.signal === 'SELL').length : 0} מכירה</div>
            </div>
        `;
    }

    renderSignalCards(signals, stocks) {
        const container = document.getElementById('signalsGrid');
        if (!container || !signals) return;

        const filtered = this.currentFilter === 'all'
            ? signals
            : signals.filter(s => s.signal === this.currentFilter.toUpperCase());

        if (filtered.length === 0) {
            container.innerHTML = '<div class="no-signals"><div class="no-signals-icon">📭</div><p>אין סיגנלים בקטגוריה זו</p></div>';
            return;
        }

        container.innerHTML = filtered.map(sig => {
            const stock = stocks[sig.ticker] || {};
            const price = stock.price || 0;
            const changePct = stock.changePct || 0;
            const changeClass = changePct >= 0 ? 'bullish' : 'bearish';
            const changeSign = changePct >= 0 ? '+' : '';
            const signalClass = sig.signal.toLowerCase();
            const momentumClass = sig.momentumScore >= 7 ? 'bullish' : (sig.momentumScore <= 3 ? 'bearish' : 'neutral');

            return `
                <div class="signal-card fade-in" data-signal="${sig.signal}">
                    <div class="signal-card-header">
                        <div class="signal-card-info">
                            <div class="signal-ticker">${sig.ticker}</div>
                            <div class="signal-price">$${price.toFixed(2)} <span class="${changeClass}">(${changeSign}${changePct.toFixed(2)}%)</span></div>
                        </div>
                        <span class="signal-badge ${signalClass}">${sig.signalHe}</span>
                    </div>
                    <div class="signal-card-body">
                        <div class="momentum-container">
                            <div class="momentum-label">
                                <span>Momentum Score</span>
                                <span class="momentum-score" style="color:${momentumClass === 'bullish' ? 'var(--accent-green)' : (momentumClass === 'bearish' ? 'var(--accent-red)' : 'var(--accent-orange)')}">${sig.momentumScore}/10</span>
                            </div>
                            <div class="momentum-bar">
                                <div class="momentum-fill ${momentumClass}" style="width: ${sig.momentumScore * 10}%"></div>
                            </div>
                        </div>
                        <div class="analysis-grid">
                            <div class="analysis-item">
                                <div class="analysis-label">RSI (14)</div>
                                <div class="analysis-value ${sig.analysis.rsi.interpretation === 'overbought' || sig.analysis.rsi.interpretation === 'bearish' ? 'bearish' : (sig.analysis.rsi.interpretation === 'oversold' || sig.analysis.rsi.interpretation === 'bullish' ? 'bullish' : 'neutral')}">${sig.analysis.rsi.value !== null ? sig.analysis.rsi.value : '—'} — ${sig.analysis.rsi.interpretationHe}</div>
                            </div>
                            <div class="analysis-item">
                                <div class="analysis-label">MACD</div>
                                <div class="analysis-value ${sig.analysis.macd.trend === 'bullish' ? 'bullish' : (sig.analysis.macd.trend === 'bearish' ? 'bearish' : 'neutral')}">${sig.analysis.macd.trendHe}${sig.analysis.macd.crossover ? ' ⚡' : ''}</div>
                            </div>
                            <div class="analysis-item">
                                <div class="analysis-label">ממוצעים נעים</div>
                                <div class="analysis-value ${sig.analysis.movingAverages.trend === 'bullish' ? 'bullish' : (sig.analysis.movingAverages.trend === 'bearish' ? 'bearish' : 'neutral')}">${sig.analysis.movingAverages.trendHe}</div>
                            </div>
                            <div class="analysis-item">
                                <div class="analysis-label">נפח מסחר</div>
                                <div class="analysis-value ${sig.analysis.volume.trend === 'high' ? 'bullish' : 'neutral'}">${sig.analysis.volume.ratio}x — ${sig.analysis.volume.trendHe}</div>
                            </div>
                        </div>
                        <div class="sr-levels">
                            <span class="sr-support">תמיכה: $${sig.support}</span>
                            <span class="sr-current">נוכחי: $${price.toFixed(2)}</span>
                            <span class="sr-resistance">התנגדות: $${sig.resistance}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderTradeIdeas(signals, type) {
        const containerId = type === 'dayTrade' ? 'dayTradeTable' : 'swingTradeTable';
        const container = document.getElementById(containerId);
        if (!container || !signals) return;

        const key = type === 'dayTrade' ? 'dayTradeIdea' : 'swingTradeIdea';
        const actionable = signals.filter(s => s.signal !== 'HOLD' && s[key]);

        if (actionable.length === 0) {
            container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">אין רעיונות מסחר כרגע</td></tr>';
            return;
        }

        container.innerHTML = actionable.map(sig => {
            const idea = sig[key];
            const rrClass = idea.riskRewardRatio >= 2 ? 'good' : (idea.riskRewardRatio >= 1.3 ? 'moderate' : 'poor');
            const signalClass = sig.signal.toLowerCase();

            return `
                <tr>
                    <td><strong>${sig.ticker}</strong> <span class="signal-badge ${signalClass}" style="font-size:0.7rem;padding:0.15rem 0.5rem;">${sig.signalHe}</span></td>
                    <td style="color:var(--accent-blue);">$${idea.entry}</td>
                    <td style="color:var(--accent-green);">$${idea.target}</td>
                    <td style="color:var(--accent-red);">$${idea.stopLoss}</td>
                    <td><span class="rr-badge ${rrClass}">${idea.riskRewardRatio}x</span></td>
                    ${type === 'swingTrade' ? `<td>${idea.timeframeHe || ''}</td>` : ''}
                </tr>
            `;
        }).join('');
    }

    filterSignals(filter) {
        this.currentFilter = filter;

        // Update filter buttons
        document.querySelectorAll('.signal-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        if (this.data && this.marketData) {
            this.renderSignalCards(this.data.signals, this.marketData.stocks);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.shortTermPage = new ShortTermPage();
    window.shortTermPage.init();
});
