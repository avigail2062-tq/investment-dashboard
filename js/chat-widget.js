/**
 * ChatWidget - FAQ / Knowledge-Base Chat Panel
 * Floating widget with search and category filtering.
 * Hebrew RTL, dark theme.
 */
class ChatWidget {
    constructor() {
        this.knowledgeBase = [];
        this.categories = [];
        this.activeCategory = null;
        this.isOpen = false;

        this._injectStyles();
        this._createButton();
        this._createPanel();
        this._loadKnowledgeBase();
    }

    /* ------------------------------------------------------------------ */
    /*  Data loading                                                      */
    /* ------------------------------------------------------------------ */

    async _loadKnowledgeBase() {
        try {
            const response = await fetch('./data/knowledge-base.json');
            if (!response.ok) throw new Error('Failed to fetch knowledge base');
            const data = await response.json();

            // Support both array and { items: [] } shapes
            this.knowledgeBase = Array.isArray(data) ? data : (data.items || []);

            // Extract unique categories
            const catSet = new Set();
            this.knowledgeBase.forEach(item => {
                if (item.category) catSet.add(item.category);
            });
            this.categories = Array.from(catSet);
            this._renderCategories();
            this._performSearch();
        } catch (err) {
            console.warn('ChatWidget: \u05DC\u05D0 \u05E0\u05D9\u05EA\u05DF \u05DC\u05D8\u05E2\u05D5\u05DF \u05DE\u05D0\u05D2\u05E8 \u05D9\u05D3\u05E2', err);
            this._showEmpty();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Toggle                                                            */
    /* ------------------------------------------------------------------ */

    toggle() {
        this.isOpen = !this.isOpen;
        this.panel.classList.toggle('chat-widget-panel--open', this.isOpen);
        this.btn.classList.toggle('chat-widget-btn--active', this.isOpen);
        if (this.isOpen) {
            this.searchInput.focus();
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Search algorithm                                                  */
    /* ------------------------------------------------------------------ */

    _performSearch() {
        const query = (this.searchInput.value || '').trim().toLowerCase();
        const keywords = query.split(/\s+/).filter(Boolean);

        let results;

        if (!keywords.length && !this.activeCategory) {
            // Show first 8 items when nothing typed and no category
            results = this.knowledgeBase.slice(0, 8);
        } else {
            const scored = this.knowledgeBase.map(item => {
                // Filter by category first
                if (this.activeCategory && item.category !== this.activeCategory) {
                    return { item, score: -1 };
                }

                if (!keywords.length) {
                    return { item, score: 1 }; // category match only
                }

                let score = 0;
                const questionLower = (item.question || '').toLowerCase();
                const answerLower = (item.answer || '').toLowerCase();
                const keywordsField = (item.keywords || []).map(k => k.toLowerCase());

                keywords.forEach(kw => {
                    // Keyword match: 2 pts
                    if (keywordsField.some(k => k.includes(kw))) {
                        score += 2;
                    }
                    // Question text match: 3 pts
                    if (questionLower.includes(kw)) {
                        score += 3;
                    }
                    // Answer text match: 1 pt
                    if (answerLower.includes(kw)) {
                        score += 1;
                    }
                });

                return { item, score };
            });

            results = scored
                .filter(s => s.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 8)
                .map(s => s.item);
        }

        this._renderResults(results);
    }

    /* ------------------------------------------------------------------ */
    /*  Rendering                                                         */
    /* ------------------------------------------------------------------ */

    _renderCategories() {
        this.categoriesContainer.innerHTML = '';

        // "All" button
        const allBtn = document.createElement('button');
        allBtn.className = 'chat-widget-cat-btn' + (!this.activeCategory ? ' chat-widget-cat-btn--active' : '');
        allBtn.textContent = '\u05D4\u05DB\u05DC';
        allBtn.addEventListener('click', () => {
            this.activeCategory = null;
            this._renderCategories();
            this._performSearch();
        });
        this.categoriesContainer.appendChild(allBtn);

        this.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'chat-widget-cat-btn' + (this.activeCategory === cat ? ' chat-widget-cat-btn--active' : '');
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                this.activeCategory = cat;
                this._renderCategories();
                this._performSearch();
            });
            this.categoriesContainer.appendChild(btn);
        });
    }

