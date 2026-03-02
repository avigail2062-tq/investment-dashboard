#!/usr/bin/env python3
"""
Smart Intelligence Pipeline for Investment Dashboard
Fetches news, insider trading, social sentiment, analyzes events,
and generates proactive BUY/SELL/WATCH recommendations.
Outputs: intelligence.json (+ merges high-confidence alerts into alerts.json)
"""

import json
import os
import re
import time
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone, timedelta

# Optional: try importing requests for cleaner API calls
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# Optional: try importing VADER for sentiment analysis
try:
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    vader = SentimentIntensityAnalyzer()
    HAS_VADER = True
except ImportError:
    vader = None
    HAS_VADER = False

# === CONFIGURATION ===

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')

# API Keys from environment
FINNHUB_API_KEY = os.environ.get('FINNHUB_API_KEY', '')
MARKETAUX_API_KEY = os.environ.get('MARKETAUX_API_KEY', '')
ALPHA_VANTAGE_KEY = os.environ.get('ALPHA_VANTAGE_KEY', '')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')

# Stock Universe - 4 Tiers
CORE_PORTFOLIO = ['NVDA', 'AVGO', 'LMT', 'RTX', 'NOC', 'CRWD', 'CEG', 'XOM', 'NEM', 'AMD']

SECTOR_ETFS = [
    'SPY', 'QQQ', 'XLF', 'XLE', 'XLV', 'XLK', 'XLI', 'XLU', 'XLP', 'XLB',
    'ARKK', 'SOXX', 'GDX', 'USO', 'TLT', 'IWM', 'EEM', 'VNQ'
]

SP500_TOP = [
    'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ', 'JPM',
    'V', 'PG', 'MA', 'HD', 'ABBV', 'MRK', 'PEP', 'KO', 'COST', 'WMT',
    'CRM', 'NFLX', 'ORCL', 'INTC', 'CSCO', 'IBM', 'QCOM', 'TXN', 'AMAT', 'MU',
    'BA', 'CAT', 'GE', 'HON', 'DE', 'UPS', 'FDX',
    'GS', 'MS', 'BLK', 'C', 'WFC', 'AXP',
    'PFE', 'LLY', 'TMO', 'ABT', 'BMY', 'GILD'
]

# All known tickers for entity extraction
ALL_KNOWN_TICKERS = set(CORE_PORTFOLIO + SECTOR_ETFS + SP500_TOP + [
    'PANW', 'FTNT', 'ZS', 'CCJ', 'SMR', 'FSLR', 'ENPH', 'CVX', 'GD',
    'DIS', 'PYPL', 'SQ', 'SHOP', 'SNOW', 'PLTR', 'COIN', 'MARA', 'RIOT',
    'SMCI', 'ARM', 'MRVL', 'SNPS', 'CDNS', 'LRCX', 'KLAC', 'ASML'
])

# Ticker name mapping for display
TICKER_NAMES = {
    'NVDA': 'NVIDIA', 'AVGO': 'Broadcom', 'LMT': 'Lockheed Martin',
    'RTX': 'RTX Corp', 'NOC': 'Northrop Grumman', 'CRWD': 'CrowdStrike',
    'CEG': 'Constellation Energy', 'XOM': 'Exxon Mobil', 'NEM': 'Newmont',
    'AMD': 'AMD', 'AAPL': 'Apple', 'MSFT': 'Microsoft', 'AMZN': 'Amazon',
    'GOOGL': 'Alphabet', 'META': 'Meta', 'TSLA': 'Tesla', 'JPM': 'JPMorgan',
    'GS': 'Goldman Sachs', 'BA': 'Boeing', 'PFE': 'Pfizer', 'LLY': 'Eli Lilly',
    'SPY': 'S&P 500 ETF', 'QQQ': 'Nasdaq 100 ETF', 'XLF': 'Financial ETF',
    'XLE': 'Energy ETF', 'XLV': 'Healthcare ETF', 'XLK': 'Tech ETF',
    'ARKK': 'ARK Innovation', 'SOXX': 'Semiconductor ETF', 'GDX': 'Gold Miners ETF',
    'USO': 'Oil ETF', 'TLT': 'Treasury Bond ETF', 'IWM': 'Russell 2000 ETF',
    'PANW': 'Palo Alto Networks', 'CCJ': 'Cameco', 'SMR': 'NuScale Power',
    'SMCI': 'Super Micro', 'ARM': 'ARM Holdings', 'PLTR': 'Palantir',
    'COIN': 'Coinbase', 'V': 'Visa', 'MA': 'Mastercard',
    'CAT': 'Caterpillar', 'GE': 'GE Aerospace', 'HON': 'Honeywell',
    'BLK': 'BlackRock', 'WFC': 'Wells Fargo', 'NFLX': 'Netflix',
    'CRM': 'Salesforce', 'COST': 'Costco', 'WMT': 'Walmart',
}

# === EVENT-TO-SECTOR MAPPING ===

