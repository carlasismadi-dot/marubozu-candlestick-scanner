/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX, ListCollapse, AlertCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { CoinData, Candle, ScannerSettings } from '../types';
import { detectMarubozu } from '../utils/scanner';

interface AlertItem {
  id: string;
  coinId: string;
  symbol: string;
  timeframe: string;
  type: 'bullish' | 'bearish';
  timestamp: number;
}

interface NotificationCenterProps {
  coins: CoinData[];
  ohlcRecords: Record<string, Candle[]>;
  settings: ScannerSettings;
  onSelectCoin: (id: string, timeframe: '30m' | '4h' | '1d') => void;
}

export default function NotificationCenter({
  coins,
  ohlcRecords,
  settings,
  onSelectCoin
}: NotificationCenterProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());

  // Synth play function using standard browser Web Audio API
  const playChime = (type: 'bullish' | 'bearish') => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Play synthesized chords
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gainNode.gain.setValueAtTime(0.08, start);
        // Exponential decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      if (type === 'bullish') {
        // Ascending major chord (C4, E4, G4, C5)
        playTone(261.63, now, 0.4);       // C4
        playTone(329.63, now + 0.1, 0.4); // E4
        playTone(392.00, now + 0.2, 0.4); // G4
        playTone(523.25, now + 0.3, 0.6); // C5
      } else {
        // Descending/Warning minor chord (G4, Eb4, C4)
        playTone(392.00, now, 0.4);       // G4
        playTone(311.13, now + 0.1, 0.4); // Eb4
        playTone(261.63, now + 0.2, 0.6); // C4
      }
    } catch (e) {
      // Slurk standard browser context locking error
    }
  };

  // Scan across all data to compile current signals and alert
  useEffect(() => {
    const newAlerts: AlertItem[] = [];
    const currentSeen = new Set(seenKeys);
    let triggeredSound = false;
    let lastTriggerType: 'bullish' | 'bearish' = 'bullish';

    coins.forEach(coin => {
      (['30m', '4h', '1d'] as const).forEach(tf => {
        const daysCode = tf === '30m' ? '1' : tf === '4h' ? '7' : '30';
        const candles = ohlcRecords[`${coin.id}_${daysCode}`] || [];

        if (candles.length > 0) {
          const status = detectMarubozu(candles, settings, true);
          if (status.type !== 'none' && status.candle) {
            const candleTime = status.candle[0];
            const uniqueKey = `${coin.id}_${tf}_${candleTime}`;

            // If we haven't seen this specific candle pattern trigger yet
            if (!seenKeys.has(uniqueKey)) {
              currentSeen.add(uniqueKey);
              
              newAlerts.push({
                id: uniqueKey,
                coinId: coin.id,
                symbol: coin.symbol.toUpperCase(),
                timeframe: tf,
                type: status.type,
                timestamp: Date.now()
              });

              if (!triggeredSound) {
                triggeredSound = true;
                lastTriggerType = status.type;
              }
            }
          }
        }
      });
    });

    if (newAlerts.length > 0) {
      setSeenKeys(currentSeen);
      setAlerts(prev => {
        // Combine, sorted of most recent alerts first, capping at 30 entries
        const combined = [...newAlerts, ...prev];
        combined.sort((a, b) => b.timestamp - a.timestamp);
        return combined.slice(0, 30);
      });

      // Play alert chime
      if (triggeredSound) {
        playChime(lastTriggerType);
      }
    }
  }, [coins, ohlcRecords, settings]);

  const handleClearAlerts = () => {
    setAlerts([]);
  };

  return (
    <div id="notification-center-section" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-full justify-between">
      
      <div>
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="text-yellow-500 w-5 h-5" />
            <h3 className="text-md font-bold text-slate-100">Live Trade Alerts</h3>
          </div>
          
          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
            <button
              id="btn-toggle-sound"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:text-white rounded-lg text-slate-400 transition"
              title={soundEnabled ? 'Disable alert audio cues' : 'Enable alert audio cues'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
            </button>
            
            {alerts.length > 0 ? (
              <button
                id="btn-clear-alerts"
                onClick={handleClearAlerts}
                className="text-[10px] bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 px-2 py-1.5 rounded-lg font-mono transition"
              >
                Clear Log
              </button>
            ) : null}
          </div>
        </div>

        {/* Live Alerts Stream */}
        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs">
              <AlertCircle className="w-5 h-5 mx-auto text-slate-700 mb-2" />
              <span>No trade triggers logged yet in this session.</span>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                id={`alert-row-${alert.id}`}
                key={alert.id}
                onClick={() => onSelectCoin(alert.coinId, alert.timeframe as any)}
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-300 flex items-center justify-between hover:bg-slate-950/80 group ${
                  alert.type === 'bullish'
                    ? 'bg-emerald-950/10 border-emerald-950 text-emerald-400'
                    : 'bg-rose-950/10 border-rose-950 text-rose-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {alert.type === 'bullish' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  )}
                  <div>
                    <span className="font-extrabold text-sm text-slate-100 group-hover:text-white block font-mono">
                      {alert.symbol}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Marubozu detected on {alert.timeframe.toUpperCase()} charts
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    alert.type === 'bullish' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                  }`}>
                    {alert.type.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-slate-500 block mt-1 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-500" /> Current Block Cycle:
        </span>
        <span className="text-slate-400 font-bold">5s sequential refresh</span>
      </div>

    </div>
  );
}
