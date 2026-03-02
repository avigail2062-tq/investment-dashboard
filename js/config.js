/**
 * config.js - Portfolio Configuration
 * Investment Dashboard - Hebrew RTL, Dark Theme
 */

const PORTFOLIO_CONFIG = {
  stocks: {
    NVDA: {
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      nameHe: 'אנבידיה',
      sector: 'טכנולוגיה',
      sectorEn: 'Technology',
      shares: 50,
      avgCost: 480.00,
      color: '#76B900',
      logo: 'https://logo.clearbit.com/nvidia.com',
      description: 'שבבים ובינה מלאכותית'
    },
    AVGO: {
      symbol: 'AVGO',
      name: 'Broadcom Inc.',
      nameHe: 'ברודקום',
      sector: 'טכנולוגיה',
      sectorEn: 'Technology',
      shares: 30,
      avgCost: 620.00,
      color: '#CC092F',
      logo: 'https://logo.clearbit.com/broadcom.com',
      description: 'תשתיות מוליכים למחצה'
    },
    LMT: {
      symbol: 'LMT',
      name: 'Lockheed Martin',
      nameHe: 'לוקהיד מרטין',
      sector: 'ביטחון',
      sectorEn: 'Defense',
      shares: 20,
      avgCost: 450.00,
      color: '#003366',
      logo: 'https://logo.clearbit.com/lockheedmartin.com',
      description: 'תעשייה ביטחונית ואווירית'
    },
    RTX: {
      symbol: 'RTX',
      name: 'RTX Corporation',
      nameHe: 'ריית\'און',
      sector: 'ביטחון',
      sectorEn: 'Defense',
      shares: 40,
      avgCost: 95.00,
      color: '#1B3D6D',
      logo: 'https://logo.clearbit.com/rtx.com',
      description: 'מערכות ביטחוניות וטילים'
    },
    NOC: {
      symbol: 'NOC',
      name: 'Northrop Grumman',
      nameHe: 'נורת\'רופ גראמן',
      sector: 'ביטחון',
      sectorEn: 'Defense',
      shares: 15,
      avgCost: 470.00,
      color: '#4A5568',
      logo: 'https://logo.clearbit.com/northropgrumman.com',
      description: 'מערכות חלל וביטחון'
    },
    CRWD: {
      symbol: 'CRWD',
      name: 'CrowdStrike Holdings',
      nameHe: 'קראודסטרייק',
      sector: 'סייבר',
      sectorEn: 'Cybersecurity',
      shares: 35,
      avgCost: 200.00,
      color: '#FF0000',
      logo: 'https://logo.clearbit.com/crowdstrike.com',
      description: 'אבטחת סייבר בענן'
    },
    CEG: {
      symbol: 'CEG',
      name: 'Constellation Energy',
      nameHe: 'קונסטליישן אנרגיה',
      sector: 'אנרגיה',
      sectorEn: 'Energy',
      shares: 25,
      avgCost: 115.00,
      color: '#00A3E0',
      logo: 'https://logo.clearbit.com/constellationenergy.com',
      description: 'אנרגיה נקייה וגרעינית'
    },
    XOM: {
      symbol: 'XOM',
      name: 'Exxon Mobil',
      nameHe: 'אקסון מוביל',
      sector: 'אנרגיה',
      sectorEn: 'Energy',
      shares: 45,
      avgCost: 105.00,
      color: '#FF0000',
      logo: 'https://logo.clearbit.com/exxonmobil.com',
      description: 'נפט וגז טבעי'
    },
    NEM: {
      symbol: 'NEM',
      name: 'Newmont Corporation',
      nameHe: 'ניומונט',
      sector: 'סחורות',
      sectorEn: 'Commodities',
      shares: 60,
      avgCost: 42.00,
      color: '#C5A900',
      logo: 'https://logo.clearbit.com/newmont.com',
      description: 'כריית זהב ומתכות יקרות'
    },
    AMD: {
      symbol: 'AMD',
      name: 'Advanced Micro Devices',
      nameHe: 'AMD',
      sector: 'טכנולוגיה',
      sectorEn: 'Technology',
      shares: 55,
      avgCost: 120.00,
      color: '#ED1C24',
      logo: 'https://logo.clearbit.com/amd.com',
      description: 'מעבדים וכרטיסים גרפיים'
    }
  },

  sectors: {
    'טכנולוגיה': {
      nameEn: 'Technology',
      color: '#6366f1',
      stocks: ['NVDA', 'AVGO', 'AMD']
    },
    'ביטחון': {
      nameEn: 'Defense',
      color: '#3b82f6',
      stocks: ['LMT', 'RTX', 'NOC']
    },
    'סייבר': {
      nameEn: 'Cybersecurity',
      color: '#ef4444',
      stocks: ['CRWD']
    },
    'אנרגיה': {
      nameEn: 'Energy',
      color: '#22c55e',
      stocks: ['CEG', 'XOM']
    },
    'סחורות': {
      nameEn: 'Commodities',
      color: '#eab308',
      stocks: ['NEM']
    }
  },

  alerts: {
    thresholds: {
      dailyChangeWarning: 3,
      dailyChangeCritical: 5,
      weeklyChangeWarning: 7,
      weeklyChangeCritical: 10,
      portfolioDropWarning: 2,
      portfolioDropCritical: 5,
      volumeSpikeMultiplier: 2.5
    },
    types: {
      PRICE_SPIKE: {
        label: 'זינוק מחיר',
        icon: '📈',
        severity: 'warning'
      },
      PRICE_DROP: {
        label: 'ירידת מחיר',
        icon: '📉',
        severity: 'critical'
      },
      VOLUME_SPIKE: {
        label: 'זינוק מחזור',
        icon: '📊',
        severity: 'info'
      },
      TARGET_REACHED: {
        label: 'יעד הושג',
        icon: '🎯',
        severity: 'success'
      },
      STOP_LOSS: {
        label: 'סטופ לוס',
        icon: '🛑',
        severity: 'critical'
      },
      PORTFOLIO_ALERT: {
        label: 'התראת תיק',
        icon: '💼',
        severity: 'warning'
      }
    }
  },

  email: {
    serviceId: localStorage.getItem('emailjs_service_id') || 'YOUR_SERVICE_ID',
    templateId: localStorage.getItem('emailjs_template_id') || 'YOUR_TEMPLATE_ID',
    publicKey: localStorage.getItem('emailjs_public_key') || 'YOUR_PUBLIC_KEY',
    recipientEmail: localStorage.getItem('emailjs_recipient') || '',
    enabled: localStorage.getItem('emailjs_enabled') === 'true'
  },

  refresh: {
    intervalMs: 5 * 60 * 1000,
    dataPath: './data/'
  },

  ui: {
    currency: 'USD',
    locale: 'he-IL',
    fontFamily: 'Heebo, sans-serif',
    chartAnimationDuration: 750,
    sparklineDays: 5
  }
};