EVENT_SECTOR_MAP = {
    'war': {
        'sectors': ['defense', 'energy', 'gold'],
        'direction': 'mixed',
        'bullish_tickers': ['LMT', 'RTX', 'NOC', 'GD', 'NEM', 'GDX', 'XOM', 'USO'],
        'bearish_tickers': ['SPY'],
        'categoryHe': '\u05e2\u05d9\u05de\u05d5\u05ea \u05e6\u05d1\u05d0\u05d9 / \u05d2\u05d9\u05d0\u05d5\u05e4\u05d5\u05dc\u05d9\u05d8\u05d9',
        'icon': '\u2694\ufe0f'
    },
    'ai_breakthrough': {
        'sectors': ['tech', 'semiconductors'],
        'direction': 'bullish',
        'bullish_tickers': ['NVDA', 'AMD', 'AVGO', 'MSFT', 'GOOGL', 'META', 'QQQ', 'SOXX', 'ARM', 'SMCI', 'PLTR'],
        'bearish_tickers': [],
        'categoryHe': '\u05e4\u05e8\u05d9\u05e6\u05ea \u05d3\u05e8\u05da AI / \u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05d4',
        'icon': '\U0001f916'
    },
    'oil_crisis': {
        'sectors': ['energy'],
        'direction': 'bullish',
        'bullish_tickers': ['XOM', 'CVX', 'XLE', 'USO'],
        'bearish_tickers': ['XLI', 'BA'],
        'categoryHe': '\u05de\u05e9\u05d1\u05e8 \u05e0\u05e4\u05d8 / \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4',
        'icon': '\U0001f6e2\ufe0f'
    },
    'rate_cut': {
        'sectors': ['tech', 'realestate', 'growth'],
        'direction': 'bullish',
        'bullish_tickers': ['QQQ', 'ARKK', 'VNQ', 'TLT', 'NVDA', 'TSLA', 'SMCI'],
        'bearish_tickers': ['XLF'],
        'categoryHe': '\u05d4\u05d5\u05e8\u05d3\u05ea \u05e8\u05d9\u05d1\u05d9\u05ea / \u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea \u05de\u05e7\u05dc\u05d4',
        'icon': '\U0001f4c9'
    },
    'rate_hike': {
        'sectors': ['banks', 'value'],
        'direction': 'mixed',
        'bullish_tickers': ['XLF', 'JPM', 'GS', 'WFC', 'BLK'],
        'bearish_tickers': ['QQQ', 'ARKK', 'VNQ', 'TLT'],
        'categoryHe': '\u05d4\u05e2\u05dc\u05d0\u05ea \u05e8\u05d9\u05d1\u05d9\u05ea / \u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea \u05de\u05e6\u05de\u05e6\u05de\u05ea',
        'icon': '\U0001f4c8'
    },
    'cyber_attack': {
        'sectors': ['cybersecurity'],
        'direction': 'bullish',
        'bullish_tickers': ['CRWD', 'PANW', 'FTNT', 'ZS'],
        'bearish_tickers': [],
        'categoryHe': '\u05de\u05ea\u05e7\u05e4\u05ea \u05e1\u05d9\u05d9\u05d1\u05e8 / \u05d0\u05d1\u05d8\u05d7\u05ea \u05de\u05d9\u05d3\u05e2',
        'icon': '\U0001f512'
    },
    'pandemic': {
        'sectors': ['pharma', 'biotech'],
        'direction': 'mixed',
        'bullish_tickers': ['PFE', 'LLY', 'TMO', 'ABT', 'XLV'],
        'bearish_tickers': ['SPY', 'XLI'],
        'categoryHe': '\u05de\u05d2\u05d9\u05e4\u05d4 / \u05d1\u05e8\u05d9\u05d0\u05d5\u05ea \u05e2\u05d5\u05dc\u05de\u05d9\u05ea',
        'icon': '\U0001f9a0'
    },
    'recession_fear': {
        'sectors': ['gold', 'bonds', 'utilities'],
        'direction': 'mixed',
        'bullish_tickers': ['NEM', 'GDX', 'TLT', 'XLU', 'XLP'],
        'bearish_tickers': ['SPY', 'QQQ', 'XLF', 'XLI'],
        'categoryHe': '\u05d7\u05e9\u05e9 \u05de\u05d9\u05ea\u05d5\u05df \u05db\u05dc\u05db\u05dc\u05d9',
        'icon': '\U0001f4ca'
    },
    'nuclear_energy': {
        'sectors': ['energy'],
        'direction': 'bullish',
        'bullish_tickers': ['CEG', 'CCJ', 'SMR'],
        'bearish_tickers': [],
        'categoryHe': '\u05d0\u05e0\u05e8\u05d2\u05d9\u05d4 \u05d2\u05e8\u05e2\u05d9\u05e0\u05d9\u05ea',
        'icon': '\u269b\ufe0f'
    },
    'climate_regulation': {
        'sectors': ['clean_energy'],
        'direction': 'mixed',
        'bullish_tickers': ['FSLR', 'ENPH', 'CEG'],
        'bearish_tickers': ['XOM', 'XLE'],
        'categoryHe': '\u05e8\u05d2\u05d5\u05dc\u05e6\u05d9\u05d9\u05ea \u05d0\u05e7\u05dc\u05d9\u05dd / \u05d0\u05e0\u05e8\u05d2\u05d9\u05d4 \u05e0\u05e7\u05d9\u05d4',
        'icon': '\U0001f30d'
    },
    'regulation_tech': {
        'sectors': ['tech'],
        'direction': 'bearish',
        'bullish_tickers': [],
        'bearish_tickers': ['GOOGL', 'META', 'AAPL', 'AMZN', 'MSFT', 'QQQ'],
        'categoryHe': '\u05e8\u05d2\u05d5\u05dc\u05e6\u05d9\u05d4 \u05d8\u05db\u05e0\u05d5\u05dc\u05d5\u05d2\u05d9\u05ea / \u05d4\u05d2\u05d1\u05dc\u05d9\u05dd \u05e2\u05e1\u05e7\u05d9\u05d9\u05dd',
        'icon': '\u2696\ufe0f'
    },
    'trade_war': {
        'sectors': ['semiconductors', 'manufacturing'],
        'direction': 'bearish',
        'bullish_tickers': ['GDX', 'NEM'],
        'bearish_tickers': ['NVDA', 'AMD', 'AVGO', 'AAPL', 'TSLA', 'SOXX'],
        'categoryHe': '\u05de\u05dc\u05d7\u05de\u05ea \u05e1\u05d7\u05e8 / \u05de\u05db\u05e1\u05d9\u05dd',
        'icon': '\U0001f3d7\ufe0f'
    },
    'crypto_surge': {
        'sectors': ['crypto'],
        'direction': 'bullish',
        'bullish_tickers': ['COIN', 'MARA', 'RIOT'],
        'bearish_tickers': [],
        'categoryHe': '\u05e2\u05dc\u05d9\u05d9\u05ea \u05e7\u05e8\u05d9\u05e4\u05d8\u05d5',
        'icon': '\u20bf'
    },
    'earnings_positive': {
        'sectors': [],
        'direction': 'bullish',
        'bullish_tickers': [],
        'bearish_tickers': [],
        'categoryHe': '\u05d3\u05d5\u05d7\u05d5\u05ea \u05db\u05e1\u05e4\u05d9\u05d9\u05dd \u05d7\u05d9\u05d5\u05d1\u05d9\u05d9\u05dd',
        'icon': '\U0001f4b0'
    },
    'earnings_negative': {
        'sectors': [],
        'direction': 'bearish',
        'bullish_tickers': [],
        'bearish_tickers': [],
        'categoryHe': '\u05d3\u05d5\u05d7\u05d5\u05ea \u05db\u05e1\u05e4\u05d9\u05d9\u05dd \u05e9\u05dc\u05d9\u05dc\u05d9\u05d9\u05dd',
        'icon': '\U0001f4b8'
    },
}

# Keyword dictionaries for event detection
EVENT_KEYWORDS = {
    'war': [
        'war', 'military', 'strike', 'attack', 'missile', 'conflict', 'invasion',
        'troops', 'airstrike', 'bombing', 'escalation', 'ceasefire', 'defense contract',
        'pentagon', 'nato', 'weapons', 'sanctions', 'iran', 'russia', 'ukraine',
        'china taiwan', 'north korea', 'houthi', 'hezbollah', 'hamas', 'israel',
        'nuclear threat', 'military aid', 'arms deal', 'artillery', 'drone strike',
        'geopolitical', 'territorial dispute'
    ],
    'ai_breakthrough': [
        'artificial intelligence', ' AI ', 'machine learning', 'deep learning',
        'GPT', 'large language model', 'LLM', 'neural network', 'data center',
        'GPU demand', 'AI chip', 'AI infrastructure', 'generative AI', 'AI revenue',
        'AI spending', 'cloud AI', 'AI partnership', 'AI regulation', 'AI breakthrough',
        'nvidia', 'openai', 'anthropic', 'google ai', 'meta ai', 'microsoft ai'
    ],
    'oil_crisis': [
        'oil price', 'crude oil', 'OPEC', 'oil supply', 'oil demand', 'oil embargo',
        'pipeline', 'refinery', 'petroleum', 'natural gas', 'LNG', 'oil production',
        'oil export', 'energy crisis', 'fuel shortage', 'gas prices',
        'saudi arabia oil', 'oil cut', 'oil surplus', 'shale', 'fracking'
    ],
    'rate_cut': [
        'rate cut', 'fed cut', 'interest rate reduction', 'dovish', 'easing',
        'monetary easing', 'fed pivot', 'lower rates', 'rate decrease',
        'federal reserve cut', 'ECB cut', 'stimulus', 'quantitative easing',
        'accommodative', 'soft landing'
    ],
    'rate_hike': [
        'rate hike', 'fed hike', 'tightening', 'hawkish', 'rate increase',
        'monetary tightening', 'higher rates', 'inflation fight',
        'federal reserve hike', 'interest rate rise', 'quantitative tightening',
        'restrictive policy', 'hot inflation'
    ],
    'cyber_attack': [
        'cyber attack', 'data breach', 'ransomware', 'hack', 'cybersecurity',
        'cyber threat', 'phishing', 'malware', 'DDoS', 'zero-day',
        'security breach', 'cyber espionage', 'cyber warfare', 'encryption',
        'cybercrime', 'identity theft', 'cloud security'
    ],
    'pandemic': [
        'pandemic', 'epidemic', 'virus', 'outbreak', 'WHO emergency',
        'vaccine', 'COVID', 'bird flu', 'H5N1', 'quarantine', 'lockdown',
        'health emergency', 'disease spread', 'mutation', 'variant'
    ],
    'recession_fear': [
        'recession', 'economic downturn', 'GDP decline', 'unemployment rise',
        'layoffs', 'job cuts', 'consumer spending decline', 'economic slowdown',
        'bear market', 'market crash', 'financial crisis', 'bank failure',
        'credit crunch', 'default risk', 'debt ceiling', 'yield curve inversion'
    ],
    'nuclear_energy': [
        'nuclear energy', 'nuclear power', 'nuclear plant', 'uranium',
        'nuclear reactor', 'small modular reactor', 'SMR', 'nuclear deal',
        'atomic energy', 'nuclear fusion', 'constellation energy nuclear'
    ],
    'climate_regulation': [
        'climate change', 'carbon tax', 'green energy', 'renewable energy',
        'solar', 'wind power', 'clean energy', 'EV mandate', 'emission',
        'paris agreement', 'climate policy', 'environmental regulation',
        'ESG', 'sustainability', 'net zero'
    ],
    'regulation_tech': [
        'antitrust', 'monopoly', 'tech regulation', 'privacy law', 'GDPR',
        'section 230', 'big tech regulation', 'tech breakup', 'data privacy',
        'tech hearing', 'FTC', 'DOJ lawsuit', 'EU fine', 'digital markets act'
    ],
    'trade_war': [
        'trade war', 'tariff', 'trade ban', 'export ban', 'import duty',
        'trade restriction', 'chip ban', 'china ban', 'trade deficit',
        'trade sanction', 'customs duty', 'protectionism', 'decoupling'
    ],
    'crypto_surge': [
        'bitcoin', 'ethereum', 'crypto', 'cryptocurrency', 'blockchain',
        'bitcoin ETF', 'crypto regulation', 'digital currency', 'DeFi',
        'crypto rally', 'bitcoin halving', 'crypto adoption'
    ],
    'earnings_positive': [
        'earnings beat', 'revenue beat', 'profit surge', 'strong earnings',
        'record revenue', 'guidance raise', 'upgraded forecast', 'outperform',
        'exceeded expectations', 'blowout earnings', 'surprise profit'
    ],
    'earnings_negative': [
        'earnings miss', 'revenue miss', 'profit warning', 'weak earnings',
        'guidance cut', 'downgraded forecast', 'disappointing results',
        'missed expectations', 'revenue decline', 'loss widened'
    ],
}


