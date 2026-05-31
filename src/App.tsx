/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Marubozu Scanner — Binance-powered rewrite
 * - No API key required (Binance public endpoints)
 * - Real WebSocket streams for live kline updates
 * - REST fallback for initial load & historical data
 * - Removes all CoinGecko references
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CoinData, Candle, ScannerSettings } from './types';
import ScannerTable from './components/ScannerTable';
import CandlestickChart from './components/CandlestickChart';
import EducationPanel from './components/EducationPanel';
import StatsPanel from './components/StatsPanel';
import NotificationCenter from './components/NotificationCenter';
import AdsenseDocPages from './components/AdsenseDocPages';
import { RefreshCw, Shield, Database, Cpu } from 'lucide-react';

// ─── Binance Configuration ────────────────────────────────────────────────────

const BINANCE_REST = 'https://api.binance.com/api/v3';
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

/** Top 25 USDT pairs — maps symbol → CoinGecko-style id for component compat */
const SYMBOL_MAP: Record<string, { id: string; name: string; symbol: string }> = {
  BTCUSDT:  { id: 'bitcoin',       name: 'Bitcoin',       symbol: 'BTC'  },
  ETHUSDT:  { id: 'ethereum',      name: 'Ethereum',      symbol: 'ETH'  },
  SOLUSDT:  { id: 'solana',        name: 'Solana',        symbol: 'SOL'  },
  BNBUSDT:  { id: 'binancecoin',   name: 'BNB',           symbol: 'BNB'  },
  XRPUSDT:  { id: 'ripple',        name: 'XRP',           symbol: 'XRP'  },
  ADAUSDT:  { id: 'cardano',       name: 'Cardano',       symbol: 'ADA'  },
  DOGEUSDT: { id: 'dogecoin',      name: 'Dogecoin',      symbol: 'DOGE' },
  DOTUSDT:  { id: 'polkadot',      name: 'Polkadot',      symbol: 'DOT'  },
  LINKUSDT: { id: 'chainlink',     name: 'Chainlink',     symbol: 'LINK' },
  AVAXUSDT: { id: 'avalanche-2',   name: 'Avalanche',     symbol: 'AVAX' },
  SHIBUSDT: { id: 'shiba-inu',     name: 'Shiba Inu',     symbol: 'SHIB' },
  TRXUSDT:  { id: 'tron',          name: 'TRON',          symbol: 'TRX'  },
  FTMUSDT:  { id: 'fantom',        name: 'Fantom',        symbol: 'FTM'  },
  NEARUSDT: { id: 'near',          name: 'NEAR',          symbol: 'NEAR' },
  UNIUSDT:  { id: 'uniswap',       name: 'Uniswap',       symbol: 'UNI'  },
  LTCUSDT:  { id: 'litecoin',      name: 'Litecoin',      symbol: 'LTC'  },
  XLMUSDT:  { id: 'stellar',       name: 'Stellar',       symbol: 'XLM'  },
  ATOMUSDT: { id: 'cosmos',        name: 'Cosmos',        symbol: 'ATOM' },
  RENDERUSDT:{ id: 'render-token', name: 'Render',        symbol: 'RNDR' },
  VETUSDT:  { id: 'vechain',       name: 'VeChain',       symbol: 'VET'  },
  OPUSDT:   { id: 'optimism',      name: 'Optimism',      symbol: 'OP'   },
  ARBUSDT:  { id: 'arbitrum',      name: 'Arbitrum',      symbol: 'ARB'  },
  SUIUSDT:  { id: 'sui',           name: 'Sui',           symbol: 'SUI'  },
  APTUSDT:  { id: 'aptos',         name: 'Aptos',         symbol: 'APT'  },
  PEPEUSDT: { id: 'pepe',          name: 'Pepe',          symbol: 'PEPE' },
};

const SYMBOLS = Object.keys(SYMBOL_MAP);

/** Hardcoded approximate market-cap ranks (Binance doesn't provide this) */
const COIN_RANK: Record<string, number> = {
  'bitcoin':       1,  'ethereum':     2,  'binancecoin':  3,  'ripple':       4,
  'solana':        5,  'dogecoin':     6,  'cardano':      7,  'tron':         8,
  'chainlink':     9,  'avalanche-2': 10,  'shiba-inu':   11,  'sui':         12,
  'polkadot':     13,  'litecoin':    14,  'near':        15,  'aptos':       16,
  'uniswap':      17,  'stellar':     18,  'cosmos':      19,  'optimism':    20,
  'arbitrum':     21,  'render-token':22,  'vechain':     23,  'fantom':      24,
  'pepe':         25,
};

