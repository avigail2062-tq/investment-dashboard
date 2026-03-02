#!/usr/bin/env python3
"""
Market Data Pipeline for Investment Dashboard
Fetches stock prices, computes technicals, generates alerts and short-term signals.
Outputs: market-data.json, alerts.json, short-term.json
"""

import yfinance as yf
import pandas as pd
import json
import os
import time
from datetime import datetime, timezone

# === CONFIGURATION ===

TICKERS = ['NVDA', 'AVGO', 'LMT', 'RTX', 'NOC', 'CRWD', 'CEG', 'XOM', 'NEM', 'AMD']

PORTFOLIO = {
    'NVDA': {'allocation': 5400, 'percent': 12, 'sector': 'ai', 'sectorHe': 'AI / מוליכים למחצה', 'name': 'NVIDIA'},
    'AVGO': {'allocation': 4050, 'percent': 9, 'sector': 'ai', 'sectorHe': 'AI Infrastructure', 'name': 'Broadcom'},
    'LMT':  {'allocation': 4500, 'percent': 10, 'sector': 'defense', 'sectorHe': 'ביטחון / הגנה', 'name': 'Lockheed Martin'},
    'RTX':  {'allocation': 3600, 'percent': 8, 'sector': 'defense', 'sectorHe': 'ביטחון + אווירונאוטיקה', 'name': 'RTX Corporation'},
    'NOC':  {'allocation': 3150, 'percent': 7, 'sector': 'defense', 'sectorHe': 'ביטחון מתקדם', 'name': 'Northrop Grumman'},
    'CRWD': {'allocation': 3600, 'percent': 8, 'sector': 'cyber', 'sectorHe': 'סייבר', 'name': 'CrowdStrike'},
    'CEG':  {'allocation': 3150, 'percent': 7, 'sector': 'energy', 'sectorHe': 'אנרגיה גרעינית', 'name': 'Constellation Energy'},
    'XOM':  {'allocation': 2700, 'percent': 6, 'sector': 'energy', 'sectorHe': 'אנרגיה / נפט', 'name': 'Exxon Mobil'},
    'NEM':  {'allocation': 2700, 'percent': 6, 'sector': 'gold', 'sectorHe': 'זהב / כרייה', 'name': 'Newmont Corporation'},
    'AMD':  {'allocation': 2700, 'percent': 6, 'sector': 'ai', 'sectorHe': 'מוליכים למחצה', 'name': 'AMD'},
}

INDEX_TICKERS = {
    '^GSPC': 'sp500',
    '^VIX': 'vix',
    'GC=F': 'gold',
    'CL=F': 'wti',
    'BZ=F': 'brent'
}

ALERT_THRESHOLDS = {
    'price_drop_pct': 5.0,
    'price_surge_pct': 8.0,
    'rsi_overbought': 70,
    'rsi_oversold': 30,
    'volume_spike_multiplier': 2.5,
}

ALERT_MESSAGES = {
    'price_drop': {'severity': 'danger', 'titleHe': '{ticker} — ירידת מחיר חריגה', 'messageHe': '{ticker} ירדה {value}% היום. בדוק את הסיבה ושקול פעולה.'},
    'price_surge': {'severity': 'info', 'titleHe': '{ticker} — עלייה חדה', 'messageHe': '{ticker} עלתה {value}% היום. שקול לקחת רווחים חלקיים.'},
    'rsi_overbought': {'severity': 'warning', 'titleHe': '{ticker} — RSI באזור קניית יתר', 'messageHe': 'RSI ב-{value} — אזור קניית יתר. שקול לקחת רווחים חלקיים.'},
    'rsi_oversold': {'severity': 'opportunity', 'titleHe': '{ticker} — RSI באזור מכירת יתר', 'messageHe': 'RSI ב-{value} — אזור מכירת יתר. הזדמנות קנייה אפשרית.'},
    'ma_crossover_bullish': {'severity': 'info', 'titleHe': '{ticker} — חציית ממוצעים שורית', 'messageHe': 'SMA20 חצה מעל SMA50 — סימן שורי. שקול הגדלת פוזיציה.'},
    'ma_crossover_bearish': {'severity': 'warning', 'titleHe': '{ticker} — חציית ממוצעים דובית', 'messageHe': 'SMA20 חצה מתחת SMA50 — סימן דובי. שקול צמצום פוזיציה.'},
    'volume_spike': {'severity': 'info', 'titleHe': '{ticker} — נפח מסחר חריג', 'messageHe': 'נפח מסחר גבוה פי {value} מהממוצע. עקוב אחרי התפתחויות.'},
}

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')