# === HELPER FUNCTIONS ===

def safe_float(val):
    """Safely convert to float."""
    try:
        if val is None:
            return None
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None


def make_request(url, headers=None, timeout=15):
    """Make HTTP GET request with fallback from requests to urllib."""
    if HAS_REQUESTS:
        try:
            resp = requests.get(url, headers=headers or {}, timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"  requests error: {e}")
            return None
    else:
        try:
            req = urllib.request.Request(url, headers=headers or {})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"  urllib error: {e}")
            return None


def generate_event_id(category, headline, timestamp):
    """Generate unique event ID from content hash."""
    content = f"{category}-{headline}-{timestamp}"
    return f"evt-{hashlib.md5(content.encode()).hexdigest()[:12]}"


def generate_rec_id(ticker, action, timestamp):
    """Generate unique recommendation ID."""
    content = f"{ticker}-{action}-{timestamp}"
    return f"rec-{hashlib.md5(content.encode()).hexdigest()[:12]}"


# === NEWS FETCHING ===

def fetch_finnhub_general_news():
    """Fetch general market news from Finnhub (1 API call)."""
    if not FINNHUB_API_KEY:
        print("  Finnhub: No API key, skipping general news")
        return []

    print("  Fetching Finnhub general news...")
    url = f"https://finnhub.io/api/v1/news?category=general&token={FINNHUB_API_KEY}"
    data = make_request(url)

    if not data or not isinstance(data, list):
        return []

    articles = []
    for item in data[:50]:
        articles.append({
            'headline': item.get('headline', ''),
            'summary': item.get('summary', ''),
            'source': item.get('source', 'Finnhub'),
            'url': item.get('url', ''),
            'publishedAt': datetime.fromtimestamp(item.get('datetime', 0), tz=timezone.utc).isoformat() if item.get('datetime') else '',
            'category': item.get('category', ''),
            'related': item.get('related', ''),
            'origin': 'finnhub_general'
        })

    print(f"  Finnhub general: {len(articles)} articles")
    return articles


def fetch_finnhub_company_news(tickers, days_back=2):
    """Fetch company-specific news from Finnhub."""
    if not FINNHUB_API_KEY:
        print("  Finnhub: No API key, skipping company news")
        return []

    print(f"  Fetching Finnhub company news for {len(tickers)} tickers...")
    articles = []
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    from_date = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime('%Y-%m-%d')

    for ticker in tickers:
        try:
            url = f"https://finnhub.io/api/v1/company-news?symbol={ticker}&from={from_date}&to={today}&token={FINNHUB_API_KEY}"
            data = make_request(url)

            if data and isinstance(data, list):
                for item in data[:5]:  # Limit per ticker
                    articles.append({
                        'headline': item.get('headline', ''),
                        'summary': item.get('summary', ''),
                        'source': item.get('source', 'Finnhub'),
                        'url': item.get('url', ''),
                        'publishedAt': datetime.fromtimestamp(item.get('datetime', 0), tz=timezone.utc).isoformat() if item.get('datetime') else '',
                        'related': ticker,
                        'origin': 'finnhub_company'
                    })

            time.sleep(0.3)  # Rate limiting: 60 calls/min
        except Exception as e:
            print(f"    Error fetching news for {ticker}: {e}")

    print(f"  Finnhub company: {len(articles)} articles")
    return articles


def fetch_marketaux_news(tickers=None):
    """Fetch stock news from MarketAux."""
    if not MARKETAUX_API_KEY:
        print("  MarketAux: No API key, skipping")
        return []

    print("  Fetching MarketAux news...")
    articles = []

    try:
        params = f"api_token={MARKETAUX_API_KEY}&language=en&limit=50"
        if tickers:
            # Batch up to 10 tickers
            batch = ','.join(tickers[:10])
            params += f"&symbols={batch}"

        url = f"https://api.marketaux.com/v1/news/all?{params}"
        data = make_request(url)

        if data and 'data' in data:
            for item in data['data']:
                entities = item.get('entities', [])
                related_tickers = [e.get('symbol', '') for e in entities if e.get('symbol')]

                articles.append({
                    'headline': item.get('title', ''),
                    'summary': item.get('description', ''),
                    'source': item.get('source', 'MarketAux'),
                    'url': item.get('url', ''),
                    'publishedAt': item.get('published_at', ''),
                    'related': ','.join(related_tickers),
                    'origin': 'marketaux',
                    'sentiment_score': item.get('sentiment_score')  # MarketAux provides this
                })
    except Exception as e:
        print(f"  MarketAux error: {e}")

    print(f"  MarketAux: {len(articles)} articles")
    return articles


# === SEC INSIDER TRADING ===

def fetch_insider_transactions(tickers, limit_per_ticker=20):
    """Fetch insider trading data from Finnhub."""
    if not FINNHUB_API_KEY:
        print("  Finnhub: No API key, skipping insider trading")
        return {}

    print(f"  Fetching insider transactions for {len(tickers)} tickers...")
    insider_data = {}

    for ticker in tickers:
        try:
            url = f"https://finnhub.io/api/v1/stock/insider-transactions?symbol={ticker}&token={FINNHUB_API_KEY}"
            data = make_request(url)

            if data and 'data' in data and data['data']:
                transactions = []
                cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).strftime('%Y-%m-%d')

                for txn in data['data'][:limit_per_ticker]:
                    txn_date = txn.get('transactionDate', '')
                    if txn_date < cutoff:
                        continue

                    txn_code = txn.get('transactionCode', '')
                    if txn_code not in ('P', 'S', 'A', 'M'):
                        continue

                    is_purchase = txn_code in ('P', 'A')
                    shares = abs(txn.get('share', 0))
                    change = txn.get('change', 0)

                    transactions.append({
                        'name': txn.get('name', 'Unknown'),
                        'type': 'purchase' if is_purchase else 'sale',
                        'typeHe': '\u05e8\u05db\u05d9\u05e9\u05d4' if is_purchase else '\u05de\u05db\u05d9\u05e8\u05d4',
                        'shares': shares,
                        'change': change,
                        'date': txn_date,
                        'transactionCode': txn_code,
                    })

                if transactions:
                    purchases = sum(1 for t in transactions if t['type'] == 'purchase')
                    sales = sum(1 for t in transactions if t['type'] == 'sale')

                    if purchases > sales:
                        net_dir = 'buying'
                        net_dir_he = '\u05e8\u05db\u05d9\u05e9\u05d4 \u05e0\u05d8\u05d5'
                    elif sales > purchases:
                        net_dir = 'selling'
                        net_dir_he = '\u05de\u05db\u05d9\u05e8\u05d4 \u05e0\u05d8\u05d5'
                    else:
                        net_dir = 'neutral'
                        net_dir_he = '\u05de\u05d0\u05d5\u05d6\u05df'

                    insider_data[ticker] = {
                        'ticker': ticker,
                        'tickerName': TICKER_NAMES.get(ticker, ticker),
                        'recentTransactions': transactions[:5],
                        'netDirection': net_dir,
                        'netDirectionHe': net_dir_he,
                        'purchaseCount': purchases,
                        'saleCount': sales,
                        'transactionCount': len(transactions),
                        'periodDays': 90
                    }

            time.sleep(0.3)
        except Exception as e:
            print(f"    Error fetching insider for {ticker}: {e}")

    print(f"  Insider data: {len(insider_data)} tickers with activity")
    return insider_data


