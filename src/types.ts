/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Candle = [number, number, number, number, number]; // [timestamp, open, high, low, close]

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export type MarubozuType = 'bullish' | 'bearish' | 'none';

export interface MarubozuStatus {
  type: MarubozuType;
  wickRatio: number; // sum of wicks divided by total range (0 to 1)
  bodyPercent: number; // body height divided by open price
  candle: Candle | null;
}

export interface CoinScanResult {
  coinId: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  patterns: {
    '30m': MarubozuStatus;
    '4h': MarubozuStatus;
    '1d': MarubozuStatus;
  };
  lastScannedAt: number;
}

export interface ScannerSettings {
  wickTolerance: number; // e.g., 0.05 means wicks can be at most 5% of the total candle range
  minBodyPercent: number; // e.g., 0.15 means the body must be at least 0.15% of the opening price (prevents flat candle noise)
}