/** Convert timeframe key → Binance interval string */
const INTERVAL_MAP: Record<'30m' | '4h' | '1d', string> = {
  '30m': '30m',
  '4h':  '4h',
  '1d':  '1d',
};

/** How many candles to fetch for each timeframe */
const LIMIT_MAP: Record<'30m' | '4h' | '1d', number> = {
  '30m': 96,   // ~2 days of 30m candles
  '4h':  84,   // ~14 days of 4h candles
  '1d':  90,   // 90 days of daily candles
};

// ─── Binance REST helpers ─────────────────────────────────────────────────────

/**
 * Fetch 24h ticker data for all symbols and map to CoinData shape.
 */
async function fetchBinanceTickers(): Promise<CoinData[]> {
  const symbolsParam = SYMBOLS.map(s => `"${s}"`).join(',');
  const res = await fetch(
    `${BINANCE_REST}/ticker/24hr?symbols=[${symbolsParam}]`
  );
  if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
  const data: any[] = await res.json();

  return data.map((t) => {
    const meta = SYMBOL_MAP[t.symbol];
    if (!meta) return null;
    return {
      id:                    meta.id,
      symbol:                meta.symbol.toLowerCase(),
      name:                  meta.name,
      current_price:         parseFloat(t.lastPrice),
      price_change_percentage_24h: parseFloat(t.priceChangePercent),
      market_cap:            0, // not available from Binance public API
      market_cap_rank:       COIN_RANK[meta.id] ?? 99,
      total_volume:          parseFloat(t.quoteVolume), // 24h quote volume in USDT
      image:                 `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/32/color/${meta.symbol.toLowerCase()}.png`,
      // extra Binance fields stored for convenience
      _binanceSymbol:        t.symbol,
    } as CoinData & { _binanceSymbol: string };
  }).filter(Boolean) as CoinData[];
}

/**
 * Fetch OHLC klines from Binance REST and return as Candle[] tuples.
 * Candle = [timestamp, open, high, low, close]
 */
