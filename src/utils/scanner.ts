/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Candle, MarubozuStatus, ScannerSettings } from '../types';

/**
 * Sweeps a set of candles and detects if the target candle (last completed, or active) is a Marubozu pattern.
 *
 * @param candles List of candles [timestamp, open, high, low, close]
 * @param settings Wick tolerance and min body percentage constraints
 * @param checkCompleted Only check the last completed candle (default true)
 */
export function detectMarubozu(
  candles: Candle[],
  settings: ScannerSettings,
  checkCompleted = true
): MarubozuStatus {
  if (!candles || candles.length === 0) {
    return { type: 'none', wickRatio: 0, bodyPercent: 0, candle: null };
  }

  // Binance delivers klines sorted oldest → newest.
  // The very last item is the still-forming (active) candle which shifts in real-time.
  // Standard technical analysis scans the MOST RECENTLY CLOSED candle (length - 2)
  // to avoid false alerts on an in-progress candle.
  // If only 1 candle is present we fall back to it.
  const targetIndex = checkCompleted && candles.length > 1 ? candles.length - 2 : candles.length - 1;
  const candle = candles[targetIndex];
  const [, open, high, low, close] = candle;

  const range = high - low;
  if (range <= 0) {
    return { type: 'none', wickRatio: 0, bodyPercent: 0, candle };
  }

  const body        = Math.abs(close - open);
  const bodyPercent = (body / open) * 100;

  // Reject flat candles: stablecoins, zero-liquidity spikes, sideways chop
  if (bodyPercent < settings.minBodyPercent) {
    return { type: 'none', wickRatio: (range - body) / range, bodyPercent, candle };
  }

  const totalWick = range - body;
  const wickRatio = totalWick / range;
  const isBullish = close > open;

  if (wickRatio <= settings.wickTolerance) {
    return {
      type: isBullish ? 'bullish' : 'bearish',
      wickRatio,
      bodyPercent,
      candle,
    };
  }

  return { type: 'none', wickRatio, bodyPercent, candle };
}

/**
 * Formats a Binance kline timestamp into a human-readable axis label.
 * Receives the Binance interval string: '30m' | '4h' | '1d'
 */
export function formatTimeLabel(ms: number, daysParam: string): string {
  const date = new Date(ms);

  if (daysParam === '30m') {
    // 30-minute candles → show HH:MM
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (daysParam === '4h') {
    // 4-hour candles → show weekday + HH:MM
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // '1d' daily candles → show Mon DD
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
