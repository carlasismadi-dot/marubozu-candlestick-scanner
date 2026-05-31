/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CoinData, Candle, ScannerSettings } from './types';
import ScannerTable from './components/ScannerTable';
import CandlestickChart from './components/CandlestickChart';
import EducationPanel from './components/EducationPanel';
import StatsPanel from './components/StatsPanel';
import NotificationCenter from './components/NotificationCenter';
import AdsenseDocPages from './components/AdsenseDocPages';
import { Terminal, Shield, RefreshCw, Cpu, Database, BookOpen, FileText, Info, Compass } from 'lucide-react';

export default function App() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [ohlcRecords, setOhlcRecords] = useState<Record<string, Candle[]>>({});
  const [settings, setSettings] = useState<ScannerSettings>({
    wickTolerance: 0.05,
    minBodyPercent: 0.15
  });
  const [selectedCoinId, setSelectedCoinId] = useState<string>('bitcoin');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30m' | '4h' | '1d'>('1d');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [activeSubpage, setActiveSubpage] = useState<'blog' | 'about' | 'privacy' | 'terms' | null>(null);

  const daysMap = {
    '30m': '1',
    '4h': '7',
    '1d': '30'
  };

  const COINGECKO_API_KEY = 'CG-qVHh6XuVFje6cb54EQ7VUHog';
  const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
  const STATIC_COIN_IDS = [
    'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple',
    'cardano', 'dogecoin', 'polkadot', 'chainlink', 'avalanche-2',
    'shiba-inu', 'tron', 'fantom', 'near', 'uniswap',
    'litecoin', 'stellar', 'cosmos', 'render-token', 'vechain',
    'optimism', 'arbitrum', 'sui', 'aptos', 'pepe'
  ];

  const [isOfflineFallback, setIsOfflineFallback] = useState<boolean>(false);

  const fetchCoins = async () => {
    try {
      const res = await fetch('/api/coins');
      if (res.ok) {
        const data = await res.json();
        setCoins(data);
        if (data.length > 0 && !selectedCoinId) setSelectedCoinId(data[0].id);
      } else {
        throw new Error('Server returned non-ok status');
      }
    } catch (e) {
      console.warn('API backend/Express server is offline. Enabling direct client-side fallback...');
      setIsOfflineFallback(true);
      try {
        const directRes = await fetch(
          `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${STATIC_COIN_IDS.join(',')}&order=market_cap_desc&per_page=50&page=1&sparkline=false&x_cg_demo_api_key=${COINGECKO_API_KEY}`
        );
        if (directRes.ok) {
          const data = await directRes.json();
          setCoins(data);
          if (data.length > 0 && !selectedCoinId) setSelectedCoinId(data[0].id);
        }
      } catch (directErr) {
        console.error('Failed direct CoinGecko market fetch:', directErr);
      }
    }
  };

  const fetchAllOhlc = async () => {
    if (isOfflineFallback || window.location.hostname.includes('netlify')) return;
    try {
      const res = await fetch('/api/ohlc-all');
      if (res.ok) {
        const data = await res.json();
        setOhlcRecords(prev => ({ ...prev, ...data }));
      } else {
        setIsOfflineFallback(true);
      }
    } catch (e) {
      console.error('Failed to load global candles cache:', e);
      setIsOfflineFallback(true);
    }
  };

  const fetchHealthState = async () => {
    if (isOfflineFallback || window.location.hostname.includes('netlify')) return;
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (e) {}
  };

  const fetchOhlcOnDemand = async (coinId: string, timeframe: '30m' | '4h' | '1d') => {
    const daysParam = daysMap[timeframe];
    const cacheKey = `${coinId}_${daysParam}`;

    if (isOfflineFallback || window.location.hostname.includes('netlify')) {
      try {
        const directRes = await fetch(
          `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${daysParam}&x_cg_demo_api_key=${COINGECKO_API_KEY}`
        );
        if (directRes.ok) {
          const rawData = await directRes.json();
          const formattedCandles: Candle[] = rawData.map((item: any) => [
            Number(item[0]), Number(item[1]), Number(item[2]), Number(item[3]), Number(item[4])
          ]);
          setOhlcRecords(prev => ({ ...prev, [cacheKey]: formattedCandles }));
        }
      } catch (err) {
        console.error(`Direct fallback fetch failed for ${coinId}:`, err);
      }
      return;
    }

    try {
      const res = await fetch(`/api/ohlc?coinId=${coinId}&days=${daysParam}`);
      if (res.ok) {
        const data = await res.json();
        setOhlcRecords(prev => ({ ...prev, [cacheKey]: data }));
      } else {
        setIsOfflineFallback(true);
      }
    } catch (e) {
      console.error(`Failed on-demand fetch of ${coinId} (${timeframe}):`, e);
      setIsOfflineFallback(true);
    }
  };

  const handleFullRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
      setOhlcRecords({});
      await fetchCoins();
      await fetchAllOhlc();
      await fetchHealthState();
      await fetchOhlcOnDemand(selectedCoinId, selectedTimeframe);
    } catch (e) {
      console.error('Cache clear failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCoins();
    fetchAllOhlc();
    fetchHealthState();
    const interval = setInterval(() => {
      fetchAllOhlc();
      fetchHealthState();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCoinId) fetchOhlcOnDemand(selectedCoinId, selectedTimeframe);
  }, [selectedCoinId, selectedTimeframe]);

  const selectedCoinData = useMemo(() => {
    return coins.find(c => c.id === selectedCoinId) || null;
  }, [coins, selectedCoinId]);

  const activeCandles = useMemo(() => {
    const daysParam = daysMap[selectedTimeframe];
    return ohlcRecords[`${selectedCoinId}_${daysParam}`] || [];
  }, [ohlcRecords, selectedCoinId, selectedTimeframe]);

  const handleSelectFromAlert = (coinId: string, timeframe: '30m' | '4h' | '1d') => {
    setSelectedCoinId(coinId);
    setSelectedTimeframe(timeframe);
  };

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
                    Beta v1.1
                  </span>
                </div>
                <p className="text-[#6B7280] text-[11px] mt-0.5 font-sans leading-tight">
                  Mathematical breakout confirmation for high-momentum cryptocurrency trading
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
              {isOfflineFallback || window.location.hostname.includes('netlify') ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-[10px] text-emerald-700 font-mono">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Direct Data Feed: <strong className="font-bold text-emerald-800">SECURE CLIENT NODE</strong></span>
                </div>
              ) : systemHealth ? (
                <div className="flex items-center gap-4 bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-1.5 rounded-lg text-[10px] text-[#64748B] font-mono flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#334155]" />
                    <span>Pool Cache: <strong className="text-[#1A1A1E]">{systemHealth.candlesCached} candles</strong></span>
                  </span>
                  <span className="hidden sm:inline h-4 w-[1px] bg-[#E2E2E9]"></span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#334155] animate-spin" style={{ animationDuration: '6s' }} />
                    <span>Crawl active: <strong className="text-[#1A1A1E]">{(systemHealth.crawler.currentCoin || '').toUpperCase()}</strong></span>
                  </span>
                  {systemHealth.crawler.isBackingOff && (
                    <>
                      <span className="hidden sm:inline h-4 w-[1px] bg-[#E2E2E9]"></span>
                      <span className="text-amber-600 font-bold animate-pulse">▲ RATE LIMITS</span>
                    </>
                  )}
                </div>
              ) : null}

              <button
                id="refreshAllCachesButton"
                onClick={handleFullRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 bg-[#1A1A1E] hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition shadow-sm disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Re-aligning Caches...' : 'Sync Caches'}</span>
              </button>
            </div>
          </div>

          <hr className="border-[#E2E2E9]" />

          <div className="flex items-center justify-between gap-4">
            <nav className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none w-full">
              {[
                { key: null, label: 'Scanner' },
                { key: 'blog', label: 'Academy (Blog)' },
                { key: 'about', label: 'About Us' },
                { key: 'privacy', label: 'Privacy Policy' },
                { key: 'terms', label: 'Terms of Use' },
              ].map(({ key, label }) => (
                <button
                  key={String(key)}
                  onClick={() => setActiveSubpage(key as any)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0 ${
                    activeSubpage === key ? 'bg-[#1A1A1E] text-white' : 'text-[#64748B] hover:text-[#1A1A1E] hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="flex-grow p-4 md:p-6">
        {activeSubpage !== null ? (
          <AdsenseDocPages currentSubpage={activeSubpage} setCurrentSubpage={setActiveSubpage} />
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Stats ribbon */}
            <StatsPanel
              coins={coins}
              ohlcRecords={ohlcRecords}
              settings={settings}
              selectedTimeframe={selectedTimeframe}
            />

            {/* Full-width chart */}
            <section className="w-full">
              <CandlestickChart
                coin={selectedCoinData}
                candles={activeCandles}
                settings={settings}
                daysParam={daysMap[selectedTimeframe]}
              />
            </section>

            {/* ── Two-column row: Scanner (left) + Alerts/Education (right) ──
                items-stretch  → both columns grow to the same height
                On mobile (< lg) grid collapses to 1 col so stretch has no effect */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

              {/* Left — Scanner, stretches to fill column height */}
              <section className="lg:col-span-12 xl:col-span-7 flex flex-col">
                {/* flex-1 + h-full pushes ScannerTable to fill remaining space */}
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

              {/* Right — Alerts + Education */}
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
              <span>CoinGecko API Terminal &bull; Managed Securely Server-side</span>
            </div>
            <span>No investment advice. Candlestick patterns represent historical statistical drives only. &copy; 2026 Crypto Marubozu Scanner.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-semibold">
            {[
              { key: null, label: 'Scanner Dashboard' },
              { key: 'blog', label: 'Blog (Academy)' },
              { key: 'about', label: 'About Us' },
              { key: 'privacy', label: 'Privacy Policy' },
              { key: 'terms', label: 'Terms of Use' },
            ].map(({ key, label }, i, arr) => (
              <React.Fragment key={String(key)}>
                <button onClick={() => setActiveSubpage(key as any)} className="text-[#64748B] hover:text-[#1A1A1E] transition">
                  {label}
                </button>
                {i < arr.length - 1 && <span className="text-[#E2E8F0] select-none">|</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