    _renderResults(items) {
        this.resultsContainer.innerHTML = '';

        if (!items || items.length === 0) {
            this._showEmpty();
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'chat-widget-result';

            const categoryTag = item.category
                ? '<span class="chat-widget-result-cat">' + this._escape(item.category) + '</span>'
                : '';

            card.innerHTML =
                categoryTag +
                '<div class="chat-widget-result-q">' + this._escape(item.question) + '</div>' +
                '<div class="chat-widget-result-a">' + this._escape(item.answer) + '</div>';

            this.resultsContainer.appendChild(card);
        });
    }

    _showEmpty() {
        this.resultsContainer.innerHTML =
            '<div class="chat-widget-empty">\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05EA\u05D5\u05E6\u05D0\u05D5\u05EA</div>';
    }

    _escape(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    /* ------------------------------------------------------------------ */
    /*  DOM creation                                                      */
    /* ------------------------------------------------------------------ */

    _createButton() {
        this.btn = document.createElement('button');
        this.btn.className = 'chat-widget-btn';
        this.btn.setAttribute('aria-label', '\u05E9\u05D0\u05DC\u05D5\u05EA \u05D5\u05EA\u05E9\u05D5\u05D1\u05D5\u05EA');
        this.btn.textContent = '\u2753';
        this.btn.addEventListener('click', () => this.toggle());
        document.body.appendChild(this.btn);
    }

    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'chat-widget-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'chat-widget-header';
        header.innerHTML =
            '<span class="chat-widget-header-title">\u05E9\u05D0\u05DC\u05D5\u05EA \u05D5\u05EA\u05E9\u05D5\u05D1\u05D5\u05EA</span>' +
            '<button class="chat-widget-close" aria-label="\u05E1\u05D2\u05D5\u05E8">\u2715</button>';
        header.querySelector('.chat-widget-close').addEventListener('click', () => this.toggle());

        // Search
        const searchWrap = document.createElement('div');
        searchWrap.className = 'chat-widget-search-wrap';

        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'chat-widget-search';
        this.searchInput.placeholder = '\u05D7\u05E4\u05E9 \u05E9\u05D0\u05DC\u05D4...';
        this.searchInput.dir = 'rtl';
        this.searchInput.addEventListener('input', () => this._performSearch());
        searchWrap.appendChild(this.searchInput);

        // Categories
        this.categoriesContainer = document.createElement('div');
        this.categoriesContainer.className = 'chat-widget-categories';

        // Results
        this.resultsContainer = document.createElement('div');
        this.resultsContainer.className = 'chat-widget-results';

        this.panel.appendChild(header);
        this.panel.appendChild(searchWrap);
        this.panel.appendChild(this.categoriesContainer);
        this.panel.appendChild(this.resultsContainer);
        document.body.appendChild(this.panel);
    }

    /* ------------------------------------------------------------------ */
    /*  Styles                                                            */
    /* ------------------------------------------------------------------ */

    _injectStyles() {
        if (document.getElementById('chat-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'chat-widget-styles';
        style.textContent = `
/* ChatWidget — floating button */
.chat-widget-btn {
    position: fixed;
    bottom: 1.5rem;
    left: 1.5rem;
    z-index: 9998;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--border, #2a3a5c);
    background: var(--bg-card, #1a2235);
    color: var(--text-primary, #e8ecf4);
    font-size: 1.4rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}
.chat-widget-btn:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(0,0,0,0.5);
    background: var(--bg-card-hover, #1e2a42);
}
.chat-widget-btn--active {
    background: var(--accent-blue, #3b82f6);
    border-color: var(--accent-blue, #3b82f6);
}

/* Panel */
.chat-widget-panel {
    position: fixed;
    bottom: 5rem;
    left: 1.5rem;
    z-index: 9999;
    width: 380px;
    max-height: 500px;
    background: var(--bg-card, #1a2235);
    border: 1px solid var(--border, #2a3a5c);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    overflow: hidden;

    /* Slide-up animation */
    opacity: 0;
    transform: translateY(20px);
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
}
.chat-widget-panel--open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}

/* Header */
.chat-widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border, #2a3a5c);
    flex-shrink: 0;
}
.chat-widget-header-title {
    font-weight: 700;
    font-size: 1rem;
    color: var(--text-primary, #e8ecf4);
}
.chat-widget-close {
    background: none;
    border: none;
    color: var(--text-muted, #5a6578);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    transition: color 0.2s, background 0.2s;
    line-height: 1;
}
.chat-widget-close:hover {
    color: var(--text-primary, #e8ecf4);
    background: rgba(255,255,255,0.08);
}

/* Search */
.chat-widget-search-wrap {
    padding: 0.65rem 1rem 0.35rem;
    flex-shrink: 0;
}
.chat-widget-search {
    width: 100%;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--border, #2a3a5c);
    border-radius: 8px;
    background: var(--bg-secondary, #111827);
    color: var(--text-primary, #e8ecf4);
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
}
.chat-widget-search::placeholder {
    color: var(--text-muted, #5a6578);
}
.chat-widget-search:focus {
    border-color: var(--accent-blue, #3b82f6);
}

/* Category buttons */
.chat-widget-categories {
    display: flex;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    flex-wrap: wrap;
    flex-shrink: 0;
}
.chat-widget-cat-btn {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid var(--border, #2a3a5c);
    background: transparent;
    color: var(--text-secondary, #8b95a8);
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    white-space: nowrap;
}
.chat-widget-cat-btn:hover {
    background: rgba(59,130,246,0.12);
    color: var(--accent-blue, #3b82f6);
    border-color: var(--accent-blue, #3b82f6);
}
.chat-widget-cat-btn--active {
    background: rgba(59,130,246,0.18);
    color: var(--accent-blue, #3b82f6);
    border-color: var(--accent-blue, #3b82f6);
    font-weight: 600;
}

/* Results */
.chat-widget-results {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.chat-widget-result {
    background: var(--bg-secondary, #111827);
    border: 1px solid var(--border, #2a3a5c);
    border-radius: 8px;
    padding: 0.75rem 0.85rem;
    transition: border-color 0.2s;
}
.chat-widget-result:hover {
    border-color: var(--accent-blue, #3b82f6);
}

.chat-widget-result-cat {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--accent-cyan, #06b6d4);
    background: rgba(6,182,212,0.12);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.35rem;
}

.chat-widget-result-q {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text-primary, #e8ecf4);
    margin-bottom: 0.25rem;
    line-height: 1.5;
}

.chat-widget-result-a {
    font-size: 0.82rem;
    color: var(--text-secondary, #8b95a8);
    line-height: 1.6;
}

/* Empty state */
.chat-widget-empty {
    text-align: center;
    color: var(--text-muted, #5a6578);
    padding: 2rem 0;
    font-size: 0.9rem;
}

/* Results scrollbar */
.chat-widget-results::-webkit-scrollbar { width: 6px; }
.chat-widget-results::-webkit-scrollbar-track { background: transparent; }
.chat-widget-results::-webkit-scrollbar-thumb { background: var(--border, #2a3a5c); border-radius: 3px; }
.chat-widget-results::-webkit-scrollbar-thumb:hover { background: var(--accent-blue, #3b82f6); }

/* Responsive */
@media (max-width: 480px) {
    .chat-widget-panel {
        width: calc(100vw - 2rem);
        left: 1rem;
        bottom: 4.5rem;
        max-height: 70vh;
    }
}
`;
        document.head.appendChild(style);
    }
}

/* Singleton */
window.chatWidget = new ChatWidget();
