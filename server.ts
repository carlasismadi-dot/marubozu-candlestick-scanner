/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marubozu Scanner - Server
 * Migrated from CoinGecko → Binance Public API for OHLCV data.
 * Binance public endpoints require NO API key and allow 1,200 req/min.
 * CoinGecko is still used for the /api/coins market overview (1 call per sweep).
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

let currentFilename = '';
let currentDirname = '';

try {
  if (typeof __filename !== 'undefined') {
    currentFilename = __filename;
    currentDirname = __dirname;
  } else {
    currentFilename = fileURLToPath(import.meta.url);
    currentDirname = path.dirname(currentFilename);
  }
} catch (e) {
  currentDirname = path.resolve();
}

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// Binance config — no API key needed for public market data endpoints
// ---------------------------------------------------------------------------
const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

// CoinGecko is only used for the market overview (/api/coins).
// One call per full sweep keeps us well within even the free 10k/month limit.
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// ---------------------------------------------------------------------------
// Coin list — same 25 coins as before
// ---------------------------------------------------------------------------
const COIN_LIST = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'dogecoin', 'polkadot', 'chainlink', 'avalanche-2',
  'shiba-inu', 'tron', 'fantom', 'near', 'uniswap',
  'litecoin', 'stellar', 'cosmos', 'render-token', 'vechain',
  'optimism', 'arbitrum', 'sui', 'aptos', 'pepe'
];

// CoinGecko ID → Binance symbol mapping
const COIN_TO_SYMBOL: Record<string, string> = {
  'bitcoin':       'BTCUSDT',
  'ethereum':      'ETHUSDT',
  'solana':        'SOLUSDT',
  'binancecoin':   'BNBUSDT',
  'ripple':        'XRPUSDT',
  'cardano':       'ADAUSDT',
  'dogecoin':      'DOGEUSDT',
  'polkadot':      'DOTUSDT',
  'chainlink':     'LINKUSDT',
  'avalanche-2':   'AVAXUSDT',
  'shiba-inu':     'SHIBUSDT',
  'tron':          'TRXUSDT',
  'fantom':        'FTMUSDT',
  'near':          'NEARUSDT',
  'uniswap':       'UNIUSDT',
  'litecoin':      'LTCUSDT',
  'stellar':       'XLMUSDT',
  'cosmos':        'ATOMUSDT',
  'render-token':  'RENDERUSDT',
  'vechain':       'VETUSDT',
  'optimism':      'OPUSDT',
  'arbitrum':      'ARBUSDT',
  'sui':           'SUIUSDT',
  'aptos':         'APTUSDT',
  'pepe':          'PEPEUSDT',
};

// CoinGecko "days" param → Binance kline interval + candle limit
// days=1  → 30-minute candles  (48 candles  = 1 day)
// days=7  → 4-hour candles     (42 candles  = 7 days)
// days=30 → 1-day candles      (30 candles  = 30 days)
const DAYS_TO_BINANCE: Record<string, { interval: string; limit: number }> = {
  '1':  { interval: '30m', limit: 48  },
  '7':  { interval: '4h',  limit: 42  },
  '30': { interval: '1d',  limit: 30  },
};

const TIMEFRAME_DAYS = ['1', '7', '30'];

// CoinGecko IDs joined for the markets call
const TOP_COIN_IDS = COIN_LIST.join(',');

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = {
  markets: null as CacheEntry<any[]> | null,
  ohlc: new Map<string, CacheEntry<any[]>>(), // key: coinId_days
};

// ---------------------------------------------------------------------------
// Background crawler state
// ---------------------------------------------------------------------------
let currentCoinIndex = 0;
let currentTimeframeIndex = 0;
let isBackingOff = false;

