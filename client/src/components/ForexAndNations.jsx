import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Globe2, ArrowRightLeft, Trophy, Sparkles
} from 'lucide-react';

export default React.memo(function ForexAndNations() {
  const { nation, formatMoney, formatRawUSD } = useAuth();
  const [nationsList, setNationsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Currency Converter State
  const [sourceNationId, setSourceNationId] = useState('');
  const [targetNationId, setTargetNationId] = useState('usd_benchmark');
  const [inputAmount, setInputAmount] = useState('1000');

  useEffect(() => {
    async function fetchNations() {
      try {
        const res = await fetch('/api/auth/nations');
        if (res.ok) {
          const data = await res.json();
          setNationsList(data.nations || []);
          if (data.nations && data.nations.length > 0 && !sourceNationId) {
            setSourceNationId(nation ? nation.id : data.nations[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching nations:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchNations();
  }, [nation]);

  const sourceNation = nationsList.find(n => n.id === sourceNationId) || (nation?.id === sourceNationId ? nation : nationsList[0]);
  const targetNation = targetNationId === 'usd_benchmark' ? null : nationsList.find(n => n.id === targetNationId);

  // Compute Cross-Currency Conversion
  const sourceAmount = Math.max(0, Number(inputAmount) || 0);
  const sourceRate = sourceNation ? Number(sourceNation.usd_exchange_rate) || 1.0 : 1.0;
  const amountInUSD = sourceAmount / sourceRate;

  let targetAmount = 0;
  let targetCurrencyLabel = '$ USD';
  let targetSymbol = '$';

  if (targetNationId === 'usd_benchmark' || !targetNation) {
    targetAmount = amountInUSD;
    targetCurrencyLabel = 'USD ($)';
    targetSymbol = '$';
  } else {
    const targetRate = Number(targetNation.usd_exchange_rate) || 1.0;
    targetAmount = amountInUSD * targetRate;
    targetCurrencyLabel = `${targetNation.currency_name} (${targetNation.currency_symbol})`;
    targetSymbol = targetNation.currency_symbol;
  }

  const crossRate = targetNation ? (Number(targetNation.usd_exchange_rate) / sourceRate).toFixed(4) : (1 / sourceRate).toFixed(4);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan flex items-center justify-center shadow-lg shadow-brand-cyan/10">
            <Globe2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Currency Converter & Nations Leaderboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Convert money between any nation's currency and see who tops the global wealth leaderboard.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Cross-Currency Converter */}
      <div className="p-6 rounded-2xl bg-dark-900 border border-brand-cyan/30 shadow-2xl space-y-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-3">
          <ArrowRightLeft className="w-5 h-5 text-brand-cyan" />
          Live Currency Converter
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          
          {/* Source Currency */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-dark-850 border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">Starting Currency:</label>
            <select
              value={sourceNationId}
              onChange={(e) => setSourceNationId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-cyan"
            >
              {nationsList.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.currency_symbol} {n.currency_name} (1 USD = {n.usd_exchange_rate})
                </option>
              ))}
            </select>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Amount to Convert:</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-brand-cyan"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-brand-cyan font-mono font-bold">
                  {sourceNation?.currency_symbol || '¤'}
                </span>
              </div>
            </div>
          </div>

          {/* Swap Indicator (2 cols) */}
          <div className="lg:col-span-2 text-center py-2">
            <div className="w-10 h-10 rounded-full bg-dark-800 border border-white/10 text-brand-cyan flex items-center justify-center mx-auto shadow-md">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              1 {sourceNation?.currency_symbol || '¤'} = {crossRate} {targetSymbol}
            </span>
          </div>

          {/* Target Currency (5 cols) */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-dark-850 border border-white/10 space-y-3">
            <label className="block text-xs font-semibold text-slate-300">Convert Into:</label>
            <select
              value={targetNationId}
              onChange={(e) => setTargetNationId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-cyan"
            >
              <option value="usd_benchmark">US Dollars ($ USD)</option>
              {nationsList.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.currency_symbol} {n.currency_name} (1 USD = {n.usd_exchange_rate})
                </option>
              ))}
            </select>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Converted Total:</label>
              <div className="p-2.5 rounded-xl bg-dark-950 border border-white/5 font-mono text-sm font-bold text-brand-green flex items-center justify-between">
                <span>{targetSymbol}{targetAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-slate-400 font-normal">{targetCurrencyLabel}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sovereign Nations Directory & Wealth Leaderboard */}
      <div className="p-6 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Trophy className="w-5 h-5 text-brand-gold" />
            Global Nation Wealth Leaderboard
          </div>
          <span className="text-xs font-mono text-slate-400">{nationsList.length} Nations Competing</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-dark-950/60 text-slate-400 text-[11px]">
                <th className="p-3.5">Rank</th>
                <th className="p-3.5">Nation Name</th>
                <th className="p-3.5">National Currency</th>
                <th className="p-3.5">USD Exchange Rate</th>
                <th className="p-3.5">Available Cash</th>
                <th className="p-3.5 text-right">Total Net Worth (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {nationsList.map((n, idx) => {
                const isCurrent = nation && nation.id === n.id;
                return (
                  <tr key={n.id} className={`hover:bg-dark-850/50 transition ${isCurrent ? 'bg-brand-cyan/10' : ''}`}>
                    <td className="p-3.5 font-bold text-slate-400">
                      {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                    </td>
                    <td className="p-3.5 font-bold text-white flex items-center gap-2">
                      <span>{n.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan uppercase">You</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      <span className="text-brand-cyan font-bold mr-1">{n.currency_symbol}</span>
                      {n.currency_name}
                    </td>
                    <td className="p-3.5 text-slate-300">
                      1 USD = {n.usd_exchange_rate} {n.currency_symbol}
                    </td>
                    <td className="p-3.5 text-brand-green font-semibold">
                      ${Number(n.cash_balance_usd).toLocaleString()} USD
                    </td>
                    <td className="p-3.5 text-right font-black text-white text-sm">
                      ${Number(n.net_worth_usd).toLocaleString()} USD
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
});
