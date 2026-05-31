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
  market_cap_rank: number; // populated as index order from Binance (1-based)
  total_volume: number;
  price_change_percentage_24h: number;
  // Optional fields from CoinGecko that Binance doesn't supply
  fully_diluted_valuation?: number | null;
  high_24h?: number;
  low_24h?: number;
  price_change_24h?: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply?: number;
  total_supply?: number | null;
  max_supply?: number | null;
  ath?: number;
  ath_change_percentage?: number;
  ath_date?: string;
  atl?: number;
  atl_change_percentage?: number;
  atl_date?: string;
  last_updated?: string;
  // Binance-specific
  _binanceSymbol?: string;
}

export type MarubozuType = 'bullish' | 'bearish' | 'none';

export interface MarubozuStatus {
  type: MarubozuType;
  wickRatio: number;
  bodyPercent: number;
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
  wickTolerance: number;
  minBodyPercent: number;
}