# === SOCIAL SENTIMENT ===

def fetch_stocktwits_sentiment(tickers):
    """Fetch StockTwits sentiment (free, no auth needed)."""
    print(f"  Fetching StockTwits sentiment for {len(tickers)} tickers...")
    social_data = {}

    for ticker in tickers:
        try:
            url = f"https://api.stocktwits.com/api/2/streams/symbol/{ticker}.json"
            data = make_request(url, timeout=10)

            if data and 'messages' in data:
                messages = data['messages']
                bullish = sum(1 for m in messages if m.get('entities', {}).get('sentiment', {}).get('basic') == 'Bullish')
                bearish = sum(1 for m in messages if m.get('entities', {}).get('sentiment', {}).get('basic') == 'Bearish')
                total = len(messages)

                if total > 0:
                    bullish_pct = round(bullish / max(bullish + bearish, 1) * 100) if (bullish + bearish) > 0 else 50
                    sentiment = 'bullish' if bullish_pct > 60 else ('bearish' if bullish_pct < 40 else 'neutral')
                    sentiment_he = {'bullish': '\u05e9\u05d5\u05e8\u05d9', 'bearish': '\u05d3\u05d5\u05d1\u05d9', 'neutral': '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'}[sentiment]

                    social_data[ticker] = {
                        'stocktwits': {
                            'bullishCount': bullish,
                            'bearishCount': bearish,
                            'totalMessages': total,
                            'bullishPct': bullish_pct,
                            'sentiment': sentiment,
                            'sentimentHe': sentiment_he
                        }
                    }

            time.sleep(0.5)  # Be polite with free API
        except Exception as e:
            print(f"    StockTwits error for {ticker}: {e}")

    print(f"  StockTwits: {len(social_data)} tickers with data")
    return social_data


def fetch_reddit_trending():
    """Fetch trending stock mentions from Reddit (public JSON API, no auth)."""
    print("  Fetching Reddit trending tickers...")
    ticker_mentions = {}
    subreddits = ['wallstreetbets', 'stocks', 'investing']

    for sub in subreddits:
        try:
            url = f"https://www.reddit.com/r/{sub}/hot.json?limit=25"
            headers = {'User-Agent': 'InvestmentDashboard/1.0'}
            data = make_request(url, headers=headers, timeout=10)

            if data and 'data' in data and 'children' in data['data']:
                for post in data['data']['children']:
                    post_data = post.get('data', {})
                    title = post_data.get('title', '')
                    selftext = post_data.get('selftext', '')[:500]
                    upvote_ratio = post_data.get('upvote_ratio', 0)
                    ups = post_data.get('ups', 0)
                    num_comments = post_data.get('num_comments', 0)

                    # Extract tickers from title and text
                    text = f"{title} {selftext}"
                    found_tickers = extract_tickers_from_text(text)

                    for t in found_tickers:
                        if t not in ticker_mentions:
                            ticker_mentions[t] = {
                                'mentions': 0,
                                'totalUpvotes': 0,
                                'totalComments': 0,
                                'avgUpvoteRatio': 0,
                                'subreddits': set(),
                                'ratios': []
                            }
                        ticker_mentions[t]['mentions'] += 1
                        ticker_mentions[t]['totalUpvotes'] += ups
                        ticker_mentions[t]['totalComments'] += num_comments
                        ticker_mentions[t]['subreddits'].add(sub)
                        ticker_mentions[t]['ratios'].append(upvote_ratio)

            time.sleep(1)  # Rate limit for Reddit
        except Exception as e:
            print(f"    Reddit error for r/{sub}: {e}")

    # Process results
    reddit_data = {}
    for ticker, data in ticker_mentions.items():
        avg_ratio = sum(data['ratios']) / len(data['ratios']) if data['ratios'] else 0
        trending = data['mentions'] >= 3 or data['totalUpvotes'] >= 1000

        reddit_data[ticker] = {
            'mentions': data['mentions'],
            'topSubreddits': list(data['subreddits']),
            'avgUpvoteRatio': round(avg_ratio, 2),
            'totalUpvotes': data['totalUpvotes'],
            'totalComments': data['totalComments'],
            'trending': trending,
            'trendingHe': '\u05d1\u05de\u05d2\u05de\u05d4' if trending else '\u05e8\u05d2\u05d9\u05dc'
        }

    print(f"  Reddit: {len(reddit_data)} tickers mentioned")
    return reddit_data


# === NLP & EVENT DETECTION ===

def analyze_sentiment(text):
    """Analyze sentiment of text using VADER (or simple fallback)."""
    if HAS_VADER and vader:
        scores = vader.polarity_scores(text)
        compound = scores['compound']
        if compound >= 0.05:
            label = 'positive'
            label_he = '\u05d7\u05d9\u05d5\u05d1\u05d9'
        elif compound <= -0.05:
            label = 'negative'
            label_he = '\u05e9\u05dc\u05d9\u05dc\u05d9'
        else:
            label = 'neutral'
            label_he = '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'
        return {
            'compound': round(compound, 3),
            'positive': round(scores['pos'], 3),
            'negative': round(scores['neg'], 3),
            'neutral': round(scores['neu'], 3),
            'label': label,
            'labelHe': label_he
        }
    else:
        # Simple fallback: keyword-based
        text_lower = text.lower()
        pos_words = ['surge', 'soar', 'jump', 'rally', 'beat', 'strong', 'record', 'upgrade', 'boom', 'profit', 'growth']
        neg_words = ['crash', 'plunge', 'drop', 'miss', 'weak', 'loss', 'decline', 'downgrade', 'fear', 'risk', 'cut']
        pos_count = sum(1 for w in pos_words if w in text_lower)
        neg_count = sum(1 for w in neg_words if w in text_lower)
        compound = (pos_count - neg_count) / max(pos_count + neg_count, 1) * 0.5
        if compound > 0.05:
            return {'compound': round(compound, 3), 'label': 'positive', 'labelHe': '\u05d7\u05d9\u05d5\u05d1\u05d9', 'positive': 0, 'negative': 0, 'neutral': 0}
        elif compound < -0.05:
            return {'compound': round(compound, 3), 'label': 'negative', 'labelHe': '\u05e9\u05dc\u05d9\u05dc\u05d9', 'positive': 0, 'negative': 0, 'neutral': 0}
        else:
            return {'compound': 0, 'label': 'neutral', 'labelHe': '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9', 'positive': 0, 'negative': 0, 'neutral': 0}


def extract_tickers_from_text(text):
    """Extract stock tickers from text using regex and known ticker list."""
    found = set()

    # Pattern 1: $TICKER format
    cashtags = re.findall(r'\$([A-Z]{1,5})\b', text)
    for tag in cashtags:
        if tag in ALL_KNOWN_TICKERS:
            found.add(tag)

    # Pattern 2: Known tickers as whole words (uppercase)
    words = re.findall(r'\b([A-Z]{2,5})\b', text)
    # Filter common false positives
    false_positives = {'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN',
                       'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'HAD', 'HOT', 'HAS',
                       'HIS', 'HOW', 'MAN', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO',
                       'OIL', 'DID', 'GET', 'LET', 'SAY', 'SHE', 'TOO', 'USE', 'CEO',
                       'CFO', 'IPO', 'ETF', 'SEC', 'GDP', 'CPI', 'FED', 'API', 'USA',
                       'GDP', 'FBI', 'CIA', 'NYSE', 'CEO', 'CTO', 'COO', 'ESG', 'FAQ',
                       'IMF', 'WHO', 'NATO', 'OPEC', 'NASA'}
    for word in words:
        if word in ALL_KNOWN_TICKERS and word not in false_positives:
            found.add(word)

    return found


