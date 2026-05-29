/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

// Safely define path variables for CJS/ESM compatibility
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

// Setup CoinGecko Config
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || 'CG-qVHh6XuVFje6cb54EQ7VUHog';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Monitored high-volume coins to scan
const TOP_COIN_IDS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'dogecoin', 'polkadot', 'chainlink', 'avalanche-2',
  'shiba-inu', 'tron', 'fantom', 'near', 'uniswap',
  'litecoin', 'stellar', 'cosmos', 'render-token', 'vechain',
  'optimism', 'arbitrum', 'sui', 'aptos', 'pepe'
].join(',');

// In-Memory Database / Caching layers
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = {
  markets: null as CacheEntry<any[]> | null,
  ohlc: new Map<string, CacheEntry<any[]>>() // key: coinId_days
};

// Background worker state to continuously update OHLC candles safely
const COIN_LIST = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
  'cardano', 'dogecoin', 'polkadot', 'chainlink', 'avalanche-2',
  'shiba-inu', 'tron', 'fantom', 'near', 'uniswap',
  'litecoin', 'stellar', 'cosmos', 'render-token', 'vechain',
  'optimism', 'arbitrum', 'sui', 'aptos', 'pepe'
];
const TIMEFRAME_DAYS = ['1', '7', '30']; // 1 = 30m, 7 = 4h, 30 = 1d

let currentCoinIndex = 0;
let currentTimeframeIndex = 0;
let isBackingOff = false;

// HTTP Fetch helper to deal with CoinGecko authentication & rate limiting
async function fetchFromCoinGecko(endpoint: string) {
  const url = `${COINGECKO_BASE_URL}${endpoint}`;
  const separator = url.includes('?') ? '&' : '?';
  const finalUrl = `${url}${separator}x_cg_demo_api_key=${COINGECKO_API_KEY}`;

  console.log(`[CoinGecko Request] Fetching: ${endpoint.split('?')[0]}`);
  
  const response = await fetch(finalUrl, {
    headers: {
      'Accept': 'application/json',
      'x-cg-demo-api-key': COINGECKO_API_KEY
    }
  });

  if (!response.ok) {
    if (response.status === 429) {
      console.warn(`[CoinGecko 429] Rate limit reached. Backing off...`);
      throw new Error('RATE_LIMIT');
    }
    const errMsg = await response.text();
    console.error(`[CoinGecko Error] Status: ${response.status}. Message: ${errMsg}`);
    throw new Error(`COINGECKO_HTTP_ERROR: ${response.status}`);
  }

  return response.json();
}

// Function to fetch and update an individual OHLC candle pair in cache
async function updateOhlcCache(coinId: string, days: string) {
  try {
    const data = await fetchFromCoinGecko(`/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`);
    cache.ohlc.set(`${coinId}_${days}`, {
      data,
      timestamp: Date.now()
    });
    return data;
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT') {
      isBackingOff = true;
      setTimeout(() => { isBackingOff = false; }, 30000); // Backoff for 30s
    }
    throw err;
  }
}

// Function to fetch and update marketing data
async function updateMarketsCache() {
  try {
    const data = await fetchFromCoinGecko(`/coins/markets?vs_currency=usd&ids=${TOP_COIN_IDS}&order=market_cap_desc&per_page=50&page=1&sparkline=false`);
    cache.markets = {
      data,
      timestamp: Date.now()
    };
    return data;
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT') {
      isBackingOff = true;
      setTimeout(() => { isBackingOff = false; }, 30000);
    }
    throw err;
  }
}

// Background Crawler loop: executes every 5 seconds, updating 1 product
async function runBackgroundCrawler() {
  if (isBackingOff) {
    setTimeout(runBackgroundCrawler, 10000);
    return;
  }

  try {
    const coinId = COIN_LIST[currentCoinIndex];
    const days = TIMEFRAME_DAYS[currentTimeframeIndex];

    await updateOhlcCache(coinId, days);

    // Increment indices
    currentTimeframeIndex++;
    if (currentTimeframeIndex >= TIMEFRAME_DAYS.length) {
      currentTimeframeIndex = 0;
      currentCoinIndex++;
      if (currentCoinIndex >= COIN_LIST.length) {
        currentCoinIndex = 0;
        // Periodically refresh the general markets data too and log
        await updateMarketsCache();
        console.log(`[Background Scanner] Finished a full scan sweep of all ${COIN_LIST.length} coins!`);
      }
    }
  } catch (error) {
    // Slurk the error and proceed on next interval
  }

  // Next run in 5 seconds (safely under rates limits)
  setTimeout(runBackgroundCrawler, 5000);
}

// Initialize caches
async function initializeServer() {
  console.log('Initializing Marubozu scanner caches...');
  try {
    await updateMarketsCache();
    console.log('Main market rates cached successfully.');
    // Run background crawler to fill OHLC candles over time
    runBackgroundCrawler();
  } catch (err) {
    console.error('Failed to fill initial market rates cache:', err);
    // Dynamic starting of crawler anyway
    runBackgroundCrawler();
  }
}

// REST endpoints
// 1. Get List of monitored coins
app.get('/api/coins', async (req, res) => {
  try {
    // Serve from cache if fresh (younger than 5 minutes)
    if (cache.markets && Date.now() - cache.markets.timestamp < 300000) {
      return res.json(cache.markets.data);
    }

    const data = await updateMarketsCache();
    res.json(data);
  } catch (err: any) {
    if (cache.markets) {
      // Graceful fallback to stale cache on failure
      return res.json(cache.markets.data);
    }
    res.status(500).json({ error: 'Failed to retrieve coin dashboard markets', details: err.message });
  }
});

// 2. Clear specific cache elements
app.post('/api/cache/clear', (req, res) => {
  cache.markets = null;
  cache.ohlc.clear();
  res.json({ status: 'ok', message: 'All in-memory caches cleared successfully.' });
});

// 3. Get OHLC candles for a specific coin & days (with optional refresh trigger)
app.get('/api/ohlc', async (req, res) => {
  const coinId = req.query.coinId as string;
  const days = (req.query.days as string) || '30';

  if (!coinId) {
    return res.status(400).json({ error: 'coinId query parameter is required' });
  }

  const cacheKey = `${coinId}_${days}`;
  const cached = cache.ohlc.get(cacheKey);

  // Serve from cache if fresh (younger than 10 minutes)
  if (cached && Date.now() - cached.timestamp < 600000) {
    return res.json(cached.data);
  }

  try {
    const data = await updateOhlcCache(coinId, days);
    res.json(data);
  } catch (err: any) {
    if (cached) {
      // Stale fallback
      return res.json(cached.data);
    }
    res.status(500).json({ error: `Failed to retrieve candlestick data for ${coinId}`, details: err.message });
  }
});

// 4. Retrieve ALL scanned OHLC candle blocks currently present in cache
app.get('/api/ohlc-all', (req, res) => {
  const result: Record<string, any[]> = {};
  for (const [key, entry] of cache.ohlc.entries()) {
    result[key] = entry.data;
  }
  res.json(result);
});

// 5. System Health Status check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    crawler: {
      currentCoin: COIN_LIST[currentCoinIndex],
      currentIntervalDays: TIMEFRAME_DAYS[currentTimeframeIndex],
      isBackingOff
    },
    candlesCached: cache.ohlc.size,
    marketsCachedAt: cache.markets ? new Date(cache.markets.timestamp).toISOString() : null
  });
});

// Mount Vite middleware or production serving
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
