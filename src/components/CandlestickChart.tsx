/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Candle, ScannerSettings, CoinData } from '../types';
import { detectMarubozu, formatTimeLabel } from '../utils/scanner';
import { Calendar, TrendingUp, Cpu, Info, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';

interface CandlestickChartProps {
  coin: CoinData | null;
  candles: Candle[];
  settings: ScannerSettings;
  daysParam: string;
}

export default function CandlestickChart({
  coin,
  candles,
  settings,
  daysParam
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 420 });
  const [zoomRange, setZoomRange] = useState<number>(40); // Number of candles visible from the end
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Monitor resize safely using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width: Math.max(width, 300),
        height: Math.max(height, 350)
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter candles based on visible zoom range from the end
  const visibleCandles = useMemo(() => {
    if (candles.length === 0) return [];
    // Ensure we don't request more candles than available
    const count = Math.min(zoomRange, candles.length);
    return candles.slice(candles.length - count);
  }, [candles, zoomRange]);

  // Map each visible candle to its index in the original candles array
  const originalIndices = useMemo(() => {
    if (candles.length === 0) return [];
    const count = Math.min(zoomRange, candles.length);
    const result: number[] = [];
    for (let i = candles.length - count; i < candles.length; i++) {
      result.push(i);
    }
    return result;
  }, [candles, zoomRange]);

  // Compute price envelope for the Y axis
  const priceEnvelope = useMemo(() => {
    if (visibleCandles.length === 0) return { min: 0, max: 100 };
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    visibleCandles.forEach(([_, open, high, low, close]) => {
      if (low < minPrice) minPrice = low;
      if (high > maxPrice) maxPrice = high;
    });

    const pad = (maxPrice - minPrice) * 0.08 || 5; // padding factor
    return {
      min: minPrice - pad,
      max: maxPrice + pad
    };
  }, [visibleCandles]);

  // SVG Coordinates transformations
  const padding = { top: 30, right: 70, bottom: 40, left: 20 };
  const chartWidth = dimensions.width - padding.left - padding.right;
  const chartHeight = dimensions.height - padding.top - padding.bottom;

  const getX = (index: number) => {
    if (visibleCandles.length <= 1) return padding.left;
    return padding.left + (index / (visibleCandles.length - 1)) * chartWidth;
  };

  const getY = (price: number) => {
    const range = priceEnvelope.max - priceEnvelope.min;
    if (range === 0) return padding.top + chartHeight / 2;
    // Lower price = higher pixel coordinates (SVG Y increases downwards)
    const factor = (price - priceEnvelope.min) / range;
    return padding.top + chartHeight - factor * chartHeight;
  };

  // Convert client cursor coords back to nearest candle index
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || visibleCandles.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - padding.left;
    const y = e.clientY - rect.top;

    setMousePos({ x: e.clientX - rect.left, y });

    if (x < 0 || x > chartWidth) {
      setHoverIndex(null);
      return;
    }

    const ratio = x / chartWidth;
    const index = Math.round(ratio * (visibleCandles.length - 1));
    if (index >= 0 && index < visibleCandles.length) {
      setHoverIndex(index);
    } else {
      setHoverIndex(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  // Identify whether a visible candle represents a Marubozu
  const candlePatterns = useMemo(() => {
    return visibleCandles.map(([time, open, high, low, close], idx) => {
      // Create isolated historical segment up to this index to feed into scanner
      const historicalSubArray = candles.slice(0, originalIndices[idx] + 1);
      // We pass checkCompleted=false here, because we want status of THIS specific historical candle
      return detectMarubozu(historicalSubArray, settings, false);
    });
  }, [visibleCandles, candles, originalIndices, settings]);

  const activeHoverCandleData = useMemo(() => {
    if (hoverIndex === null || hoverIndex >= visibleCandles.length) return null;
    const originalIdx = originalIndices[hoverIndex];
    if (originalIdx === undefined) return null;

    const candle = visibleCandles[hoverIndex];
    const pattern = candlePatterns[hoverIndex];
    const [time, open, high, low, close] = candle;

    const bodyHeight = Math.abs(close - open);
    const range = high - low;
    const bodyPct = (bodyHeight / open) * 100;
    const wickPct = ((range - bodyHeight) / range) * 100;

    return {
      price: candle,
      pattern,
      bodyPct,
      wickPct,
      time,
      open,
      high,
      low,
      close,
      range
    };
  }, [hoverIndex, visibleCandles, originalIndices, candlePatterns]);

  return (
    <div id="interactive-chart-section" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-full">
      {/* Header Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 mb-4">
        <div>
          <div className="flex items-center gap-2">
            {coin ? (
              <img
                src={coin.image}
                alt={coin.name}
                className="w-5 h-5 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <h3 className="text-md font-bold text-slate-100 uppercase tracking-tight">
              {coin ? `${coin.name} (${coin.symbol.toUpperCase()})` : 'Candlestick Blueprint'}
            </h3>
            <span className="text-slate-500 font-mono text-xs">
              {daysParam === '1' ? '30M intervals' : daysParam === '7' ? '4H intervals' : '1D intervals'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1"><Cpu className="w-3 h-3 text-blue-400" /> Client-side scanned w/ tolerance</span>
            <span className="inline-flex items-center px-1.5 py-0.2 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-yellow-400">
              Wick Max: {(settings.wickTolerance * 100).toFixed(0)}%
            </span>
            <span className="inline-flex items-center px-1.5 py-0.2 bg-slate-950 border border-slate-800 rounded font-mono text-[10px] text-indigo-400">
              Body Min: {settings.minBodyPercent}%
            </span>
          </div>
        </div>

        {/* Zoom range buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 border border-slate-800 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setZoomRange(prev => Math.min(prev + 10, candles.length || 100))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition"
            title="Zoom Out (Show More Candles)"
            id="chart-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-slate-400 text-xs font-mono px-2 font-bold select-none">{zoomRange} candles</span>
          <button
            onClick={() => setZoomRange(prev => Math.max(prev - 10, 10))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition"
            title="Zoom In (Show Fewer Candles)"
            id="chart-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {candles.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-300 text-sm font-semibold">Resolving CoinGecko Candle Streams...</p>
          <p className="text-slate-500 text-xs mt-1 max-w-xs leading-relaxed">
            Please wait up to 10 seconds. The background worker cycles requests sequentially to protect API limits.
          </p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col gap-4">
          
          {/* Active / Hover OHLC Info Strip */}
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
                    <span className="text-slate-300">${activeHoverCandleData.open < 1 ? activeHoverCandleData.open.toFixed(4) : activeHoverCandleData.open.toFixed(2)}</span>
                    <span className="text-slate-500">→</span>
                    <span className={activeHoverCandleData.close >= activeHoverCandleData.open ? 'text-emerald-400' : 'text-rose-400'}>
                      ${activeHoverCandleData.close < 1 ? activeHoverCandleData.close.toFixed(3) : activeHoverCandleData.close.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">RANGE (H - L)</div>
                  <div className="text-xs text-slate-300 mt-0.5 font-bold font-mono">
                    ${activeHoverCandleData.high < 1 ? activeHoverCandleData.high.toFixed(4) : activeHoverCandleData.high.toFixed(2)} - ${activeHoverCandleData.low < 1 ? activeHoverCandleData.low.toFixed(4) : activeHoverCandleData.low.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-mono">BODY / WICK RATIO</div>
                  <div className="text-xs mt-0.5 font-bold font-mono flex gap-1.5">
                    <span className="text-slate-200">{activeHoverCandleData.bodyPct.toFixed(2)}%</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">{activeHoverCandleData.wickPct.toFixed(0)}% wicks</span>
                  </div>
                </div>
                <div className="col-span-2 lg:col-span-1 flex items-center">
                  {activeHoverCandleData.pattern.type === 'bullish' ? (
                    <span className="px-2 py-1 bg-emerald-950/50 text-emerald-300 border border-emerald-800 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider block text-center w-full animate-bounce">
                      🟢 BULLISH MARUBOZU
                    </span>
                  ) : activeHoverCandleData.pattern.type === 'bearish' ? (
                    <span className="px-2 py-1 bg-rose-950/50 text-rose-300 border border-rose-800 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider block text-center w-full animate-bounce">
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
                <Info id="chart-info-hover" className="w-4 h-4 text-blue-400" />
                <span>Hover over the candlestick canvas below to retrieve precise OHLC coordinates &amp; pattern diagnostics.</span>
              </div>
            )}
          </div>

          {/* SVG Canvas Area */}
          <div ref={containerRef} className="flex-grow w-full h-[320px] bg-slate-950 border border-slate-800 rounded-2xl relative select-none">
            <svg
              id="chart-svg"
              width={dimensions.width}
              height={dimensions.height}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="absolute inset-0 w-full h-full cursor-crosshair overflow-hidden"
            >
              <defs>
                <linearGradient id="gradient-grid-horizontal" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0" />
                  <stop offset="10%" stopColor="#1e293b" stopOpacity="0.4" />
                  <stop offset="90%" stopColor="#1e293b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {Array.from({ length: 6 }).map((_, i) => {
                const yVal = padding.top + (i / 5) * chartHeight;
                const price = priceEnvelope.max - (i / 5) * (priceEnvelope.max - priceEnvelope.min);
                return (
                  <g key={`grid-y-${i}`}>
                    <line
                      x1={padding.left}
                      y1={yVal}
                      x2={dimensions.width - padding.right}
                      y2={yVal}
                      stroke="url(#gradient-grid-horizontal)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={dimensions.width - padding.right + 8}
                      y={yVal + 3}
                      fill="#64748b"
                      fontSize={9}
                      fontFamily="monospace"
                      textAnchor="start"
                    >
                      ${price >= 1 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(4)}
                    </text>
                  </g>
                );
              })}

              {/* Horizontal Timeline Labels */}
              {visibleCandles.map(([time], idx) => {
                // Show label for every 8th candle, or the first/last
                if (idx % 8 !== 0 && idx !== visibleCandles.length - 1) return null;
                const xc = getX(idx);
                return (
                  <g key={`timeline-${idx}`}>
                    <line
                      x1={xc}
                      y1={padding.top}
                      x2={xc}
                      y2={padding.top + chartHeight}
                      stroke="#1e293b"
                      strokeWidth={0.5}
                    />
                    <text
                      x={xc}
                      y={padding.top + chartHeight + 18}
                      fill="#64748b"
                      fontSize={8}
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {formatTimeLabel(time, daysParam)}
                    </text>
                  </g>
                );
              })}

              {/* Candlesticks & Marubozu Highlights */}
              {visibleCandles.map((candle, idx) => {
                const [time, open, high, low, close] = candle;
                const xc = getX(idx);
                const yo = getY(open);
                const yc = getY(close);
                const yh = getY(high);
                const yl = getY(low);

                const isBullish = close >= open;
                const top = Math.min(yo, yc);
                const bottom = Math.max(yo, yc);
                const bodyHeight = Math.max(bottom - top, 1.5);
                
                // Determine candle coloring
                const scanType = candlePatterns[idx].type;
                const isHoveredSlot = hoverIndex === idx;

                let wickColor = isBullish ? '#34d399' : '#f87171';
                let bodyFill = isBullish ? 'rgba(52, 211, 153, 0.4)' : 'rgba(248, 113, 113, 0.4)';
                let bodyStroke = isBullish ? '#34d399' : '#f87171';

                // Golden glow highlighting for identified Marubozu candles
                const isMarubozu = scanType !== 'none';

                if (isMarubozu) {
                  wickColor = scanType === 'bullish' ? '#059669' : '#dc2626';
                  bodyFill = scanType === 'bullish' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
                  bodyStroke = scanType === 'bullish' ? '#10b981' : '#ef4444';
                }

                const barWidth = Math.max((chartWidth / visibleCandles.length) * 0.72, 3);

                return (
                  <g key={`candle-${idx}`} id={`candle-group-${idx}`}>
                    {/* Shadow / Wick */}
                    <line
                      x1={xc}
                      y1={yh}
                      x2={xc}
                      y2={yl}
                      stroke={wickColor}
                      strokeWidth={isMarubozu ? 2 : 1.2}
                    />

                    {/* Candlestick Body */}
                    <rect
                      x={xc - barWidth / 2}
                      y={top}
                      width={barWidth}
                      height={bodyHeight}
                      fill={bodyFill}
                      stroke={bodyStroke}
                      strokeWidth={isHoveredSlot ? 2 : isMarubozu ? 1.5 : 1}
                      rx={1}
                      style={{ transition: 'all 0.15s ease' }}
                    />

                    {/* Highlight Marubozu Rings around the entire candle range */}
                    {isMarubozu && (
                      <rect
                        x={xc - barWidth * 0.9}
                        y={yh - 4}
                        width={barWidth * 1.8}
                        height={(yl - yh) + 8}
                        fill="none"
                        stroke={scanType === 'bullish' ? '#059669' : '#dc2626'}
                        strokeWidth={1}
                        strokeDasharray="2 2"
                        opacity={0.7}
                        rx={3}
                      />
                    )}

                    {/* Subtle text notation overlay */}
                    {isMarubozu && bodyHeight > 15 && (
                      <text
                        x={xc}
                        y={top - 6}
                        fill={scanType === 'bullish' ? '#34d399' : '#f87171'}
                        fontSize={7}
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {scanType === 'bullish' ? 'B-MZ' : 'S-MZ'}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Cursor Crosshair Line (Hover Mode) */}
              {hoverIndex !== null && hoverIndex < visibleCandles.length && (
                <g id="chart-crosshair">
                  {/* Vertical Crosshair Line */}
                  <line
                    x1={getX(hoverIndex)}
                    y1={padding.top}
                    x2={getX(hoverIndex)}
                    y2={padding.top + chartHeight}
                    stroke="#475569"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  {/* Horizontal Crosshair Line */}
                  <line
                    x1={padding.left}
                    y1={mousePos.y}
                    x2={dimensions.width - padding.right}
                    y2={mousePos.y}
                    stroke="#475569"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  
                  {/* Floating index pointer */}
                  <circle
                    cx={getX(hoverIndex)}
                    cy={getY(visibleCandles[hoverIndex][4])} // snap to Close value
                    r={4}
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </g>
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