// ---------------------------------------------------------------------------
// Binance OHLCV fetch
// Returns candles in the same shape as CoinGecko OHLC:
//   [timestamp, open, high, low, close]
// so the frontend Marubozu detection code needs zero changes.
// ---------------------------------------------------------------------------
async function fetchOhlcFromBinance(coinId: string, days: string): Promise<any[]> {
  const symbol = COIN_TO_SYMBOL[coinId];
  if (!symbol) {
    throw new Error(`No Binance symbol mapped for coin: ${coinId}`);
  }

  const { interval, limit } = DAYS_TO_BINANCE[days] ?? { interval: '1d', limit: 30 };
  const url = `${BINANCE_BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  console.log(`[Binance Request] ${symbol} ${interval} (${limit} candles)`);

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    if (response.status === 429 || response.status === 418) {
      console.warn(`[Binance 429/418] Rate limit hit. Backing off...`);
      throw new Error('RATE_LIMIT');
    }
    const errMsg = await response.text();
    console.error(`[Binance Error] Status: ${response.status}. Message: ${errMsg}`);
    throw new Error(`BINANCE_HTTP_ERROR: ${response.status}`);
  }

  const raw: any[][] = await response.json();

  // Binance kline format:
  //   [0] openTime, [1] open, [2] high, [3] low, [4] close, [5] volume, ...
  // Map to CoinGecko-compatible: [timestamp, open, high, low, close]
  return raw.map((k) => [
    k[0],        // timestamp (ms)
    parseFloat(k[1]),  // open
    parseFloat(k[2]),  // high
    parseFloat(k[3]),  // low
    parseFloat(k[4]),  // close
  ]);
}

// ---------------------------------------------------------------------------
// CoinGecko markets fetch (used only for /api/coins — 1 call per full sweep)
// ---------------------------------------------------------------------------
async function fetchFromCoinGecko(endpoint: string) {
  const url = `${COINGECKO_BASE_URL}${endpoint}`;
  const separator = url.includes('?') ? '&' : '?';
  const keyParam = COINGECKO_API_KEY ? `x_cg_demo_api_key=${COINGECKO_API_KEY}` : '';
  const finalUrl = keyParam ? `${url}${separator}${keyParam}` : url;

  console.log(`[CoinGecko Request] ${endpoint.split('?')[0]}`);

  const response = await fetch(finalUrl, {
    headers: {
      'Accept': 'application/json',
      ...(COINGECKO_API_KEY ? { 'x-cg-demo-api-key': COINGECKO_API_KEY } : {}),
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`[CoinGecko 429] Rate limit reached. Backing off...`);
      throw new Error('RATE_LIMIT');
    }
    const errMsg = await response.text();
    console.error(`[CoinGecko Error] Status: ${response.status}. ${errMsg}`);
    throw new Error(`COINGECKO_HTTP_ERROR: ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Cache update helpers
// ---------------------------------------------------------------------------
async function updateOhlcCache(coinId: string, days: string) {
  try {
    const data = await fetchOhlcFromBinance(coinId, days);
    cache.ohlc.set(`${coinId}_${days}`, { data, timestamp: Date.now() });
    return data;
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT') {
      isBackingOff = true;
      setTimeout(() => { isBackingOff = false; }, 30000);
    }
    throw err;
  }
}

