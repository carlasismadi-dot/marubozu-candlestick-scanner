/**
 * analytics.ts
 * GA4 engagement event helpers for Marubozu Scanner
 *
 * SETUP — after adding this file:
 * 1. Go to GA4 → Admin → Events
 * 2. Mark these as Key Events:
 *    - engaged_session
 *    - power_user_settings
 *    - chart_coin_selected
 */

declare const window: Window & {
  gtag?: (...args: any[]) => void;
};

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

// ── Event 1: Engaged session (2+ minutes on site) ───────────────────────────
// Call once from App.tsx on mount. Fires after 120s if user is still on page.

let engagedFired = false;
let engagedTimer: ReturnType<typeof setTimeout> | null = null;

export function startEngagementTimer() {
  if (engagedFired) return;
  engagedTimer = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      gtag('event', 'engaged_session', {
        event_category: 'retention',
        event_label:    'stayed_2min',
      });
      engagedFired = true;
    }
  }, 120_000); // 2 minutes
}

export function clearEngagementTimer() {
  if (engagedTimer) clearTimeout(engagedTimer);
}

// ── Event 2: Power user — changed wick tolerance or min body slider ──────────
// Call from EducationPanel.tsx whenever a slider changes.

let sliderFired = false;

export function trackSettingsChanged(field: 'wickTolerance' | 'minBodyPercent', value: number) {
  if (sliderFired) return; // only fire once per session to avoid noise
  gtag('event', 'power_user_settings', {
    event_category: 'engagement',
    event_label:    field,
    value:          Math.round(value * 100), // send as integer (e.g. 5 for 0.05)
  });
  sliderFired = true;
}

// ── Event 3: User clicked a coin row to load its chart ───────────────────────
// Call from ScannerTable.tsx when a coin row is clicked.

export function trackCoinSelected(coinId: string, symbol: string, timeframe: string) {
  gtag('event', 'chart_coin_selected', {
    event_category: 'engagement',
    event_label:    `${symbol}_${timeframe}`,
    coin_id:        coinId,
    timeframe,
  });
}
