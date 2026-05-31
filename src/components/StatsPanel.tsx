/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { CoinData, Candle, ScannerSettings } from '../types';
import { detectMarubozu } from '../utils/scanner';
import { BarChart2, Activity, ShieldAlert, Zap } from 'lucide-react';

interface StatsPanelProps {
  coins: CoinData[];
  ohlcRecords: Record<string, Candle[]>;
  settings: ScannerSettings;
  selectedTimeframe: '30m' | '4h' | '1d';
}

export default function StatsPanel({
  coins,
  ohlcRecords,
  settings,
  selectedTimeframe
}: StatsPanelProps) {

  const analytics = useMemo(() => {
    let totalScanned = 0;
    let bullishCount = 0;
    let bearishCount = 0;

    let strongestBull: { symbol: string; bodySize: number } | null = null;
    let strongestBear: { symbol: string; bodySize: number } | null = null;

    coins.forEach(coin => {
      // Keys are now interval strings: 30m / 4h / 1d
      const cacheKey = `${coin.id}_${selectedTimeframe}`;
      const candles  = ohlcRecords[cacheKey] || [];

      if (candles.length > 0) {
        const status = detectMarubozu(candles, settings, true);

        if (status.type === 'bullish') {
          bullishCount++;
          if (!strongestBull || status.bodyPercent > strongestBull.bodySize) {
            strongestBull = { symbol: coin.symbol, bodySize: status.bodyPercent };
          }
        } else if (status.type === 'bearish') {
          bearishCount++;
          if (!strongestBear || status.bodyPercent > strongestBear.bodySize) {
            strongestBear = { symbol: coin.symbol, bodySize: status.bodyPercent };
          }
        }
      }
      totalScanned++;
    });

    const netRatio = bullishCount + bearishCount > 0
      ? (bullishCount / (bullishCount + bearishCount)) * 100
      : 50;

    let sentiment      = 'NEUTRAL / CAUTIOUS';
    let sentimentColor = 'text-[#64748B]';
    let sentimentBg    = 'bg-[#F1F5F9] border-[#E2E8F0]';

    if (bullishCount > bearishCount && bullishCount > 0) {
      sentiment      = bullishCount > bearishCount * 2 ? 'EXPLOSIVE BUY PRESSURE' : 'BULLISH CONTINUATION';
      sentimentColor = 'text-[#166534]';
      sentimentBg    = 'bg-[#F0FDF4] border-[#DCFCE7]';
    } else if (bearishCount > bullishCount && bearishCount > 0) {
      sentiment      = bearishCount > bullishCount * 2 ? 'PANIC SELL-OFFS' : 'BEARISH ACCELERATION';
      sentimentColor = 'text-[#991B1B]';
      sentimentBg    = 'bg-[#FEF2F2] border-[#FEE2E2]';
    }

    return {
      totalScanned,
      bullishCount,
      bearishCount,
      netRatio,
      sentiment,
      sentimentColor,
      sentimentBg,
      strongestBull,
      strongestBear,
    };
  }, [coins, ohlcRecords, settings, selectedTimeframe]);

  return (
    <div id="stats-panel-section" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">

      {/* 1. Market Sentiment */}
      <div className={`border p-4 rounded-xl flex flex-col justify-between transition-all duration-300 shadow-sm ${analytics.sentimentBg}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] font-mono">Market Momentum</span>
          <Activity className="w-4 h-4 text-[#94A3B8]" />
        </div>
        <div className="mt-4">
          <div className={`text-sm font-black tracking-tight ${analytics.sentimentColor}`}>
            {analytics.sentiment}
          </div>
          <p className="text-[10px] text-[#64748B] mt-0.5 leading-tight font-sans">
            Compiled from Marubozu ratios on {selectedTimeframe.toUpperCase()} charts.
          </p>
        </div>
      </div>

      {/* 2. Signal Proportions */}
      <div className="bg-white border border-[#E2E2E9] p-4 rounded-xl flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] font-mono">Signal Proportions</span>
          <BarChart2 className="w-4 h-4 text-[#94A3B8]" />
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] font-bold font-mono mb-1">
            <span className="text-[#166534]">🟢 {analytics.bullishCount} Bull</span>
            <span className="text-[#991B1B]">{analytics.bearishCount} Bear 🔴</span>
          </div>
          <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden flex border border-[#E2E8F0]">
            {analytics.bullishCount + analytics.bearishCount === 0 ? (
              <div className="w-full bg-[#E2E8F0] h-full"></div>
            ) : (
              <>
                <div className="bg-[#22C55E] h-full" style={{ width: `${analytics.netRatio}%` }} />
                <div className="bg-[#EF4444] h-full" style={{ width: `${100 - analytics.netRatio}%` }} />
              </>
            )}
          </div>
          <div className="flex justify-between text-[9px] text-[#64748B] mt-1 font-mono">
            <span>{analytics.netRatio.toFixed(0)}% Buy Block</span>
            <span>{(100 - analytics.netRatio).toFixed(0)}% Sell Block</span>
          </div>
        </div>
      </div>

      {/* 3. Strongest Bullish */}
      <div className="bg-white border border-[#E2E2E9] p-4 rounded-xl flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] font-mono">Strongest Bullish Drive</span>
          <Zap className="w-4 h-4 text-[#22C55E]" />
        </div>
        <div className="mt-4">
          {analytics.strongestBull ? (
            <div>
              <div className="text-md font-extrabold text-[#111827] font-mono">
                {analytics.strongestBull.symbol.toUpperCase()}
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5 font-sans leading-tight">
                Body height: <span className="font-bold text-[#166634]">+{analytics.strongestBull.bodySize.toFixed(2)}%</span>
              </p>
            </div>
          ) : (
            <div>
              <div className="text-xs text-[#94A3B8] font-medium font-sans">None Scanned</div>
              <p className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">No bullish patterns currently match.</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Strongest Bearish */}
      <div className="bg-white border border-[#E2E2E9] p-4 rounded-xl flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] font-mono">Strongest Bearish Crash</span>
          <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
        </div>
        <div className="mt-4">
          {analytics.strongestBear ? (
            <div>
              <div className="text-md font-extrabold text-[#111827] font-mono">
                {analytics.strongestBear.symbol.toUpperCase()}
              </div>
              <p className="text-[10px] text-[#64748B] mt-0.5 font-sans leading-tight">
                Body height: <span className="font-bold text-[#991B1B]">-{analytics.strongestBear.bodySize.toFixed(2)}%</span>
              </p>
            </div>
          ) : (
            <div>
              <div className="text-xs text-[#94A3B8] font-medium font-sans">None Scanned</div>
              <p className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">No bearish patterns currently match.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
