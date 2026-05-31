/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, MarubozuStatus, ScannerSettings } from '../types';

/**
 * Sweeps a set of candles and detects if the target candle is a Marubozu pattern.
 * Now also computes: volumeRatio, strengthScore (1–10), and streak count.
 *
 * Candle tuple: [timestamp, open, high, low, close, volume?]
 */
export function detectMarubozu(
  candles: Candle[],
  settings: ScannerSettings,
  checkCompleted = true
): MarubozuStatus {
  const none: MarubozuStatus = {
    type: 'none', wickRatio: 0, bodyPercent: 0, candle: null,
    strengthScore: 0, volumeRatio: 0, streak: 0,
  };

  if (!candles || candles.length === 0) return none;

  const targetIndex = checkCompleted && candles.length > 1
    ? candles.length - 2
    : candles.length - 1;

  const candle = candles[targetIndex];
  const [, open, high, low, close, vol] = candle;

  const range = high - low;
  if (range <= 0) return { ...none, candle };

  const body        = Math.abs(close - open);
  const bodyPercent = (body / open) * 100;

  if (bodyPercent < settings.minBodyPercent) {
    return { ...none, wickRatio: (range - body) / range, bodyPercent, candle };
  }

  const totalWick = range - body;
  const wickRatio = totalWick / range;
  const isBullish = close > open;

  if (wickRatio > settings.wickTolerance) {
    return { ...none, wickRatio, bodyPercent, candle };
  }

  // ── Volume ratio vs 20-candle average ──────────────────────────────────────
  const lookback  = candles.slice(Math.max(0, targetIndex - 20), targetIndex);
  const avgVol    = lookback.length > 0
    ? lookback.reduce((sum, c) => sum + (c[5] ?? 0), 0) / lookback.length
    : 0;
  const candleVol = vol ?? 0;
  const volumeRatio = avgVol > 0 ? candleVol / avgVol : 0;

  // ── Strength score 1–10 ────────────────────────────────────────────────────
  // Components:
  //   body   : 0–4 pts  (bodyPercent mapped: 0.15% → 0, 3%+ → 4)
  //   wick   : 0–3 pts  (wickRatio mapped: 0% → 3, tolerance → 0)
  //   volume : 0–3 pts  (volumeRatio mapped: 1× → 0, 3×+ → 3)
  const bodyScore   = Math.min(4, (bodyPercent / 3) * 4);
  const wickScore   = settings.wickTolerance > 0
    ? Math.max(0, 3 * (1 - wickRatio / settings.wickTolerance))
    : wickRatio === 0 ? 3 : 0;
  const effectiveVolRatio = volumeRatio > 0 ? volumeRatio : 1;
  const volScore    = Math.min(3, Math.max(0, (effectiveVolRatio - 1) / 2) * 3);
  const rawScore    = bodyScore + wickScore + volScore;
  const strengthScore = Math.max(1, Math.min(10, Math.round(rawScore)));

  // ── Streak: consecutive completed marubozu candles ending at targetIndex ───
  let streak = 1;
  for (let i = targetIndex - 1; i >= 0; i--) {
    const c         = candles[i];
    const [, o, h, l, cl] = c;
    const r         = h - l;
    if (r <= 0) break;
    const bd        = Math.abs(cl - o);
    const bp        = (bd / o) * 100;
    if (bp < settings.minBodyPercent) break;
    const wr        = (r - bd) / r;
    if (wr > settings.wickTolerance) break;
    // Must be same direction
    const thisBull  = cl > o;
    if (thisBull !== isBullish) break;
    streak++;
  }

  return {
    type: isBullish ? 'bullish' : 'bearish',
    wickRatio,
    bodyPercent,
    candle,
    strengthScore,
    volumeRatio,
    streak,
  };
}

/**
 * Returns ms remaining until the current candle closes.
 * Binance candles open at exact interval boundaries.
 */
export function msUntilCandleClose(intervalStr: string): number {
  const now     = Date.now();
  const msMap: Record<string, number> = {
    '30m': 30 * 60 * 1000,
    '4h':   4 * 60 * 60 * 1000,
    '1d':  24 * 60 * 60 * 1000,
  };
  const ms = msMap[intervalStr];
  if (!ms) return 0;
  const elapsed = now % ms;
  return ms - elapsed;
}

/**
 * Formats milliseconds into "Xh Ym Zs" or "Ym Zs" or "Zs" string.
 */
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Formats a Binance kline timestamp into a human-readable axis label.
 */
export function formatTimeLabel(ms: number, daysParam: string): string {
  const date = new Date(ms);
  if (daysParam === '30m') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (daysParam === '4h') {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