# === TECHNICAL ANALYSIS ===

def calculate_rsi(series, period=14):
    """Wilder's RSI calculation."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()

    # Wilder's smoothing
    for i in range(period, len(series)):
        if pd.notna(avg_gain.iloc[i-1]):
            avg_gain.iloc[i] = (avg_gain.iloc[i-1] * (period - 1) + gain.iloc[i]) / period
            avg_loss.iloc[i] = (avg_loss.iloc[i-1] * (period - 1) + loss.iloc[i]) / period

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(series, fast=12, slow=26, signal=9):
    """MACD with signal line and histogram."""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calculate_technicals(df):
    """Add all technical indicators to dataframe."""
    close = df['Close']

    # Moving Averages
    df['sma20'] = close.rolling(20).mean()
    df['sma50'] = close.rolling(50).mean()
    df['sma200'] = close.rolling(200).mean()
    df['ema12'] = close.ewm(span=12, adjust=False).mean()
    df['ema26'] = close.ewm(span=26, adjust=False).mean()

    # RSI
    df['rsi14'] = calculate_rsi(close, 14)

    # MACD
    df['macd_line'], df['macd_signal'], df['macd_histogram'] = calculate_macd(close)

    # Volume
    df['volume_sma20'] = df['Volume'].rolling(20).mean()
    df['volume_ratio'] = df['Volume'] / df['volume_sma20']

    return df


# === ALERT DETECTION ===

def detect_alerts(ticker, df):
    """Detect alert conditions for a ticker."""
    alerts = []
    if len(df) < 2:
        return alerts

    latest = df.iloc[-1]
    prev = df.iloc[-2]
    now = datetime.now(timezone.utc).isoformat()
    date_str = datetime.now(timezone.utc).strftime('%Y%m%d')

    # Daily change
    daily_change_pct = (latest['Close'] - prev['Close']) / prev['Close'] * 100

    # Price drop
    if daily_change_pct < -ALERT_THRESHOLDS['price_drop_pct']:
        alerts.append(make_alert(ticker, 'price_drop', round(daily_change_pct, 2), now, date_str))

    # Price surge
    if daily_change_pct > ALERT_THRESHOLDS['price_surge_pct']:
        alerts.append(make_alert(ticker, 'price_surge', round(daily_change_pct, 2), now, date_str))

    # RSI
    rsi = latest.get('rsi14')
    if pd.notna(rsi):
        if rsi > ALERT_THRESHOLDS['rsi_overbought']:
            alerts.append(make_alert(ticker, 'rsi_overbought', round(rsi, 1), now, date_str))
        elif rsi < ALERT_THRESHOLDS['rsi_oversold']:
            alerts.append(make_alert(ticker, 'rsi_oversold', round(rsi, 1), now, date_str))

    # MA Crossover
    if len(df) >= 3:
        curr_sma20 = latest.get('sma20')
        curr_sma50 = latest.get('sma50')
        prev_sma20 = prev.get('sma20')
        prev_sma50 = prev.get('sma50')
        if all(pd.notna(v) for v in [curr_sma20, curr_sma50, prev_sma20, prev_sma50]):
            if prev_sma20 < prev_sma50 and curr_sma20 > curr_sma50:
                alerts.append(make_alert(ticker, 'ma_crossover_bullish', None, now, date_str))
            elif prev_sma20 > prev_sma50 and curr_sma20 < curr_sma50:
                alerts.append(make_alert(ticker, 'ma_crossover_bearish', None, now, date_str))

    # Volume spike
    vol_ratio = latest.get('volume_ratio')
    if pd.notna(vol_ratio) and vol_ratio > ALERT_THRESHOLDS['volume_spike_multiplier']:
        alerts.append(make_alert(ticker, 'volume_spike', round(vol_ratio, 2), now, date_str))

    return alerts


def make_alert(ticker, alert_type, value, timestamp, date_str):
    """Create an alert object."""
    template = ALERT_MESSAGES[alert_type]
    value_str = str(abs(value)) if value is not None else ''
    return {
        'id': f'alert-{ticker.lower()}-{alert_type}-{date_str}',
        'ticker': ticker,
        'type': alert_type,
        'severity': template['severity'],
        'titleHe': template['titleHe'].format(ticker=ticker, value=value_str),
        'messageHe': template['messageHe'].format(ticker=ticker, value=value_str),
        'value': value,
        'threshold': ALERT_THRESHOLDS.get(alert_type.replace('ma_crossover_bullish', '').replace('ma_crossover_bearish', ''), None),
        'timestamp': timestamp,
        'dismissed': False
    }


# === SHORT-TERM SIGNALS ===

def compute_momentum_score(row):
    """Returns momentum score 1 (very bearish) to 10 (very bullish)."""
    score = 5.0

    # Factor 1: RSI (30%)
    rsi = row.get('rsi14')
    if pd.notna(rsi):
        if rsi > 70:
            score += (rsi - 70) / 30 * -1.5
        elif rsi < 30:
            score += (30 - rsi) / 30 * 1.5
        elif rsi > 50:
            score += (rsi - 50) / 20 * 0.8
        else:
            score += (50 - rsi) / 20 * -0.8

    # Factor 2: MACD histogram (30%)
    hist = row.get('macd_histogram', 0)
    if pd.notna(hist):
        if hist > 0:
            score += min(1.5, hist * 5)
        else:
            score += max(-1.5, hist * 5)

    # Factor 3: Price vs SMA20 (20%)
    sma20 = row.get('sma20')
    if pd.notna(sma20) and sma20 > 0:
        if row['Close'] > sma20:
            score += 1.0
        else:
            score -= 1.0

    # Factor 4: Volume confirmation (20%)
    vol_ratio = row.get('volume_ratio', 1)
    if pd.notna(vol_ratio) and vol_ratio > 1.5:
        if pd.notna(sma20) and row['Close'] > sma20:
            score += 0.5
        else:
            score -= 0.5

    return max(1, min(10, round(score)))


def generate_signal(momentum_score, rsi):
    """Generate BUY/SELL/HOLD signal."""
    if pd.isna(rsi):
        return 'HOLD'
    if momentum_score >= 7 and rsi < 70:
        return 'BUY'
    elif momentum_score <= 3 and rsi > 30:
        return 'SELL'
    return 'HOLD'


def interpret_rsi(rsi):
    if pd.isna(rsi):
        return 'neutral', 'ניטראלי'
    if rsi > 70:
        return 'overbought', 'קניית יתר'
    elif rsi > 60:
        return 'bullish', 'שורי'
    elif rsi > 40:
        return 'neutral', 'ניטראלי'
    elif rsi > 30:
        return 'bearish', 'דובי'
    else:
        return 'oversold', 'מכירת יתר'


def interpret_macd(histogram, prev_histogram):
    if pd.isna(histogram):
        return 'neutral', 'ניטראלי', False
    crossover = False
    if pd.notna(prev_histogram):
        if (histogram > 0 and prev_histogram < 0) or (histogram < 0 and prev_histogram > 0):
            crossover = True
    if histogram > 0:
        return 'bullish', 'שורי', crossover
    elif histogram < 0:
        return 'bearish', 'דובי', crossover
    return 'neutral', 'ניטראלי', crossover


def generate_short_term_data(ticker, df):
    """Generate short-term signal data for a ticker."""
    if len(df) < 20:
        return None

    latest = df.iloc[-1]
    prev = df.iloc[-2] if len(df) >= 2 else latest

    rsi = latest.get('rsi14')
    momentum = compute_momentum_score(latest)
    signal = generate_signal(momentum, rsi)

    signal_he = {'BUY': 'קנייה', 'SELL': 'מכירה', 'HOLD': 'החזק'}.get(signal, 'החזק')
    confidence_map = {(7,8): ('medium', 'בינונית'), (8,10): ('high', 'גבוהה'), (1,3): ('medium', 'בינונית'), (3,4): ('low', 'נמוכה')}
    confidence = 'medium'
    confidence_he = 'בינונית'
    if momentum >= 8:
        confidence, confidence_he = 'high', 'גבוהה'
    elif momentum <= 2:
        confidence, confidence_he = 'high', 'גבוהה'
    elif 4 <= momentum <= 6:
        confidence, confidence_he = 'low', 'נמוכה'

    rsi_interp, rsi_interp_he = interpret_rsi(rsi)
    macd_trend, macd_trend_he, macd_crossover = interpret_macd(
        latest.get('macd_histogram'),
        prev.get('macd_histogram')
    )

    # Support/Resistance from recent 20 days
    recent = df.tail(20)
    support = float(recent['Low'].min()) if len(recent) > 0 else float(latest['Close'] * 0.97)
    resistance = float(recent['High'].max()) if len(recent) > 0 else float(latest['Close'] * 1.03)
    price = float(latest['Close'])

    # Price vs MAs
    sma20 = latest.get('sma20')
    sma50 = latest.get('sma50')
    price_vs_sma20 = 'above' if pd.notna(sma20) and price > sma20 else 'below'
    price_vs_sma50 = 'above' if pd.notna(sma50) and price > sma50 else 'below'
    sma20_vs_sma50 = 'above' if pd.notna(sma20) and pd.notna(sma50) and sma20 > sma50 else 'below'

    ma_trend = 'bullish' if price_vs_sma20 == 'above' and sma20_vs_sma50 == 'above' else ('bearish' if price_vs_sma20 == 'below' and sma20_vs_sma50 == 'below' else 'neutral')
    ma_trend_he = {'bullish': 'שורי', 'bearish': 'דובי', 'neutral': 'ניטראלי'}[ma_trend]

    vol_ratio = latest.get('volume_ratio', 1)
    vol_trend = 'high' if pd.notna(vol_ratio) and vol_ratio > 1.5 else ('low' if pd.notna(vol_ratio) and vol_ratio < 0.7 else 'normal')
    vol_trend_he = {'high': 'גבוה', 'low': 'נמוך', 'normal': 'רגיל'}[vol_trend]

    # Day trade idea
    atr = float(recent['High'].mean() - recent['Low'].mean()) if len(recent) > 0 else price * 0.02
    day_entry = round(price - atr * 0.3, 2)
    day_target = round(price + atr * 0.7, 2)
    day_stop = round(price - atr * 0.8, 2)
    day_rr = round((day_target - day_entry) / (day_entry - day_stop), 2) if (day_entry - day_stop) > 0 else 0

    # Swing trade idea
    swing_entry = round(price - atr * 0.5, 2)
    swing_target = round(price + atr * 2.5, 2)
    swing_stop = round(price - atr * 1.5, 2)
    swing_rr = round((swing_target - swing_entry) / (swing_entry - swing_stop), 2) if (swing_entry - swing_stop) > 0 else 0

    return {
        'ticker': ticker,
        'signal': signal,
        'signalHe': signal_he,
        'momentumScore': momentum,
        'confidence': confidence,
        'confidenceHe': confidence_he,
        'analysis': {
            'rsi': {
                'value': round(float(rsi), 1) if pd.notna(rsi) else None,
                'interpretation': rsi_interp,
                'interpretationHe': rsi_interp_he
            },
            'macd': {
                'histogram': round(float(latest.get('macd_histogram', 0)), 3) if pd.notna(latest.get('macd_histogram')) else 0,
                'trend': macd_trend,
                'trendHe': macd_trend_he,
                'crossover': macd_crossover
            },
            'movingAverages': {
                'priceVsSma20': price_vs_sma20,
                'priceVsSma50': price_vs_sma50,
                'sma20VsSma50': sma20_vs_sma50,
                'trend': ma_trend,
                'trendHe': ma_trend_he
            },
            'volume': {
                'ratio': round(float(vol_ratio), 2) if pd.notna(vol_ratio) else 1.0,
                'trend': vol_trend,
                'trendHe': vol_trend_he
            }
        },
        'support': round(support, 2),
        'resistance': round(resistance, 2),
        'dayTradeIdea': {
            'entry': day_entry,
            'target': day_target,
            'stopLoss': day_stop,
            'riskRewardRatio': day_rr
        },
        'swingTradeIdea': {
            'entry': swing_entry,
            'target': swing_target,
            'stopLoss': swing_stop,
            'timeframeHe': '5-10 ימי מסחר',
            'riskRewardRatio': swing_rr
        }
    }


# === MAIN PIPELINE ===

def safe_float(val):
    """Safely convert to float."""
    try:
        if pd.isna(val):
            return None
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None


def fetch_all_data():
    """Main pipeline: fetch, compute, write."""
    now = datetime.now(timezone.utc).isoformat()

    # === Fetch Macro Data ===
    print("Fetching macro data...")
    macro = {}
    for yticker, name in INDEX_TICKERS.items():
        try:
            t = yf.Ticker(yticker)
            hist = t.history(period='5d')
            if len(hist) >= 2:
                latest_price = float(hist['Close'].iloc[-1])
                prev_price = float(hist['Close'].iloc[-2])
                change = latest_price - prev_price
                change_pct = (change / prev_price) * 100
                macro[name] = {
                    'price': round(latest_price, 2),
                    'change': round(change, 2),
                    'changePct': round(change_pct, 2)
                }
            time.sleep(0.5)
        except Exception as e:
            print(f"Warning: Failed to fetch {yticker}: {e}")
            macro[name] = {'price': 0, 'change': 0, 'changePct': 0}

    # === Fetch Stock Data ===
    print("Fetching stock data...")
    stocks_data = {}
    all_alerts = []
    all_signals = []
    total_current_value = 0
    total_invested = sum(p['allocation'] for p in PORTFOLIO.values())

    for ticker in TICKERS:
        try:
            print(f"  Processing {ticker}...")
            t = yf.Ticker(ticker)

            # Get 1 year of data for SMA200
            df = t.history(period='1y')
            if len(df) < 5:
                print(f"  Warning: Not enough data for {ticker}")
                continue

            # Calculate technicals
            df = calculate_technicals(df)

            latest = df.iloc[-1]
            prev = df.iloc[-2] if len(df) >= 2 else latest

            price = float(latest['Close'])
            prev_close = float(prev['Close'])
            change = price - prev_close
            change_pct = (change / prev_close) * 100

            # 5-day price history
            price_history = [round(float(p), 2) for p in df['Close'].tail(5).values]

            # MACD history (last 5 values for mini chart)
            macd_history = [round(float(h), 3) for h in df['macd_histogram'].tail(5).values if pd.notna(h)]

            # Portfolio value
            shares_estimate = PORTFOLIO[ticker]['allocation'] / price if price > 0 else 0
            current_value = shares_estimate * price
            total_current_value += current_value

            # Get info for PE
            info = t.info or {}
            pe = info.get('trailingPE') or info.get('forwardPE')
            market_cap = info.get('marketCap')

            stocks_data[ticker] = {
                'price': round(price, 2),
                'previousClose': round(prev_close, 2),
                'change': round(change, 2),
                'changePct': round(change_pct, 2),
                'dayHigh': safe_float(latest.get('High')),
                'dayLow': safe_float(latest.get('Low')),
                'volume': int(latest['Volume']) if pd.notna(latest['Volume']) else 0,
                'avgVolume20d': int(latest.get('volume_sma20', 0)) if pd.notna(latest.get('volume_sma20')) else 0,
                'marketCap': market_cap,
                'pe': round(float(pe), 1) if pe else None,
                'technicals': {
                    'rsi14': safe_float(latest.get('rsi14')),
                    'sma20': safe_float(latest.get('sma20')),
                    'sma50': safe_float(latest.get('sma50')),
                    'sma200': safe_float(latest.get('sma200')),
                    'ema12': safe_float(latest.get('ema12')),
                    'ema26': safe_float(latest.get('ema26')),
                    'macdLine': safe_float(latest.get('macd_line')),
                    'macdSignal': safe_float(latest.get('macd_signal')),
                    'macdHistogram': safe_float(latest.get('macd_histogram')),
                    'volumeRatio': safe_float(latest.get('volume_ratio'))
                },
                'priceHistory5d': price_history,
                'macdHistory5d': macd_history,
                'allocation': PORTFOLIO[ticker]['allocation'],
                'portfolioPct': PORTFOLIO[ticker]['percent'],
                'sector': PORTFOLIO[ticker]['sector'],
                'sectorHe': PORTFOLIO[ticker]['sectorHe'],
                'name': PORTFOLIO[ticker]['name']
            }

            # Detect alerts
            ticker_alerts = detect_alerts(ticker, df)
            all_alerts.extend(ticker_alerts)

            # Generate short-term signal
            signal = generate_short_term_data(ticker, df)
            if signal:
                all_signals.append(signal)

            time.sleep(0.5)  # Rate limiting

        except Exception as e:
            print(f"  Error processing {ticker}: {e}")
            continue

    # Market sentiment
    vix_price = macro.get('vix', {}).get('price', 20)
    if vix_price > 30:
        vix_interp, vix_interp_he = 'high', 'גבוה מאוד'
    elif vix_price > 20:
        vix_interp, vix_interp_he = 'elevated', 'מוגבר'
    else:
        vix_interp, vix_interp_he = 'normal', 'רגיל'

    sp_change = macro.get('sp500', {}).get('changePct', 0)
    if sp_change > 1:
        sp_trend, sp_trend_he = 'bullish', 'שורי'
    elif sp_change < -1:
        sp_trend, sp_trend_he = 'bearish', 'דובי'
    else:
        sp_trend, sp_trend_he = 'neutral', 'ניטראלי'

    buy_count = sum(1 for s in all_signals if s['signal'] == 'BUY')
    sell_count = sum(1 for s in all_signals if s['signal'] == 'SELL')
    if buy_count > sell_count + 2:
        overall, overall_he = 'bullish', 'אופטימי'
    elif sell_count > buy_count + 2:
        overall, overall_he = 'bearish', 'פסימי'
    elif vix_price > 25:
        overall, overall_he = 'cautious', 'זהיר'
    else:
        overall, overall_he = 'neutral', 'ניטראלי'

    # === Write market-data.json ===
    total_return = total_current_value - total_invested
    total_return_pct = (total_return / total_invested * 100) if total_invested > 0 else 0

    market_data = {
        'lastUpdated': now,
        'updateSource': 'Yahoo Finance via yfinance',
        'macro': macro,
        'stocks': stocks_data,
        'portfolioValue': {
            'totalInvested': total_invested,
            'currentValue': round(total_current_value, 2),
            'totalReturn': round(total_return, 2),
            'totalReturnPct': round(total_return_pct, 2),
            'cashReserve': 9450
        }
    }

    # === Write alerts.json ===
    alerts_data = {
        'lastUpdated': now,
        'activeAlerts': all_alerts,
        'alertHistory': []
    }

    # === Write short-term.json ===
    short_term_data = {
        'lastUpdated': now,
        'signals': all_signals,
        'marketSentiment': {
            'vix': vix_price,
            'vixInterpretation': vix_interp,
            'vixInterpretationHe': vix_interp_he,
            'sp500Trend': sp_trend,
            'sp500TrendHe': sp_trend_he,
            'overallSignal': overall,
            'overallSignalHe': overall_he
        }
    }

    # === Write files ===
    os.makedirs(DATA_DIR, exist_ok=True)

    for filename, data in [
        ('market-data.json', market_data),
        ('alerts.json', alerts_data),
        ('short-term.json', short_term_data)
    ]:
        filepath = os.path.join(DATA_DIR, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Written: {filepath}")

    print(f"\nDone! Processed {len(stocks_data)} stocks, {len(all_alerts)} alerts, {len(all_signals)} signals.")


if __name__ == '__main__':
    fetch_all_data()