async function updateMarketsCache() {
  try {
    const data = await fetchFromCoinGecko(
      `/coins/markets?vs_currency=usd&ids=${TOP_COIN_IDS}&order=market_cap_desc&per_page=50&page=1&sparkline=false`
    );
    cache.markets = { data, timestamp: Date.now() };
    return data;
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT') {
      isBackingOff = true;
      setTimeout(() => { isBackingOff = false; }, 60000); // longer backoff for CoinGecko
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Background crawler
// Fires every 2 seconds — safe even at 1,200 req/min Binance limit.
// Full sweep of 25 coins × 3 timeframes = 75 calls ≈ 2.5 minutes.
// ---------------------------------------------------------------------------
async function runBackgroundCrawler() {
  if (isBackingOff) {
    setTimeout(runBackgroundCrawler, 10000);
    return;
  }

  try {
    const coinId = COIN_LIST[currentCoinIndex];
    const days = TIMEFRAME_DAYS[currentTimeframeIndex];

    await updateOhlcCache(coinId, days);

    currentTimeframeIndex++;
    if (currentTimeframeIndex >= TIMEFRAME_DAYS.length) {
      currentTimeframeIndex = 0;
      currentCoinIndex++;
      if (currentCoinIndex >= COIN_LIST.length) {
        currentCoinIndex = 0;
        // Refresh market overview once per full sweep
        await updateMarketsCache();
        console.log(`[Background Scanner] Full sweep complete — ${COIN_LIST.length} coins × ${TIMEFRAME_DAYS.length} timeframes cached.`);
      }
    }
  } catch {
    // Swallow errors; next interval will retry
  }

  setTimeout(runBackgroundCrawler, 2000); // 2s between calls (was 5s)
}

// ---------------------------------------------------------------------------
// Server initialization
// ---------------------------------------------------------------------------
async function initializeServer() {
  console.log('Initializing Marubozu scanner...');
  try {
    await updateMarketsCache();
    console.log('Market overview cached successfully.');
  } catch (err) {
    console.warn('Could not pre-fetch market overview. Will retry during sweep.', err);
  }
  runBackgroundCrawler();
}

// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------

// 1. Coin market overview (price, market cap, volume, etc.)
app.get('/api/coins', async (req, res) => {
  try {
    if (cache.markets && Date.now() - cache.markets.timestamp < 300000) {
      return res.json(cache.markets.data);
    }
    const data = await updateMarketsCache();
    res.json(data);
  } catch (err: any) {
    if (cache.markets) return res.json(cache.markets.data); // stale fallback
    res.status(500).json({ error: 'Failed to retrieve coin market data', details: err.message });
  }
});

// 2. OHLCV candles for a specific coin & timeframe
app.get('/api/ohlc', async (req, res) => {
  const coinId = req.query.coinId as string;
  const days = (req.query.days as string) || '30';

  if (!coinId) {
    return res.status(400).json({ error: 'coinId query parameter is required' });
  }

  const cacheKey = `${coinId}_${days}`;
  const cached = cache.ohlc.get(cacheKey);

  // Serve from cache if fresher than 10 minutes
  if (cached && Date.now() - cached.timestamp < 600000) {
    return res.json(cached.data);
  }

  try {
    const data = await updateOhlcCache(coinId, days);
    res.json(data);
  } catch (err: any) {
    if (cached) return res.json(cached.data); // stale fallback
    res.status(500).json({ error: `Failed to retrieve candles for ${coinId}`, details: err.message });
  }
});

// 3. All cached OHLCV blocks (used by frontend to bulk-load on startup)
app.get('/api/ohlc-all', (req, res) => {
  const result: Record<string, any[]> = {};
  for (const [key, entry] of cache.ohlc.entries()) {
    result[key] = entry.data;
  }
  res.json(result);
});

// 4. Clear caches (admin/debug use)
app.post('/api/cache/clear', (req, res) => {
  cache.markets = null;
  cache.ohlc.clear();
  res.json({ status: 'ok', message: 'All caches cleared.' });
});

// 5. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dataSource: 'Binance Public API (OHLCV) + CoinGecko (market overview)',
    crawler: {
      currentCoin: COIN_LIST[currentCoinIndex],
      currentIntervalDays: TIMEFRAME_DAYS[currentTimeframeIndex],
      isBackingOff,
    },
    candlesCached: cache.ohlc.size,
    totalExpected: COIN_LIST.length * TIMEFRAME_DAYS.length,
    marketsCachedAt: cache.markets ? new Date(cache.markets.timestamp).toISOString() : null,
  });
});

// ---------------------------------------------------------------------------
// Vite middleware (dev) / static serving (prod)
// ---------------------------------------------------------------------------
async function bootstrap() {
  await initializeServer();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marubozu Core running at http://localhost:${PORT}`);
  });
}

bootstrap();
