/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, AlertTriangle, ShieldCheck, HelpCircle, ArrowRightLeft } from 'lucide-react';
import { ScannerSettings } from '../types';
import { trackSettingsChanged } from '../utils/analytics';

interface EducationPanelProps {
  settings: ScannerSettings;
  setSettings: React.Dispatch<React.SetStateAction<ScannerSettings>>;
}

export default function EducationPanel({ settings, setSettings }: EducationPanelProps) {
  const handleWickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSettings(prev => ({ ...prev, wickTolerance: val }));
    trackSettingsChanged('wickTolerance', val);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSettings(prev => ({ ...prev, minBodyPercent: val }));
    trackSettingsChanged('minBodyPercent', val);
  };

  return (
    <div id="education-panel-section" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-6">
      
      {/* Settings / Configuration Title */}
      <div>
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-blue-500 w-5 h-5" />
          <h3 className="text-lg font-bold text-white tracking-tight">Pattern Parameters</h3>
        </div>
        <p className="text-slate-400 text-xs mt-1">
          Fine-tune the mathematical criteria defining a Marubozu candle. Updates the core scan board instantly.
        </p>

        {/* Dynamic Sliders */}
        <div className="mt-5 space-y-4 bg-slate-950 p-4 border border-slate-800 rounded-2xl">
          {/* Wick Tolerance */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                Wick Ratio Tolerance
                <span className="text-slate-500 cursor-help" title="Maximum combined wick size divided by total candle range (Low-High). Lower is more strict (typical Marubozu is 0%).">ℹ️</span>
              </span>
              <span className="font-mono text-blue-400 font-bold bg-blue-950/40 px-2 py-0.5 border border-blue-900 rounded">
                {(settings.wickTolerance * 100).toFixed(0)}%
              </span>
            </div>
            <input
              id="wickToleranceSlider"
              type="range"
              min="0.00"
              max="0.15"
              step="0.01"
              value={settings.wickTolerance}
              onChange={handleWickChange}
              className="w-full accent-blue-500 h-1.5 cursor-pointer rounded-lg bg-slate-800"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0% (Perfect)</span>
              <span>15% (Permissive)</span>
            </div>
          </div>

          {/* Min Candle Body Size */}
          <div className="space-y-1.5 pt-2 border-t border-slate-900/60">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                Min Body Height
                <span className="text-slate-500 cursor-help" title="Minimum percentage price difference between Open and Close. Eliminates flat sideways noise.">ℹ️</span>
              </span>
              <span className="font-mono text-purple-400 font-bold bg-purple-950/40 px-2 py-0.5 border border-purple-900 rounded">
                {settings.minBodyPercent}%
              </span>
            </div>
            <input
              id="minBodyPercentSlider"
              type="range"
              min="0.05"
              max="1.20"
              step="0.05"
              value={settings.minBodyPercent}
              onChange={handleBodyChange}
              className="w-full accent-purple-500 h-1.5 cursor-pointer rounded-lg bg-slate-800"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>0.05% (Liquidity)</span>
              <span>1.20% (Volatility)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-5 space-y-4">
        {/* Education Title */}
        <div className="flex items-center gap-2">
          <BookOpen className="text-emerald-400 w-5 h-5" />
          <h3 className="text-md font-bold text-slate-100">Decoding the Marubozu</h3>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Originating as Japanese word meaning <em className="text-emerald-300 font-medium not-italic">"baldhead"</em> or <em className="text-emerald-300 font-medium not-italic">"shaved head"</em>, a Marubozu candlestick is a rare, high-momentum pattern characterized by a long, full solid body with almost zero upper or lower shadow.
        </p>

        {/* Visual Diagram SVGs */}
        <div className="grid grid-cols-2 gap-4 my-2">
          {/* Bullish SVG */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] font-bold text-emerald-400 mb-2">BULLISH MARUBOZU</span>
            <svg width="45" height="90" className="opacity-90">
              {/* Very tiny upper/lower wicks representing our soft tolerance */}
              <line x1="22.5" y1="5" x2="22.5" y2="85" stroke="#10b981" strokeWidth="1.2" strokeDasharray="1 1" />
              <rect x="12" y="10" width="21" height="70" fill="rgba(16, 185, 129, 0.9)" stroke="#10b981" strokeWidth="1.5" rx="1" />
              <text x="22.5" y="47" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">CLOSE</text>
              <text x="22.5" y="20" fill="#a7f3d0" fontSize="7" textAnchor="middle" fontFamily="sans-serif">High</text>
              <text x="22.5" y="77" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">OPEN</text>
              <text x="22.5" y="87" fill="#a7f3d0" fontSize="7" textAnchor="middle" fontFamily="sans-serif">Low</text>
            </svg>
            <p className="text-[10px] text-slate-500 text-center mt-2 font-mono">Buyers dominate from first trade to last.</p>
          </div>

          {/* Bearish SVG */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] font-bold text-rose-400 mb-2">BEARISH MARUBOZU</span>
            <svg width="45" height="90" className="opacity-90">
              <line x1="22.5" y1="5" x2="22.5" y2="85" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="1 1" />
              <rect x="12" y="10" width="21" height="70" fill="rgba(239, 68, 68, 0.9)" stroke="#ef4444" strokeWidth="1.5" rx="1" />
              <text x="22.5" y="20" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">OPEN</text>
              <text x="22.5" y="47" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">CLOSE</text>
              <text x="22.5" y="12" fill="#fca5a5" fontSize="7" textAnchor="middle" fontFamily="sans-serif">High</text>
              <text x="22.5" y="87" fill="#fca5a5" fontSize="7" textAnchor="middle" fontFamily="sans-serif">Low</text>
            </svg>
            <p className="text-[10px] text-slate-500 text-center mt-2 font-mono">Sellers stampede, crashing prices uninhibited.</p>
          </div>
        </div>

        {/* Practical Trading Strategies */}
        <div className="space-y-3 pt-2">
          <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-2xl flex gap-3">
            <ShieldCheck className="text-blue-400/80 w-5 h-5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Strategy A: Breakout Confirmation</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                When a Marubozu body breaches key support or resistance lines, it confirms a valid breakout. Open a long position (if bullish) or short (if bearish) immediately on the subsequent candle opening.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-2xl flex gap-3">
            <AlertTriangle className="text-amber-500/80 w-5 h-5 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Risk Management / Stops</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Stop-losses are structurally straightforward. Place stop protective triggers right at the midpoint of the Marubozu body, or just below the low of the candle for maximal defense.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