def detect_event_categories(headline, body=''):
    """Classify news into event categories using keyword matching."""
    text = f"{headline} {body}".lower()
    detected = []

    for event_type, keywords in EVENT_KEYWORDS.items():
        matches = 0
        matched_keywords = []
        for kw in keywords:
            if kw.lower() in text:
                matches += 1
                matched_keywords.append(kw)

        if matches >= 1:
            # Confidence based on number of keyword matches
            if matches >= 3:
                confidence = 0.9
            elif matches >= 2:
                confidence = 0.7
            else:
                confidence = 0.5

            detected.append({
                'eventType': event_type,
                'confidence': confidence,
                'matchedKeywords': matched_keywords[:3]
            })

    # Sort by confidence
    detected.sort(key=lambda x: x['confidence'], reverse=True)
    return detected[:3]  # Max 3 event types per article


def map_event_to_stocks(event_type, mentioned_tickers=None):
    """Map event type to affected stocks with direction."""
    mapping = EVENT_SECTOR_MAP.get(event_type)
    if not mapping:
        return []

    affected = []

    # Sector-mapped tickers (bullish)
    for ticker in mapping.get('bullish_tickers', []):
        confidence = 0.7 if ticker in CORE_PORTFOLIO else 0.5
        # Boost if ticker was mentioned in the news
        if mentioned_tickers and ticker in mentioned_tickers:
            confidence = min(1.0, confidence + 0.2)

        affected.append({
            'ticker': ticker,
            'tickerName': TICKER_NAMES.get(ticker, ticker),
            'direction': 'bullish',
            'directionHe': '\u05e9\u05d5\u05e8\u05d9',
            'confidence': confidence,
            'source': 'mentioned' if (mentioned_tickers and ticker in mentioned_tickers) else 'sector_mapping'
        })

    # Sector-mapped tickers (bearish)
    for ticker in mapping.get('bearish_tickers', []):
        confidence = 0.6 if ticker in CORE_PORTFOLIO else 0.4
        if mentioned_tickers and ticker in mentioned_tickers:
            confidence = min(1.0, confidence + 0.2)

        affected.append({
            'ticker': ticker,
            'tickerName': TICKER_NAMES.get(ticker, ticker),
            'direction': 'bearish',
            'directionHe': '\u05d3\u05d5\u05d1\u05d9',
            'confidence': confidence,
            'source': 'mentioned' if (mentioned_tickers and ticker in mentioned_tickers) else 'sector_mapping'
        })

    # Add directly mentioned tickers not already in sector mapping
    if mentioned_tickers:
        mapped_tickers = set(a['ticker'] for a in affected)
        for ticker in mentioned_tickers:
            if ticker not in mapped_tickers and ticker in ALL_KNOWN_TICKERS:
                affected.append({
                    'ticker': ticker,
                    'tickerName': TICKER_NAMES.get(ticker, ticker),
                    'direction': 'unknown',
                    'directionHe': '\u05dc\u05d0 \u05d9\u05d3\u05d5\u05e2',
                    'confidence': 0.4,
                    'source': 'mentioned'
                })

    return affected


# === CONFIDENCE SCORING ===

def compute_recommendation_confidence(
    sentiment_score,
    source_count,
    insider_direction=None,
    social_bullish_pct=None,
    is_direct_mention=False
):
    """Compute composite confidence score (0-100).

    Weights:
    - Sentiment strength: 25%
    - Source corroboration: 25%
    - Insider alignment: 20%
    - Social sentiment: 15%
    - Sector correlation: 15%
    """
    score = 0

    # 1. Sentiment strength (25%)
    abs_sentiment = abs(sentiment_score) if sentiment_score else 0
    if abs_sentiment > 0.5:
        score += 25
    elif abs_sentiment > 0.3:
        score += 18
    elif abs_sentiment > 0.1:
        score += 10
    else:
        score += 5

    # 2. Source corroboration (25%)
    if source_count >= 3:
        score += 25
    elif source_count >= 2:
        score += 18
    elif source_count >= 1:
        score += 10

    # 3. Insider alignment (20%)
    if insider_direction == 'aligned':
        score += 20
    elif insider_direction == 'opposing':
        score += 0
    elif insider_direction is None:
        score += 10  # Neutral: no data

    # 4. Social sentiment alignment (15%)
    if social_bullish_pct is not None:
        if social_bullish_pct > 70:
            score += 15
        elif social_bullish_pct > 50:
            score += 10
        elif social_bullish_pct > 30:
            score += 5
    else:
        score += 7  # Neutral: no data

    # 5. Sector correlation / direct mention (15%)
    if is_direct_mention:
        score += 15
    else:
        score += 8  # Sector inference

    return min(100, max(0, score))


def generate_recommendation(confidence_score, direction, event_type):
    """Generate BUY/SELL/WATCH recommendation."""
    if confidence_score >= 70:
        if direction == 'bullish':
            action = 'BUY'
            action_he = '\u05e7\u05e0\u05d9\u05d9\u05d4'
        elif direction == 'bearish':
            action = 'SELL'
            action_he = '\u05de\u05db\u05d9\u05e8\u05d4'
        else:
            action = 'WATCH'
            action_he = '\u05e2\u05e7\u05d5\u05d1'
    elif confidence_score >= 40:
        action = 'WATCH'
        action_he = '\u05e2\u05e7\u05d5\u05d1'
    else:
        return None  # Below threshold

    if confidence_score >= 70:
        urgency = 'high'
        urgency_he = '\u05d2\u05d1\u05d5\u05d4\u05d4'
    elif confidence_score >= 55:
        urgency = 'medium'
        urgency_he = '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea'
    else:
        urgency = 'low'
        urgency_he = '\u05e0\u05de\u05d5\u05db\u05d4'

    confidence_level = 'high' if confidence_score >= 70 else ('medium' if confidence_score >= 50 else 'low')
    confidence_level_he = {'high': '\u05d2\u05d1\u05d5\u05d4\u05d4', 'medium': '\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9\u05ea', 'low': '\u05e0\u05de\u05d5\u05db\u05d4'}[confidence_level]

    return {
        'action': action,
        'actionHe': action_he,
        'confidence': {
            'score': confidence_score,
            'level': confidence_level,
            'levelHe': confidence_level_he
        },
        'urgency': urgency,
        'urgencyHe': urgency_he
    }


# === TELEGRAM ALERTS ===

def send_telegram_message(text, parse_mode='HTML'):
    """Send message via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False

    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = json.dumps({
            'chat_id': TELEGRAM_CHAT_ID,
            'text': text,
            'parse_mode': parse_mode,
            'disable_web_page_preview': True
        }).encode('utf-8')

        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return result.get('ok', False)
    except Exception as e:
        print(f"  Telegram error: {e}")
        return False


def format_telegram_alert(rec):
    """Format recommendation for Telegram message."""
    emoji_map = {'BUY': '\U0001f7e2', 'SELL': '\U0001f534', 'WATCH': '\U0001f7e1'}
    emoji = emoji_map.get(rec['action'], '\u26aa')

    msg = f"""<b>{emoji} \u05d4\u05ea\u05e8\u05d0\u05ea \u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df \u05d7\u05db\u05dd</b>

<b>\u05de\u05e0\u05d9\u05d4:</b> {rec['ticker']} ({rec.get('tickerName', '')})
<b>\u05d4\u05de\u05dc\u05e6\u05d4:</b> {rec['actionHe']} | \u05d1\u05d9\u05d8\u05d7\u05d5\u05df: {rec['confidence']['score']}%
<b>\u05d3\u05d7\u05d9\u05e4\u05d5\u05ea:</b> {rec['urgencyHe']}

