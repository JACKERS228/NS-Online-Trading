import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Coins, X, Check, RefreshCw } from 'lucide-react';

export default React.memo(function CurrencySettingsModal({ isOpen, onClose }) {
  const { nation, updateCurrencySettings } = useAuth();
  const [currencyName, setCurrencyName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [usdExchangeRate, setUsdExchangeRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (nation) {
      setCurrencyName(nation.currency_name || 'Credits');
      setCurrencySymbol(nation.currency_symbol || '¤');
      setUsdExchangeRate(nation.usd_exchange_rate ? Number(nation.usd_exchange_rate).toFixed(2) : '1.00');
    }
  }, [nation]);

  const handleRateChange = useCallback((e) => {
    const val = e.target.value;
    if (val.includes('.')) {
      const parts = val.split('.');
      if (parts[1] && parts[1].length > 2) {
        setUsdExchangeRate(`${parts[0]}.${parts[1].slice(0, 2)}`);
        return;
      }
    }
    setUsdExchangeRate(val);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const parsedRate = Math.max(0.01, +(Number(usdExchangeRate) || 1.0).toFixed(2));

    try {
      await updateCurrencySettings({
        currencyName: currencyName.trim(),
        currencySymbol: currencySymbol.trim(),
        usdExchangeRate: parsedRate
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      setError(err.message || 'Failed to update currency settings');
    } finally {
      setLoading(false);
    }
  }, [currencyName, currencySymbol, usdExchangeRate, updateCurrencySettings, onClose]);

  const convertedSample = useMemo(() => {
    const rate = Number(usdExchangeRate) || 1;
    return (1000 * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [usdExchangeRate]);

  if (!isOpen || !nation) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 transform-gpu animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-dark-900 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Currency Settings</h3>
                <p className="text-xs text-slate-400">Configure currency name and USD exchange rate</p>
              </div>
            </div>
            <button onClick={onClose} type="button" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-brand-red/40 bg-brand-red/10 text-brand-red text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Currency Name</label>
              <input
                type="text"
                required
                value={currencyName}
                onChange={(e) => setCurrencyName(e.target.value)}
                placeholder="e.g. Dinar, Credits, Franc"
                className="w-full px-3.5 py-2 rounded-xl bg-dark-850 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Currency Symbol</label>
              <input
                type="text"
                required
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                placeholder="e.g. ₪, ₢, £, $"
                className="w-full px-3.5 py-2 rounded-xl bg-dark-850 border border-white/10 text-sm text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                USD Exchange Rate (1 USD = X {currencyName}) — <span className="text-slate-500">Max 2 Decimals</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={usdExchangeRate}
                onChange={handleRateChange}
                placeholder="e.g. 1.02"
                className="w-full px-3.5 py-2 rounded-xl bg-dark-850 border border-white/10 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-dark-800/80 border border-white/5 space-y-1 text-xs">
              <div className="text-slate-400 font-medium text-[11px]">Preview:</div>
              <div className="flex items-center justify-between text-slate-200">
                <span>$1,000 USD =</span>
                <span className="font-bold text-brand-green font-mono text-sm">
                  {currencySymbol}{convertedSample}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || saved}
                className="flex-1 py-2.5 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-dark-950 text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                {saved ? <><Check className="w-4 h-4" /> Saved!</> : (loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save Settings')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
});