async function fetchBinanceKlines(
  binanceSymbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const res = await fetch(
    `${BINANCE_REST}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const raw: any[][] = await res.json();

  // Binance kline: [openTime, open, high, low, close, volume, ...]
  return raw.map((k) => [
    Number(k[0]),   // timestamp (ms)
    parseFloat(k[1]), // open
    parseFloat(k[2]), // high
    parseFloat(k[3]), // low
    parseFloat(k[4]), // close
  ]) as Candle[];
}

// ─── WebSocket manager ────────────────────────────────────────────────────────

/**
 * Builds a Binance combined stream URL for kline updates across all symbols.
 * e.g. wss://stream.binance.com:9443/ws/btcusdt@kline_30m/ethusdt@kline_30m/...
 */
function buildStreamUrl(interval: string): string {
  const streams = SYMBOLS.map(s => `${s.toLowerCase()}@kline_${interval}`).join('/');
  return `${BINANCE_WS_BASE}/${streams}`;
}

// ─── App Component ────────────────────────────────────────────────────────────

export default function App() {
  const [coins, setCoins]               = useState<CoinData[]>([]);
  const [ohlcRecords, setOhlcRecords]   = useState<Record<string, Candle[]>>({});
  const [settings, setSettings]         = useState<ScannerSettings>({
    wickTolerance:  0.05,
    minBodyPercent: 0.15,
  });
  const [selectedCoinId, setSelectedCoinId]         = useState<string>('bitcoin');
  const [selectedTimeframe, setSelectedTimeframe]   = useState<'30m' | '4h' | '1d'>('30m');
  const [isRefreshing, setIsRefreshing]             = useState<boolean>(false);
  const [wsStatus, setWsStatus]                     = useState<'connecting' | 'live' | 'error'>('connecting');
  const [candlesCached, setCandlesCached]           = useState<number>(0);
  const [activeSubpage, setActiveSubpage]           = useState<'blog' | 'about' | 'privacy' | 'terms' | null>(null);

  const wsRef         = useRef<WebSocket | null>(null);
  const reconnectRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Convert coin id → Binance symbol (e.g. "bitcoin" → "BTCUSDT") */
  const idToSymbol = useCallback((id: string): string | undefined => {
    return Object.keys(SYMBOL_MAP).find(sym => SYMBOL_MAP[sym].id === id);
  }, []);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  /** Initial load: fetch all tickers + all klines for selected timeframe */
  const bootstrapData = useCallback(async () => {
    // 1. Tickers
    try {
      const tickerData = await fetchBinanceTickers();
      setCoins(tickerData);
    } catch (err) {
      console.error('Failed to fetch Binance tickers:', err);
    }

    // 2. Klines for ALL symbols (bulk load)
    const interval = INTERVAL_MAP[selectedTimeframe];
    const limit    = LIMIT_MAP[selectedTimeframe];
    let total = 0;

    await Promise.allSettled(
      SYMBOLS.map(async (sym) => {
        try {
          const candles = await fetchBinanceKlines(sym, interval, limit);
          const meta    = SYMBOL_MAP[sym];
          const key     = `${meta.id}_${interval}`;
          setOhlcRecords(prev => ({ ...prev, [key]: candles }));
          total += candles.length;
        } catch (err) {
          console.warn(`Kline fetch failed for ${sym}:`, err);
        }
      })
    );

    setCandlesCached(prev => prev + total);
  }, [selectedTimeframe]);

  /** Refresh tickers only (price updates) */
  const refreshTickers = useCallback(async () => {
    try {
      const tickerData = await fetchBinanceTickers();
      setCoins(tickerData);
    } catch (err) {
      console.warn('Ticker refresh failed:', err);
    }
  }, []);

  /** On-demand kline fetch when user switches coin/timeframe */
  const fetchOhlcOnDemand = useCallback(async (
    coinId: string,
    timeframe: '30m' | '4h' | '1d'
  ) => {
    const binanceSymbol = idToSymbol(coinId);
    if (!binanceSymbol) return;
    const interval = INTERVAL_MAP[timeframe];
    const limit    = LIMIT_MAP[timeframe];
    const key      = `${coinId}_${interval}`;

    // Skip if already cached
    if (ohlcRecords[key]?.length) return;

    try {
      const candles = await fetchBinanceKlines(binanceSymbol, interval, limit);
      setOhlcRecords(prev => ({ ...prev, [key]: candles }));
      setCandlesCached(prev => prev + candles.length);
    } catch (err) {
      console.error(`On-demand kline fetch failed (${coinId} ${timeframe}):`, err);
    }
  }, [idToSymbol, ohlcRecords]);

  /** Full manual refresh */
  const handleFullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setOhlcRecords({});
    setCandlesCached(0);
    try {
      await bootstrapData();
    } finally {
      setIsRefreshing(false);
    }
  }, [bootstrapData]);

  // ── WebSocket ─────────────────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const interval = INTERVAL_MAP[selectedTimeframe];
    const url      = buildStreamUrl(interval);

    setWsStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('live');
      console.info(`[WS] Connected — ${interval} kline streams`);
    };

    ws.onmessage = (event) => {
      try {
        const msg  = JSON.parse(event.data);
        const k    = msg?.k;
        if (!k) return;

        const binanceSymbol = (msg.s as string).toUpperCase();
        const meta          = SYMBOL_MAP[binanceSymbol];
        if (!meta) return;

        const key: string      = `${meta.id}_${k.i}`;
        const newCandle: Candle = [
          Number(k.t),
          parseFloat(k.o),
          parseFloat(k.h),
          parseFloat(k.l),
          parseFloat(k.c),
        ];

        setOhlcRecords(prev => {
          const existing = prev[key] ?? [];
          if (!existing.length) return { ...prev, [key]: [newCandle] };

          const last = existing[existing.length - 1];
          // Replace the last (open) candle if same timestamp, else append
          const updated = last[0] === newCandle[0]
            ? [...existing.slice(0, -1), newCandle]
            : [...existing, newCandle];

          return { ...prev, [key]: updated };
        });

        // Also update coin price live
        setCoins(prev => prev.map(c =>
          c.id === meta.id
            ? { ...c, current_price: parseFloat(k.c) }
            : c
        ));
      } catch (err) {
        // Ignore malformed frames
      }
    };

    ws.onerror = () => {
      setWsStatus('error');
      console.warn('[WS] Error — will reconnect in 5s');
    };

    ws.onclose = () => {
      setWsStatus('error');
      // Auto-reconnect after 5s
      reconnectRef.current = setTimeout(() => connectWebSocket(), 5000);
    };
  }, [selectedTimeframe]);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Bootstrap on mount
  useEffect(() => {
    bootstrapData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect/reconnect WebSocket when timeframe changes
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [selectedTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh klines when timeframe changes (for all symbols)
  useEffect(() => {
    const interval = INTERVAL_MAP[selectedTimeframe];
    const limit    = LIMIT_MAP[selectedTimeframe];
    // Check if we already have data for this timeframe
    const hasSomeData = SYMBOLS.some(sym => {
      const meta = SYMBOL_MAP[sym];
      return !!ohlcRecords[`${meta.id}_${interval}`]?.length;
    });
    if (!hasSomeData) {
      // Fetch all klines for the new timeframe
      Promise.allSettled(
        SYMBOLS.map(async (sym) => {
          const meta = SYMBOL_MAP[sym];
          const key  = `${meta.id}_${interval}`;
          if (ohlcRecords[key]?.length) return;
          try {
            const candles = await fetchBinanceKlines(sym, interval, limit);
            setOhlcRecords(prev => ({ ...prev, [key]: candles }));
            setCandlesCached(prev => prev + candles.length);
          } catch {}
        })
      );
    }
  }, [selectedTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // On-demand fetch when user selects a coin
  useEffect(() => {
    if (selectedCoinId) fetchOhlcOnDemand(selectedCoinId, selectedTimeframe);
  }, [selectedCoinId, selectedTimeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticker price polling every 15s as backup (WebSocket covers live updates,
  // this catches any coins whose stream might have missed an update)
  useEffect(() => {
    const tickerInterval = setInterval(refreshTickers, 15_000);
    return () => clearInterval(tickerInterval);
  }, [refreshTickers]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const selectedCoinData = useMemo(() =>
    coins.find(c => c.id === selectedCoinId) ?? null,
    [coins, selectedCoinId]
  );

  const activeCandles = useMemo(() => {
    const interval = INTERVAL_MAP[selectedTimeframe];
    return ohlcRecords[`${selectedCoinId}_${interval}`] ?? [];
  }, [ohlcRecords, selectedCoinId, selectedTimeframe]);

  const handleSelectFromAlert = useCallback((coinId: string, timeframe: '30m' | '4h' | '1d') => {
    setSelectedCoinId(coinId);
    setSelectedTimeframe(timeframe);
  }, []);

  // ── WS status badge ───────────────────────────────────────────────────────

  const WsBadge = () => {
    const config = {
      live:       { color: 'emerald', label: 'LIVE  WebSocket Feed' },
      connecting: { color: 'amber',   label: 'CONNECTING...'        },
      error:      { color: 'red',     label: 'RECONNECTING...'      },
    }[wsStatus];

    return (
      <div className={`flex items-center gap-2 bg-${config.color}-50 border border-${config.color}-100 px-3 py-1.5 rounded-lg text-[10px] text-${config.color}-700 font-mono`}>
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${config.color}-400 opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 bg-${config.color}-500`}></span>
        </span>
        <span><strong className={`font-bold text-${config.color}-800`}>{config.label}</strong></span>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F4F4F7] text-[#1A1A1E] flex flex-col font-sans selection:bg-slate-900/10 selection:text-[#1A1A1E]">

      {/* Header */}
      <header className="border-b border-[#E2E2E9] bg-white sticky top-0 z-40 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col gap-4">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveSubpage(null)}>
              <div className="w-8 h-8 bg-[#1A1A1E] flex items-center justify-center rounded-md shrink-0">
                <div className="w-4 h-6 bg-white rounded-sm"></div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold tracking-tighter text-xl text-[#1A1A1E]">
                    MARUBOZU<span className="text-[#6B7280] font-light">SCAN</span>
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] text-[9px] font-mono px-2 py-0.5 rounded-full uppercase">
                    Beta v1.2
                  </span>
                </div>
                <p className="text-[#6B7280] text-[11px] mt-0.5 font-sans leading-tight">
                  Mathematical breakout confirmation for high-momentum cryptocurrency trading
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">

              {/* Live status badge */}
              <WsBadge />

              {/* Cache info */}
              {candlesCached > 0 && (
                <div className="flex items-center gap-2 bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-[10px] text-[#64748B] font-mono">
                  <Database className="w-3.5 h-3.5 text-[#334155]" />
                  <span>Candles cached: <strong className="text-[#1A1A1E]">{candlesCached.toLocaleString()}</strong></span>
                </div>
              )}

              <button
                onClick={handleFullRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-[#1A1A1E] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition shadow-sm disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh Data'}</span>
              </button>

            </div>
          </div>

          <hr className="border-[#E2E2E9]" />

          <nav className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {([
              { key: null,      label: 'Scanner'         },
              { key: 'blog',    label: 'Academy (Blog)'  },
              { key: 'about',   label: 'About Us'        },
              { key: 'privacy', label: 'Privacy Policy'  },
              { key: 'terms',   label: 'Terms of Use'    },
            ] as const).map(({ key, label }) => (
              <button
                key={String(key)}
                onClick={() => setActiveSubpage(key)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${
                  activeSubpage === key
                    ? 'bg-[#1A1A1E] text-white'
                    : 'text-[#64748B] hover:text-[#1A1A1E] hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

        </div>
      </header>

      {/* Main */}
      <main className="flex-grow p-4 md:p-6">
        {activeSubpage !== null ? (
          <AdsenseDocPages currentSubpage={activeSubpage} setCurrentSubpage={setActiveSubpage} />
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">

            <StatsPanel
              coins={coins}
              ohlcRecords={ohlcRecords}
              settings={settings}
              selectedTimeframe={selectedTimeframe}
            />

            <section className="w-full">
              <CandlestickChart
                coin={selectedCoinData}
                candles={activeCandles}
                settings={settings}
                daysParam={INTERVAL_MAP[selectedTimeframe]}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <section className="lg:col-span-12 xl:col-span-7 flex flex-col">
                <div className="flex-1 flex flex-col h-full">
                  <ScannerTable
                    coins={coins}
                    ohlcRecords={ohlcRecords}
                    settings={settings}
                    selectedCoinId={selectedCoinId}
                    setSelectedCoinId={setSelectedCoinId}
                    selectedTimeframe={selectedTimeframe}
                    setSelectedTimeframe={setSelectedTimeframe}
                    onRefreshAll={handleFullRefresh}
                    isRefreshing={isRefreshing}
                  />
                </div>
              </section>

              <section className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-1 gap-6">
                  <NotificationCenter
                    coins={coins}
                    ohlcRecords={ohlcRecords}
                    settings={settings}
                    onSelectCoin={handleSelectFromAlert}
                  />
                  <EducationPanel
                    settings={settings}
                    setSettings={setSettings}
                  />
                </div>
              </section>
            </div>

          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E2E9] bg-white p-6 md:py-8 text-xs text-[#64748B] font-sans">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center md:text-left">
            <div className="flex items-center gap-1.5 justify-center md:justify-start font-bold text-[#1A1A1E]">
              <Shield className="w-4 h-4 text-blue-500" />
              <span>Binance API &bull; No API Key Required &bull; Real-Time WebSocket</span>
            </div>
            <span>No investment advice. Candlestick patterns represent historical statistical drives only. &copy; 2026 Crypto Marubozu Scanner.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-semibold">
            {([
              { key: null,      label: 'Scanner Dashboard' },
              { key: 'blog',    label: 'Blog (Academy)'    },
              { key: 'about',   label: 'About Us'          },
              { key: 'privacy', label: 'Privacy Policy'    },
              { key: 'terms',   label: 'Terms of Use'      },
            ] as const).map(({ key, label }, i, arr) => (
              <React.Fragment key={String(key)}>
                <button onClick={() => setActiveSubpage(key)} className="text-[#64748B] hover:text-[#1A1A1E] transition">
                  {label}
                </button>
                {i < arr.length - 1 && <span className="text-[#E2E2E9] select-none">|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