<b>\u05e0\u05d9\u05de\u05d5\u05e7:</b>
{rec.get('reasonHe', '')}

<i>\u23f0 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>
<i>\U0001f4ca Investment Intelligence Dashboard</i>"""

    return msg


def format_telegram_summary(recommendations, summary):
    """Format daily summary for Telegram."""
    buys = [r for r in recommendations if r['action'] == 'BUY']
    sells = [r for r in recommendations if r['action'] == 'SELL']
    watches = [r for r in recommendations if r['action'] == 'WATCH']

    msg = f"""<b>\U0001f4cb \u05e1\u05d9\u05db\u05d5\u05dd \u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df \u05d9\u05d5\u05de\u05d9</b>
<b>\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501</b>

\U0001f50d \u05d0\u05d9\u05e8\u05d5\u05e2\u05d9\u05dd \u05e9\u05d6\u05d5\u05d4\u05d5: {summary['totalEventsDetected']}
\U0001f4ca \u05de\u05e6\u05d1 \u05e9\u05d5\u05e7: {summary['marketMoodHe']}

"""

    if buys:
        msg += "<b>\U0001f7e2 \u05d4\u05de\u05dc\u05e6\u05d5\u05ea \u05e7\u05e0\u05d9\u05d9\u05d4:</b>\n"
        for r in buys:
            msg += f"  \u2022 {r['ticker']} \u2014 \u05d1\u05d9\u05d8\u05d7\u05d5\u05df {r['confidence']['score']}%\n"
        msg += "\n"

    if sells:
        msg += "<b>\U0001f534 \u05d4\u05de\u05dc\u05e6\u05d5\u05ea \u05de\u05db\u05d9\u05e8\u05d4:</b>\n"
        for r in sells:
            msg += f"  \u2022 {r['ticker']} \u2014 \u05d1\u05d9\u05d8\u05d7\u05d5\u05df {r['confidence']['score']}%\n"
        msg += "\n"

    if watches:
        msg += f"<b>\U0001f7e1 \u05dc\u05e6\u05e4\u05d9\u05d9\u05d4:</b> {len(watches)} \u05de\u05e0\u05d9\u05d5\u05ea\n\n"

    msg += f"""<i>\u23f0 {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</i>
<i>\U0001f4ca Investment Intelligence Dashboard</i>"""

    return msg


def load_telegram_state():
    """Load Telegram deduplication state."""
    state_path = os.path.join(DATA_DIR, 'telegram-state.json')
    try:
        if os.path.exists(state_path):
            with open(state_path, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {'sentIds': [], 'lastSummary': ''}


def save_telegram_state(state):
    """Save Telegram deduplication state."""
    state_path = os.path.join(DATA_DIR, 'telegram-state.json')
    try:
        # Keep only last 200 sent IDs
        state['sentIds'] = state['sentIds'][-200:]
        with open(state_path, 'w') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"  Error saving telegram state: {e}")


# === GENERATE HEBREW REASONING ===

def generate_reason_he(event_type, ticker, direction, sentiment_label, source_count, insider_dir, social_pct):
    """Generate Hebrew reasoning text for a recommendation."""
    event_info = EVENT_SECTOR_MAP.get(event_type, {})
    category_he = event_info.get('categoryHe', event_type)

    parts = []

    # Event description
    if direction == 'bullish':
        parts.append(f"\u05d0\u05d9\u05e8\u05d5\u05e2 \u05de\u05e1\u05d5\u05d2 {category_he} \u05e6\u05e4\u05d5\u05d9 \u05dc\u05d4\u05e9\u05e4\u05d9\u05e2 \u05dc\u05d7\u05d9\u05d5\u05d1 \u05e2\u05dc {TICKER_NAMES.get(ticker, ticker)}.")
    elif direction == 'bearish':
        parts.append(f"\u05d0\u05d9\u05e8\u05d5\u05e2 \u05de\u05e1\u05d5\u05d2 {category_he} \u05e6\u05e4\u05d5\u05d9 \u05dc\u05d4\u05e9\u05e4\u05d9\u05e2 \u05dc\u05e9\u05dc\u05d9\u05dc\u05d4 \u05e2\u05dc {TICKER_NAMES.get(ticker, ticker)}.")
    else:
        parts.append(f"\u05d0\u05d9\u05e8\u05d5\u05e2 \u05de\u05e1\u05d5\u05d2 {category_he} \u05e2\u05e9\u05d5\u05d9 \u05dc\u05d4\u05e9\u05e4\u05d9\u05e2 \u05e2\u05dc {TICKER_NAMES.get(ticker, ticker)}.")

    # Source count
    if source_count >= 3:
        parts.append(f"{source_count} \u05de\u05e7\u05d5\u05e8\u05d5\u05ea \u05d7\u05d3\u05e9\u05d5\u05ea\u05d9\u05d9\u05dd \u05de\u05d3\u05d5\u05d5\u05d7\u05d9\u05dd.")
    elif source_count >= 2:
        parts.append(f"{source_count} \u05de\u05e7\u05d5\u05e8\u05d5\u05ea \u05de\u05d3\u05d5\u05d5\u05d7\u05d9\u05dd.")

    # Insider activity
    if insider_dir == 'buying':
        parts.append("\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05e8\u05db\u05d9\u05e9\u05d4 \u05e4\u05e0\u05d9\u05de\u05d9\u05ea \u05e9\u05dc \u05de\u05e0\u05d4\u05dc\u05d9\u05dd.")
    elif insider_dir == 'selling':
        parts.append("\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05de\u05db\u05d9\u05e8\u05d4 \u05e4\u05e0\u05d9\u05de\u05d9\u05ea \u05e9\u05dc \u05de\u05e0\u05d4\u05dc\u05d9\u05dd.")

    # Social sentiment
    if social_pct is not None:
        if social_pct > 70:
            parts.append(f"\u05e1\u05e0\u05d8\u05d9\u05de\u05e0\u05d8 \u05d7\u05d1\u05e8\u05ea\u05d9 \u05d7\u05d9\u05d5\u05d1\u05d9 ({social_pct}% \u05e9\u05d5\u05e8\u05d9\u05d9\u05dd).")
        elif social_pct < 30:
            parts.append(f"\u05e1\u05e0\u05d8\u05d9\u05de\u05e0\u05d8 \u05d7\u05d1\u05e8\u05ea\u05d9 \u05e9\u05dc\u05d9\u05dc\u05d9 ({social_pct}% \u05e9\u05d5\u05e8\u05d9\u05d9\u05dd).")

    return ' '.join(parts)


# === MAIN PIPELINE ===

def fetch_intelligence():
    """Main intelligence pipeline."""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    print("=" * 60)
    print("Smart Intelligence Pipeline")
    print(f"Started: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print("=" * 60)

    # === Step 1: Fetch News ===
    print("\n[1/7] Fetching news...")
    all_articles = []
    all_articles.extend(fetch_finnhub_general_news())
    all_articles.extend(fetch_finnhub_company_news(CORE_PORTFOLIO))
    all_articles.extend(fetch_marketaux_news(CORE_PORTFOLIO))
    print(f"  Total articles: {len(all_articles)}")

    # === Step 2: Analyze & Classify Articles ===
    print("\n[2/7] Analyzing articles...")
    events = []
    ticker_event_count = {}  # Track how many events mention each ticker
    event_sources = {}  # Track source corroboration per event type

    for article in all_articles:
        headline = article.get('headline', '')
        summary = article.get('summary', '')
        if not headline:
            continue

        # Sentiment analysis
        sentiment = analyze_sentiment(f"{headline} {summary}")

        # Extract tickers
        mentioned_tickers = extract_tickers_from_text(f"{headline} {summary}")

        # Also add the 'related' ticker if from company news
        related = article.get('related', '')
        if related:
            for t in related.split(','):
                t = t.strip().upper()
                if t in ALL_KNOWN_TICKERS:
                    mentioned_tickers.add(t)

        # Detect event categories
        detected_events = detect_event_categories(headline, summary)

        for evt in detected_events:
            event_type = evt['eventType']

            # Track source corroboration
            source_key = f"{event_type}"
            if source_key not in event_sources:
                event_sources[source_key] = set()
            event_sources[source_key].add(article.get('source', 'unknown'))

            # Map to affected stocks
            affected = map_event_to_stocks(event_type, mentioned_tickers)
            affected_tickers = [a['ticker'] for a in affected]

            # Track ticker event counts
            for t in affected_tickers:
                ticker_event_count[t] = ticker_event_count.get(t, 0) + 1

            event_info = EVENT_SECTOR_MAP.get(event_type, {})

            event_obj = {
                'id': generate_event_id(event_type, headline, article.get('publishedAt', now_iso)),
                'category': event_type,
                'categoryHe': event_info.get('categoryHe', event_type),
                'icon': event_info.get('icon', '\U0001f4f0'),
                'headline': headline,
                'source': article.get('source', 'Unknown'),
                'sourceUrl': article.get('url', ''),
                'publishedAt': article.get('publishedAt', now_iso),
                'sentiment': sentiment,
                'affectedTickers': affected_tickers[:10],
                'eventConfidence': evt['confidence'],
                'matchedKeywords': evt.get('matchedKeywords', []),
                'eventSeverity': 'high' if evt['confidence'] >= 0.8 else ('medium' if evt['confidence'] >= 0.5 else 'low'),
                'eventSeverityHe': '\u05d2\u05d1\u05d5\u05d4' if evt['confidence'] >= 0.8 else ('\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9' if evt['confidence'] >= 0.5 else '\u05e0\u05de\u05d5\u05da'),
            }

            events.append(event_obj)

    # Deduplicate events by ID
    seen_ids = set()
    unique_events = []
    for evt in events:
        if evt['id'] not in seen_ids:
            seen_ids.add(evt['id'])
            unique_events.append(evt)
    events = unique_events

    print(f"  Events detected: {len(events)}")
    print(f"  Tickers with events: {len(ticker_event_count)}")

    # === Step 3: Fetch Insider Trading for event-related tickers ===
    print("\n[3/7] Fetching insider trading data...")
    top_event_tickers = sorted(ticker_event_count.keys(), key=lambda t: ticker_event_count[t], reverse=True)[:25]
    # Prioritize core portfolio
    insider_tickers = list(set(CORE_PORTFOLIO + top_event_tickers[:15]))
    insider_data = fetch_insider_transactions(insider_tickers)

    # === Step 4: Fetch Social Sentiment ===
    print("\n[4/7] Fetching social sentiment...")
    social_tickers = list(set(CORE_PORTFOLIO + top_event_tickers[:10]))[:20]
    stocktwits_data = fetch_stocktwits_sentiment(social_tickers)
    reddit_data = fetch_reddit_trending()

    # Merge social data
    social_pulse = {}
    all_social_tickers = set(list(stocktwits_data.keys()) + list(reddit_data.keys()))
    for ticker in all_social_tickers:
        social_pulse[ticker] = {
            'ticker': ticker,
            'tickerName': TICKER_NAMES.get(ticker, ticker),
            'stocktwits': stocktwits_data.get(ticker, {}).get('stocktwits', {
                'bullishCount': 0, 'bearishCount': 0, 'totalMessages': 0,
                'bullishPct': 50, 'sentiment': 'neutral', 'sentimentHe': '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'
            }),
            'reddit': reddit_data.get(ticker, {
                'mentions': 0, 'topSubreddits': [], 'avgUpvoteRatio': 0,
                'trending': False, 'trendingHe': '\u05e8\u05d2\u05d9\u05dc'
            })
        }

    # === Step 5: Generate Recommendations ===
    print("\n[5/7] Generating recommendations...")
    recommendations = []
    processed_tickers = set()

    # Group events by affected ticker
    ticker_events = {}
    for evt in events:
        for ticker in evt.get('affectedTickers', []):
            if ticker not in ticker_events:
                ticker_events[ticker] = []
            ticker_events[ticker].append(evt)

    for ticker, ticker_evts in ticker_events.items():
        if ticker in processed_tickers:
            continue
        processed_tickers.add(ticker)

        # Determine dominant direction from events
        bullish_count = 0
        bearish_count = 0
        total_sentiment = 0
        source_count = 0
        trigger_event_ids = []
        primary_event_type = None
        max_event_confidence = 0

        for evt in ticker_evts:
            sentiment = evt.get('sentiment', {}).get('compound', 0)
            total_sentiment += sentiment
            source_count += 1
            trigger_event_ids.append(evt['id'])

            # Determine direction from event mapping
            event_mapping = EVENT_SECTOR_MAP.get(evt['category'], {})
            if ticker in event_mapping.get('bullish_tickers', []):
                bullish_count += 1
            elif ticker in event_mapping.get('bearish_tickers', []):
                bearish_count += 1
            elif sentiment > 0:
                bullish_count += 1
            elif sentiment < 0:
                bearish_count += 1

            if evt.get('eventConfidence', 0) > max_event_confidence:
                max_event_confidence = evt['eventConfidence']
                primary_event_type = evt['category']

        if not primary_event_type:
            continue

        # Determine direction
        if bullish_count > bearish_count:
            direction = 'bullish'
        elif bearish_count > bullish_count:
            direction = 'bearish'
        else:
            direction = 'neutral'

        avg_sentiment = total_sentiment / max(source_count, 1)

        # Check insider alignment
        insider = insider_data.get(ticker)
        insider_direction = None
        if insider:
            if insider['netDirection'] == 'buying' and direction == 'bullish':
                insider_direction = 'aligned'
            elif insider['netDirection'] == 'selling' and direction == 'bearish':
                insider_direction = 'aligned'
            elif insider['netDirection'] == 'buying' and direction == 'bearish':
                insider_direction = 'opposing'
            elif insider['netDirection'] == 'selling' and direction == 'bullish':
                insider_direction = 'opposing'

        # Check social sentiment
        social = social_pulse.get(ticker, {})
        st_data = social.get('stocktwits', {})
        social_bullish_pct = st_data.get('bullishPct') if st_data.get('totalMessages', 0) > 3 else None

        # Is this a direct mention in news?
        is_direct = any(
            ticker in evt.get('matchedKeywords', []) or
            evt.get('source', '') == 'finnhub_company'
            for evt in ticker_evts
        )

        # Compute confidence
        confidence_score = compute_recommendation_confidence(
            sentiment_score=avg_sentiment,
            source_count=source_count,
            insider_direction=insider_direction,
            social_bullish_pct=social_bullish_pct,
            is_direct_mention=is_direct
        )

        # Generate recommendation
        rec = generate_recommendation(confidence_score, direction, primary_event_type)
        if rec is None:
            continue

        # Generate Hebrew reasoning
        insider_dir_str = insider['netDirection'] if insider else None
        reason_he = generate_reason_he(
            primary_event_type, ticker, direction, 'positive' if avg_sentiment > 0 else 'negative',
            source_count, insider_dir_str, social_bullish_pct
        )

        rec_obj = {
            'id': generate_rec_id(ticker, rec['action'], now_iso),
            'ticker': ticker,
            'tickerName': TICKER_NAMES.get(ticker, ticker),
            'action': rec['action'],
            'actionHe': rec['actionHe'],
            'confidence': rec['confidence'],
            'urgency': rec['urgency'],
            'urgencyHe': rec['urgencyHe'],
            'direction': direction,
            'directionHe': {'bullish': '\u05e9\u05d5\u05e8\u05d9', 'bearish': '\u05d3\u05d5\u05d1\u05d9', 'neutral': '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'}.get(direction, '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'),
            'reasonHe': reason_he,
            'triggerEvents': trigger_event_ids[:5],
            'primaryEventType': primary_event_type,
            'primaryEventIcon': EVENT_SECTOR_MAP.get(primary_event_type, {}).get('icon', '\U0001f4f0'),
            'supportingData': {
                'newsSourceCount': source_count,
                'avgSentimentScore': round(avg_sentiment, 3),
                'insiderActivity': insider_dir_str,
                'socialBullishPct': social_bullish_pct,
                'isDirectMention': is_direct,
                'eventConfidence': round(max_event_confidence, 2)
            },
            'timestamp': now_iso,
            'expiresAt': (now + timedelta(hours=24)).isoformat()
        }

        recommendations.append(rec_obj)

    # Sort by confidence score descending
    recommendations.sort(key=lambda r: r['confidence']['score'], reverse=True)
    print(f"  Recommendations: {len(recommendations)}")

    # === Step 6: Trending Tickers ===
    print("\n[6/7] Computing trending tickers...")
    trending_tickers = []
    for ticker, data in reddit_data.items():
        if data.get('trending') or data.get('mentions', 0) >= 3:
            trending_tickers.append({
                'ticker': ticker,
                'tickerName': TICKER_NAMES.get(ticker, ticker),
                'reason': f"Reddit mentions: {data['mentions']}, upvotes: {data.get('totalUpvotes', 0)}",
                'reasonHe': f"\u05d0\u05d6\u05db\u05d5\u05e8\u05d9\u05dd \u05d1\u05e8\u05d3\u05d9\u05d8: {data['mentions']}, \u05d4\u05e6\u05d1\u05e2\u05d5\u05ea: {data.get('totalUpvotes', 0)}",
                'mentionCount': data['mentions'],
                'detectedAt': now_iso
            })

    # Also add tickers with high StockTwits volume
    for ticker, data in stocktwits_data.items():
        st = data.get('stocktwits', {})
        if st.get('totalMessages', 0) >= 20:
            existing = [t['ticker'] for t in trending_tickers]
            if ticker not in existing:
                trending_tickers.append({
                    'ticker': ticker,
                    'tickerName': TICKER_NAMES.get(ticker, ticker),
                    'reason': f"High StockTwits volume: {st['totalMessages']} messages",
                    'reasonHe': f"\u05e0\u05e4\u05d7 \u05d2\u05d1\u05d5\u05d4 \u05d1\u05e1\u05d8\u05d5\u05e7\u05d8\u05d5\u05d5\u05d9\u05d8\u05e1: {st['totalMessages']} \u05d4\u05d5\u05d3\u05e2\u05d5\u05ea",
                    'mentionCount': st['totalMessages'],
                    'detectedAt': now_iso
                })

    trending_tickers.sort(key=lambda t: t['mentionCount'], reverse=True)
    trending_tickers = trending_tickers[:15]

    # === Summary ===
    buy_recs = [r for r in recommendations if r['action'] == 'BUY']
    sell_recs = [r for r in recommendations if r['action'] == 'SELL']
    watch_recs = [r for r in recommendations if r['action'] == 'WATCH']

    # Determine market mood from events
    total_sentiment = sum(e.get('sentiment', {}).get('compound', 0) for e in events)
    if len(events) > 0:
        avg_market_sentiment = total_sentiment / len(events)
    else:
        avg_market_sentiment = 0

    if avg_market_sentiment > 0.15:
        market_mood = 'bullish'
        market_mood_he = '\u05d0\u05d5\u05e4\u05d8\u05d9\u05de\u05d9'
    elif avg_market_sentiment < -0.15:
        market_mood = 'bearish'
        market_mood_he = '\u05e4\u05e1\u05d9\u05de\u05d9'
    elif len(sell_recs) > len(buy_recs):
        market_mood = 'cautious'
        market_mood_he = '\u05d6\u05d4\u05d9\u05e8'
    else:
        market_mood = 'neutral'
        market_mood_he = '\u05e0\u05d9\u05d8\u05e8\u05d0\u05dc\u05d9'

    # Top event category
    event_type_counts = {}
    for evt in events:
        cat = evt['category']
        event_type_counts[cat] = event_type_counts.get(cat, 0) + 1
    top_event = max(event_type_counts, key=event_type_counts.get) if event_type_counts else 'none'
    top_event_he = EVENT_SECTOR_MAP.get(top_event, {}).get('categoryHe', '\u05d0\u05d9\u05df')

    summary = {
        'totalEventsDetected': len(events),
        'buyRecommendations': len(buy_recs),
        'sellRecommendations': len(sell_recs),
        'watchRecommendations': len(watch_recs),
        'highConfidenceCount': sum(1 for r in recommendations if r['confidence']['score'] >= 70),
        'topEvent': top_event,
        'topEventHe': top_event_he,
        'marketMood': market_mood,
        'marketMoodHe': market_mood_he,
        'avgMarketSentiment': round(avg_market_sentiment, 3)
    }

    # === Step 7: Send Telegram Alerts ===
    print("\n[7/7] Sending Telegram alerts...")
    tg_state = load_telegram_state()
    sent_count = 0

    # Send high-confidence BUY/SELL individually
    for rec in recommendations:
        if rec['confidence']['score'] >= 70 and rec['action'] in ('BUY', 'SELL'):
            if rec['id'] not in tg_state.get('sentIds', []):
                msg = format_telegram_alert(rec)
                if send_telegram_message(msg):
                    tg_state.setdefault('sentIds', []).append(rec['id'])
                    sent_count += 1
                    time.sleep(0.5)

    # Send daily summary
    today_str = now.strftime('%Y-%m-%d')
    if tg_state.get('lastSummary') != today_str and recommendations:
        msg = format_telegram_summary(recommendations, summary)
        if send_telegram_message(msg):
            tg_state['lastSummary'] = today_str
            sent_count += 1

    save_telegram_state(tg_state)
    print(f"  Telegram messages sent: {sent_count}")

    # === Write intelligence.json ===
    print("\nWriting intelligence.json...")
    intelligence_data = {
        'lastUpdated': now_iso,
        'runId': f"intel-{now.strftime('%Y%m%d-%H%M')}",
        'status': 'success',
        'events': events[:50],  # Limit to 50 most recent
        'recommendations': recommendations,
        'insiderActivity': list(insider_data.values()),
        'socialPulse': list(social_pulse.values())[:20],
        'trendingTickers': trending_tickers,
        'summary': summary
    }

    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, 'intelligence.json')
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(intelligence_data, f, ensure_ascii=False, indent=2)
    print(f"Written: {filepath}")

    # === Merge high-confidence alerts into alerts.json ===
    print("Merging intelligence alerts into alerts.json...")
    try:
        alerts_path = os.path.join(DATA_DIR, 'alerts.json')
        if os.path.exists(alerts_path):
            with open(alerts_path, 'r', encoding='utf-8') as f:
                alerts_data = json.load(f)
        else:
            alerts_data = {'lastUpdated': now_iso, 'activeAlerts': [], 'alertHistory': []}

        # Add high-confidence intelligence alerts
        for rec in recommendations:
            if rec['confidence']['score'] >= 60:
                alert_type = f"intelligence_{rec['action'].lower()}"
                severity_map = {'BUY': 'opportunity', 'SELL': 'danger', 'WATCH': 'info'}
                alert_id = f"intel-{rec['ticker'].lower()}-{rec['action'].lower()}-{now.strftime('%Y%m%d')}"

                # Check if already exists
                existing_ids = [a['id'] for a in alerts_data.get('activeAlerts', [])]
                if alert_id not in existing_ids:
                    alerts_data['activeAlerts'].append({
                        'id': alert_id,
                        'ticker': rec['ticker'],
                        'type': alert_type,
                        'severity': severity_map.get(rec['action'], 'info'),
                        'titleHe': f"\U0001f9e0 {rec['tickerName']} \u2014 {rec['actionHe']} (\u05d1\u05d9\u05d8\u05d7\u05d5\u05df {rec['confidence']['score']}%)",
                        'messageHe': rec['reasonHe'],
                        'value': rec['confidence']['score'],
                        'threshold': 60,
                        'timestamp': now_iso,
                        'dismissed': False
                    })

        alerts_data['lastUpdated'] = now_iso
        with open(alerts_path, 'w', encoding='utf-8') as f:
            json.dump(alerts_data, f, ensure_ascii=False, indent=2)
        print(f"  Updated: {alerts_path}")
    except Exception as e:
        print(f"  Error merging alerts: {e}")

    print(f"\n{'=' * 60}")
    print(f"Intelligence pipeline complete!")
    print(f"Events: {len(events)} | Recommendations: {len(recommendations)} | Telegram: {sent_count}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    fetch_intelligence()