/**
 * Color palette for consistent theming across charts
 */
const CHART_COLORS = {
  sectors: [
    '#6366f1', // Technology
    '#3b82f6', // Defense
    '#ef4444', // Cybersecurity
    '#22c55e', // Energy
    '#eab308'  // Commodities
  ],
  stockColors: Object.values(PORTFOLIO_CONFIG.stocks).map(s => s.color),
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#94a3b8',
  gridColor: 'rgba(148, 163, 184, 0.1)',
  tooltipBg: 'rgba(15, 23, 42, 0.95)',
  tooltipBorder: 'rgba(100, 116, 139, 0.3)'
};

/**
 * Hebrew labels used across the dashboard
 */
const LABELS = {
  dashboard: 'לוח בקרת השקעות',
  portfolio: 'תיק השקעות',
  totalValue: 'שווי כולל',
  dailyChange: 'שינוי יומי',
  totalReturn: 'תשואה כוללת',
  bestPerformer: 'הביצוע הטוב',
  worstPerformer: 'הביצוע החלש',
  lastUpdated: 'עדכון אחרון',
  awaitingUpdate: 'ממתין לעדכון ראשון...',
  price: 'מחיר',
  change: 'שינוי',
  volume: 'מחזור',
  shares: 'מניות',
  value: 'שווי',
  avgCost: 'עלות ממוצעת',
  profitLoss: 'רווח/הפסד',
  alerts: 'התראות',
  noAlerts: 'אין התראות חדשות',
  sectorDistribution: 'התפלגות לפי סקטורים',
  stockPerformance: 'ביצועי מניות',
  timeline: 'ציר זמן',
  loading: 'טוען נתונים...',
  error: 'שגיאה בטעינת נתונים',
  retry: 'נסה שנית',
  settings: 'הגדרות',
  emailSettings: 'הגדרות דוא"ל',
  save: 'שמור',
  cancel: 'ביטול',
  send: 'שלח',
  testEmail: 'שלח מייל בדיקה',
  shortTerm: 'טווח קצר',
  mediumTerm: 'טווח בינוני',
  longTerm: 'טווח ארוך'
};

// Freeze config to prevent accidental mutations
Object.freeze(LABELS);
Object.freeze(CHART_COLORS);

if (typeof window !== 'undefined') {
  window.PORTFOLIO_CONFIG = PORTFOLIO_CONFIG;
  window.CHART_COLORS = CHART_COLORS;
  window.LABELS = LABELS;
}
