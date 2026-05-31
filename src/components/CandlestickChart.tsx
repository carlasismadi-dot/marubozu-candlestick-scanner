/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Candle, ScannerSettings, CoinData } from '../types';
import { detectMarubozu, formatTimeLabel } from '../utils/scanner';
import { Cpu, Info, ZoomIn, ZoomOut } from 'lucide-react';

interface CandlestickChartProps {
  coin: CoinData | null;
  candles: Candle[];
  settings: ScannerSettings;
  /** Now receives the interval string: '30m' | '4h' | '1d' */
  daysParam: string;
}

/** Human-readable label for the interval */
function intervalLabel(daysParam: string): string {
  if (daysParam === '30m') return '30M intervals';
  if (daysParam === '4h')  return '4H intervals';
  if (daysParam === '1d')  return '1D intervals';
  return daysParam;
}

export default function CandlestickChart({
  coin,
  candles,
  settings,
  daysParam
}: CandlestickChartProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [zoomRange,     setZoomRange]       = useState<number>(40);
  const [hoverIndex,    setHoverIndex]      = useState<number | null>(null);
  const [mouseSvgY,     setMouseSvgY]       = useState(0);

  const SVG_HEIGHT = 420;
  const padding    = { top: 30, right: 75, bottom: 40, left: 20 };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      setContainerWidth(Math.max(entries[0].contentRect.width, 300));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const SVG_WIDTH  = containerWidth;
  const chartWidth  = SVG_WIDTH  - padding.left - padding.right;
  const chartHeight = SVG_HEIGHT - padding.top  - padding.bottom;

  const visibleCandles = useMemo(() => {
    if (candles.length === 0) return [];
    const count = Math.min(zoomRange, candles.length);
    return candles.slice(candles.length - count);
  }, [candles, zoomRange]);

  const originalIndices = useMemo(() => {
    if (candles.length === 0) return [];
    const count = Math.min(zoomRange, candles.length);
    return Array.from({ length: count }, (_, i) => candles.length - count + i);
  }, [candles, zoomRange]);

  const priceEnvelope = useMemo(() => {
    if (visibleCandles.length === 0) return { min: 0, max: 100 };
    let minPrice =  Infinity;
    let maxPrice = -Infinity;
    visibleCandles.forEach(([_, open, high, low]) => {
      if (low  < minPrice) minPrice = low;
      if (high > maxPrice) maxPrice = high;
    });
    const pad = (maxPrice - minPrice) * 0.08 || 5;
    return { min: minPrice - pad, max: maxPrice + pad };
  }, [visibleCandles]);

  const getX = (index: number) => {
    if (visibleCandles.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (visibleCandles.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    const range = priceEnvelope.max - priceEnvelope.min;
    if (range === 0) return padding.top + chartHeight / 2;
    return padding.top + chartHeight - ((price - priceEnvelope.min) / range) * chartHeight;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (visibleCandles.length === 0) return;
    const rect   = e.currentTarget.getBoundingClientRect();
    const scaleX = SVG_WIDTH  / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    const svgX   = (e.clientX - rect.left) * scaleX;
    const svgY   = (e.clientY - rect.top)  * scaleY;
    setMouseSvgY(svgY);
    const x = svgX - padding.left;
    if (x < 0 || x > chartWidth) { setHoverIndex(null); return; }
    const index = Math.round((x / chartWidth) * (visibleCandles.length - 1));
    setHoverIndex(index >= 0 && index < visibleCandles.length ? index : null);
  };

  const handleMouseLeave = () => setHoverIndex(null);

  const candlePatterns = useMemo(() => {
    return visibleCandles.map((_, idx) => {
      const historicalSubArray = candles.slice(0, originalIndices[idx] + 1);
      return detectMarubozu(historicalSubArray, settings, false);
    });
  }, [visibleCandles, candles, originalIndices, settings]);

  const activeHoverCandleData = useMemo(() => {
    if (hoverIndex === null || hoverIndex >= visibleCandles.length) return null;
    const candle  = visibleCandles[hoverIndex];
    const pattern = candlePatterns[hoverIndex];
    const [time, open, high, low, close] = candle;
    const bodySize = Math.abs(close - open);
    const range    = high - low;
    const bodyPct  = (bodySize / open) * 100;
    const wickPct  = range > 0 ? ((range - bodySize) / range) * 100 : 0;
    return { pattern, bodyPct, wickPct, time, open, high, low, close };
  }, [hoverIndex, visibleCandles, candlePatterns]);

  const fmt = (v: number) =>
    v < 1
      ? v.toFixed(4)
      : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div id="interactive-chart-section" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 mb-4">
        <div>
          <div className="flex items-center gap-2">
            {coin && (
              <img
                src={coin.image}
                alt={coin.name}
                className="w-5 h-5 rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <h3 className="text-md font-bold text-slate-100 uppercase tracking-tight">
              {coin ? `${coin.name} (${coin.symbol.toUpperCase()})` : 'Candlestick Blueprint'}
            </h3>
            <span className="text-slate-500 font-mono text-xs">
              {intervalLabel(daysParam)}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3 h-3 text-blue-400" /> Client-side scanned w/ tolerance
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-yellow-400">
              Wick Max: {(settings.wickTolerance * 100).toFixed(0)}%
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-indigo-400">
              Body Min: {settings.minBodyPercent}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setZoomRange(prev => Math.min(prev + 10, candles.length || 100))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-slate-400 text-xs font-mono px-2 font-bold select-none">
            {zoomRange} candles
          </span>
          <button
            onClick={() => setZoomRange(prev => Math.max(prev - 10, 10))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {candles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-300 text-sm font-semibold">Resolving Candle Streams...</p>
          <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
            Fetching live data from Binance. Please wait a few seconds.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* OHLC Hover Info Strip */}
          <div className="bg-slate-950 border border-slate-800/80 p-3.5 rounded-2xl grid grid-cols-2 lg:grid-cols-5 gap-3">
            {activeHoverCandleData ? (
              <>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">TIMESTAMP</div>
                  <div className="text-xs text-slate-200 mt-0.5 font-bold font-mono">
                    {formatTimeLabel(activeHoverCandleData.time, daysParam)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">OPEN &amp; CLOSE</div>
                  <div className="text-xs font-bold font-mono mt-0.5 flex gap-2">
                    <span className="text-slate-300">${fmt(activeHoverCandleData.open)}</span>
                    <span className="text-slate-500">→</span>
                    <span className={activeHoverCandleData.close >= activeHoverCandleData.open ? 'text-emerald-400' : 'text-rose-400'}>
                      ${fmt(activeHoverCandleData.close)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">RANGE (H–L)</div>
                  <div className="text-xs text-slate-300 mt-0.5 font-bold font-mono">
                    ${fmt(activeHoverCandleData.high)} – ${fmt(activeHoverCandleData.low)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">BODY / WICK</div>
                  <div className="text-xs mt-0.5 font-bold font-mono flex gap-1.5">
                    <span className="text-slate-200">{activeHoverCandleData.bodyPct.toFixed(2)}%</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">{activeHoverCandleData.wickPct.toFixed(0)}% wicks</span>
                  </div>
                </div>
                <div className="col-span-2 lg:col-span-1 flex items-center">
                  {activeHoverCandleData.pattern.type === 'bullish' ? (
                    <span className="px-2 py-1 bg-emerald-950/50 text-emerald-300 border border-emerald-800 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider block text-center w-full">
                      🟢 BULLISH MARUBOZU
                    </span>
                  ) : activeHoverCandleData.pattern.type === 'bearish' ? (
                    <span className="px-2 py-1 bg-rose-950/50 text-rose-300 border border-rose-800 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider block text-center w-full">
                      🔴 BEARISH MARUBOZU
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-slate-900 border border-slate-800/80 text-slate-500 rounded-lg text-[10px] uppercase font-mono block text-center w-full">
                      Neutral Candle
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="col-span-5 text-slate-400 text-xs flex items-center justify-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Hover over the candlestick canvas to retrieve OHLC coordinates &amp; pattern diagnostics.</span>
              </div>
            )}
          </div>

          {/* SVG Chart Canvas */}
          <div
            ref={containerRef}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl relative select-none overflow-hidden"
            style={{ height: `${SVG_HEIGHT}px` }}
          >
            <svg
              id="chart-svg"
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="absolute inset-0 w-full h-full cursor-crosshair"
            >
              <defs>
                <linearGradient id="grid-fade" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#1e293b" stopOpacity="0"   />
                  <stop offset="8%"   stopColor="#1e293b" stopOpacity="0.5" />
                  <stop offset="92%"  stopColor="#1e293b" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0"   />
                </linearGradient>
              </defs>

              {/* Horizontal price grid */}
              {Array.from({ length: 6 }).map((_, i) => {
                const yVal  = padding.top + (i / 5) * chartHeight;
                const price = priceEnvelope.max - (i / 5) * (priceEnvelope.max - priceEnvelope.min);
                return (
                  <g key={`grid-y-${i}`}>
                    <line x1={padding.left} y1={yVal} x2={SVG_WIDTH - padding.right} y2={yVal}
                      stroke="url(#grid-fade)" strokeWidth={1} strokeDasharray="4 4" />
                    <text x={SVG_WIDTH - padding.right + 6} y={yVal + 3}
                      fill="#64748b" fontSize={9} fontFamily="monospace" textAnchor="start">
                      ${fmt(price)}
                    </text>
                  </g>
                );
              })}

              {/* Vertical time labels */}
              {visibleCandles.map(([time], idx) => {
                if (idx % 8 !== 0 && idx !== visibleCandles.length - 1) return null;
                const xc = getX(idx);
                return (
                  <g key={`time-${idx}`}>
                    <line x1={xc} y1={padding.top} x2={xc} y2={padding.top + chartHeight}
                      stroke="#1e293b" strokeWidth={0.5} />
                    <text x={xc} y={padding.top + chartHeight + 16}
                      fill="#64748b" fontSize={8} fontFamily="monospace" textAnchor="middle">
                      {formatTimeLabel(time, daysParam)}
                    </text>
                  </g>
                );
              })}

              {/* Candlesticks */}
              {visibleCandles.map((candle, idx) => {
                const [, open, high, low, close] = candle;
                const xc        = getX(idx);
                const yo        = getY(open);
                const yc        = getY(close);
                const yh        = getY(high);
                const yl        = getY(low);
                const isBullish = close >= open;
                const top       = Math.min(yo, yc);
                const bodyH     = Math.max(Math.abs(yc - yo), 1.5);
                const scanType  = candlePatterns[idx].type;
                const isMarubozu = scanType !== 'none';
                const isHovered  = hoverIndex === idx;
                const barWidth   = Math.max((chartWidth / visibleCandles.length) * 0.7, 2);

                const wickColor  = isMarubozu
                  ? (scanType === 'bullish' ? '#059669'              : '#dc2626')
                  : (isBullish              ? '#34d399'              : '#f87171');
                const bodyFill   = isMarubozu
                  ? (scanType === 'bullish' ? 'rgba(16,185,129,0.95)': 'rgba(239,68,68,0.95)')
                  : (isBullish              ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)');
                const bodyStroke = isMarubozu
                  ? (scanType === 'bullish' ? '#10b981'              : '#ef4444')
                  : (isBullish              ? '#34d399'              : '#f87171');

                return (
                  <g key={`c-${idx}`}>
                    <line x1={xc} y1={yh} x2={xc} y2={yl}
                      stroke={wickColor} strokeWidth={isMarubozu ? 2 : 1.2} />
                    <rect x={xc - barWidth / 2} y={top} width={barWidth} height={bodyH}
                      fill={bodyFill} stroke={bodyStroke}
                      strokeWidth={isHovered ? 2 : isMarubozu ? 1.5 : 1} rx={1} />
                    {isMarubozu && (
                      <rect x={xc - barWidth} y={yh - 3} width={barWidth * 2} height={(yl - yh) + 6}
                        fill="none"
                        stroke={scanType === 'bullish' ? '#059669' : '#dc2626'}
                        strokeWidth={1} strokeDasharray="2 2" opacity={0.6} rx={2} />
                    )}
                    {isMarubozu && bodyH > 12 && (
                      <text x={xc} y={top - 5}
                        fill={scanType === 'bullish' ? '#34d399' : '#f87171'}
                        fontSize={7} fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                        {scanType === 'bullish' ? 'B-MZ' : 'S-MZ'}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Crosshair */}
              {hoverIndex !== null && hoverIndex < visibleCandles.length && (
                <g>
                  <line x1={getX(hoverIndex)} y1={padding.top} x2={getX(hoverIndex)} y2={padding.top + chartHeight}
                    stroke="#475569" strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={padding.left} y1={mouseSvgY} x2={SVG_WIDTH - padding.right} y2={mouseSvgY}
                    stroke="#475569" strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={getX(hoverIndex)} cy={getY(visibleCandles[hoverIndex][4])}
                    r={4} fill="#3b82f6" stroke="#ffffff" strokeWidth={1.5} />
                </g>
              )}
            </svg>
          </div>

        </div>
      )}
    </div>
  );
}
