/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Search, TrendingUp, TrendingDown, RefreshCw, Coins, ArrowUpDown } from 'lucide-react';
import { CoinData, Candle, ScannerSettings } from '../types';
import { detectMarubozu } from '../utils/scanner';

interface ScannerTableProps {
  coins: CoinData[];
  ohlcRecords: Record<string, Candle[]>;
  settings: ScannerSettings;
  selectedCoinId: string;
  setSelectedCoinId: (id: string) => void;
  selectedTimeframe: '30m' | '4h' | '1d';
  setSelectedTimeframe: (tf: '30m' | '4h' | '1d') => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}

type SortField = 'rank' | 'name' | 'price' | 'change';
type SortOrder = 'asc' | 'desc';

export default function ScannerTable({
  coins,
  ohlcRecords,
  settings,
  selectedCoinId,
  setSelectedCoinId,
  selectedTimeframe,
  setSelectedTimeframe,
  onRefreshAll,
  isRefreshing
}: ScannerTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [patternFilter, setPatternFilter] = useState<'all' | 'bullish' | 'bearish' | 'any'>('all');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedCoins = useMemo(() => {
    return coins.map(coin => {
      // Keys now use interval strings: 30m / 4h / 1d
      const candles30m = ohlcRecords[`${coin.id}_30m`] || [];
      const status30m  = detectMarubozu(candles30m, settings, true);

      const candles4h  = ohlcRecords[`${coin.id}_4h`] || [];
      const status4h   = detectMarubozu(candles4h, settings, true);

      const candles1d  = ohlcRecords[`${coin.id}_1d`] || [];
      const status1d   = detectMarubozu(candles1d, settings, true);

      return {
        ...coin,
        patterns: {
          '30m': status30m,
          '4h':  status4h,
          '1d':  status1d,
        }
      };
    });
  }, [coins, ohlcRecords, settings]);

  const filteredCoins = useMemo(() => {
    let result = processedCoins.filter(coin => {
      const matchSearch =
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      const currentPattern = coin.patterns[selectedTimeframe];
      if (patternFilter === 'bullish') return currentPattern.type === 'bullish';
      if (patternFilter === 'bearish') return currentPattern.type === 'bearish';
      if (patternFilter === 'any')     return currentPattern.type !== 'none';
      return true;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'rank') {
        comparison = (a.market_cap_rank ?? 999) - (b.market_cap_rank ?? 999);
      } else if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'price') {
        comparison = a.current_price - b.current_price;
      } else if (sortField === 'change') {
        comparison = a.price_change_percentage_24h - b.price_change_percentage_24h;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [processedCoins, searchQuery, patternFilter, sortField, sortOrder, selectedTimeframe]);

  const stats = useMemo(() => ({
    total:        processedCoins.length,
    bullishCount: processedCoins.filter(c => c.patterns[selectedTimeframe].type === 'bullish').length,
    bearishCount: processedCoins.filter(c => c.patterns[selectedTimeframe].type === 'bearish').length,
  }), [processedCoins, selectedTimeframe]);

  return (
    <div id="scanner-table-section" className="bg-white border border-[#E2E2E9] rounded-xl p-6 shadow-sm flex flex-col h-full">
      {/* Header controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[#E2E2E9]">
        <div>
          <div className="flex items-center gap-2">
            <Coins id="icon-coins-logo" className="text-[#1A1A1E] w-5 h-5" />
            <h2 className="text-lg font-bold text-[#1A1A1E] tracking-tight">Real-Time Core Scanner</h2>
          </div>
          <p className="text-[#64748B] text-xs mt-1 font-sans">
            Analyze the top 25 high-volume assets for full-bodied candles with negligible wicks.
          </p>
        </div>

        <div className="flex bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] self-start sm:self-center">
          {(['30m', '4h', '1d'] as const).map(tf => (
            <button
              id={`tf-btn-${tf}`}
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                selectedTimeframe === tf
                  ? 'bg-white text-[#1A1A1E] shadow-sm border border-[#E2E8F0]'
                  : 'text-[#64748B] hover:text-[#1A1A1E]'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 my-6">
        <div className="md:col-span-5 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
          <input
            id="searchInputField"
            type="text"
            placeholder="Search symbol or asset name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-[#E2E2E9] text-[#1A1A1E] text-sm pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-400 focus:border-slate-400 transition"
          />
        </div>

        <div className="md:col-span-7 flex flex-wrap gap-2 items-center justify-start md:justify-end">
          {[
            { key: 'all',     label: `All Coins (${stats.total})` },
            { key: 'bullish', label: `Bullish (${stats.bullishCount})`, dot: '#22C55E' },
            { key: 'bearish', label: `Bearish (${stats.bearishCount})`, dot: '#EF4444' },
          ].map(({ key, label, dot }) => (
            <button
              id={`btn-filter-${key}`}
              key={key}
              onClick={() => setPatternFilter(key as any)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition duration-150 flex items-center gap-1.5 ${
                patternFilter === key
                  ? key === 'all'
                    ? 'bg-[#1A1A1E] text-white border-transparent'
                    : key === 'bullish'
                      ? 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7] shadow-sm'
                      : 'bg-[#FEF2F2] text-[#991B1B] border-[#FEE2E2] shadow-sm'
                  : 'bg-white text-[#64748B] border-[#E2E2E9] hover:bg-slate-50'
              }`}
            >
              {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot }}></span>}
              {label}
            </button>
          ))}

          <button
            id="btn-refresh-scanner"
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="p-2 bg-white border border-[#E2E2E9] hover:bg-slate-50 rounded-lg text-[#64748B] hover:text-[#1A1A1E] transition disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Coins list */}
      <div className="flex-grow overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        {filteredCoins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-[#F8FAFC] rounded-lg border border-dashed border-[#E2E2E9]">
            <p className="text-[#1A1A1E] text-sm font-medium">No assets matching parameters found.</p>
            <p className="text-[#64748B] text-xs mt-1 max-w-xs">
              Try adjusting the wick tolerance or settings panel on the side menu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E2E9] pb-3 text-[#64748B] text-xs uppercase font-medium">
                  <th className="py-3 px-2 cursor-pointer hover:text-[#1A1A1E]" onClick={() => handleSort('rank')}>
                    <div className="flex items-center gap-1 font-semibold">Rank <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                  </th>
                  <th className="py-3 px-2 cursor-pointer hover:text-[#1A1A1E]" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1 font-semibold">Asset <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                  </th>
                  <th className="py-3 px-2 cursor-pointer hover:text-[#1A1A1E] text-right" onClick={() => handleSort('price')}>
                    <div className="flex items-center gap-1 justify-end font-semibold">Price <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                  </th>
                  <th className="py-3 px-2 cursor-pointer hover:text-[#1A1A1E] text-right" onClick={() => handleSort('change')}>
                    <div className="flex items-center gap-1 justify-end font-semibold">24h Chg <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                  </th>
                  <th className="py-3 px-2 text-center text-xs font-semibold">
                    Pattern Status ({selectedTimeframe.toUpperCase()})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredCoins.map(coin => {
                  const pattern    = coin.patterns[selectedTimeframe];
                  // Check if we have candle data for this timeframe
                  const hasCandles = (ohlcRecords[`${coin.id}_${selectedTimeframe}`] || []).length > 0;
                  const isSelected = selectedCoinId === coin.id;

                  return (
                    <tr
                      id={`coin-row-${coin.id}`}
                      key={coin.id}
                      onClick={() => setSelectedCoinId(coin.id)}
                      className={`group cursor-pointer hover:bg-[#F8FAFC] transition-all duration-150 ${
                        isSelected ? 'bg-[#F1F5F9] border-l-4 border-[#1A1A1E]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-2 font-mono text-xs text-[#94A3B8] group-hover:text-[#64748B]">
                        #{coin.market_cap_rank ?? '—'}
                      </td>

                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            referrerPolicy="no-referrer"
                            src={coin.image}
                            alt={coin.name}
                            className="w-6 h-6 rounded-full bg-white border border-[#E2E2E9]"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div>
                            <span className="font-bold text-[#1A1A1E] transition block text-sm leading-tight">
                              {coin.symbol.toUpperCase()}
                            </span>
                            <span className="text-[#64748B] text-xs font-normal leading-tight">
                              {coin.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-2 text-right font-mono text-sm font-semibold text-[#1A1A1E]">
                        ${coin.current_price >= 1
                          ? coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                      </td>

                      <td className="py-3.5 px-2 text-right text-xs">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-semibold ${
                          coin.price_change_percentage_24h >= 0
                            ? 'text-[#166534] bg-[#F0FDF4]'
                            : 'text-[#991B1B] bg-[#FEF2F2]'
                        }`}>
                          {coin.price_change_percentage_24h >= 0
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                        </div>
                      </td>

                      <td className="py-3.5 px-2 text-center text-xs">
                        {!hasCandles ? (
                          <div className="flex items-center justify-center gap-1.5 py-1 text-[#94A3B8]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse"></span>
                            <span className="font-mono text-[10px]">LOADING</span>
                          </div>
                        ) : pattern.type === 'bullish' ? (
                          <div className="inline-flex items-center justify-center gap-1 bg-[#DCFCE7] text-[#15803D] px-3 py-1 rounded-md border border-[#BBF7D0]">
                            <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
                            <span className="font-bold text-xs font-mono tracking-tight uppercase">BULLISH</span>
                          </div>
                        ) : pattern.type === 'bearish' ? (
                          <div className="inline-flex items-center justify-center gap-1 bg-[#FEE2E2] text-[#B91C1C] px-3 py-1 rounded-md border border-[#FECACA]">
                            <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                            <span className="font-bold text-xs font-mono tracking-tight uppercase">BEARISH</span>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8] font-mono text-xs font-light">Neutral</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
