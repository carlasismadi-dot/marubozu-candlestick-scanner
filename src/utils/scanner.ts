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

  // CoinGecko delivers candles sorted oldest to newest.
  // The very last item in the list is the active candle (which is changing in real-time).
  // Standard technical analysis scans the MOST RECENTLY CLOSED candle (last - 2) to avoid false alerts on shifting active prices.
  // If we only have 1 candle, we fall back to it.
  const targetIndex = checkCompleted && candles.length > 1 ? candles.length - 2 : candles.length - 1;
  const candle = candles[targetIndex];
  const [time, open, high, low, close] = candle;

  const range = high - low;
  if (range <= 0) {
    return { type: 'none', wickRatio: 0, bodyPercent: 0, candle };
  }

  const body = Math.abs(close - open);
  const bodyPercent = (body / open) * 100;

  // Reject flat candle noises (e.g. USDT, USDC, or extreme low liquidity spikes)
  if (bodyPercent < settings.minBodyPercent) {
    return { type: 'none', wickRatio: (range - body) / range, bodyPercent, candle };
  }

  const totalWick = range - body;
  const wickRatio = totalWick / range;

  const isBullish = close > open;

  if (isBullish) {
    // Bullish Marubozu (Open is almost Low, Close is almost High)
    // Upper Wick = High - Close
    // Lower Wick = Open - Low
    if (wickRatio <= settings.wickTolerance) {
      return { type: 'bullish', wickRatio, bodyPercent, candle };
    }
  } else {
    // Bearish Marubozu (Open is almost High, Close is almost Low)
    // Upper Wick = High - Open
    // Lower Wick = Close - Low
    if (wickRatio <= settings.wickTolerance) {
      return { type: 'bearish', wickRatio, bodyPercent, candle };
    }
  }

  return { type: 'none', wickRatio, bodyPercent, candle };
}

/**
 * Formats a timestamp into human-readable hour/date labels
 */
export function formatTimeLabel(ms: number, daysParam: string): string {
  const date = new Date(ms);
  if (daysParam === '1') {
    // 30m granularity -> minutes / hours
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (daysParam === '7') {
    // 4h granularity -> day of week + hour
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    // 1d granularity -> month date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
