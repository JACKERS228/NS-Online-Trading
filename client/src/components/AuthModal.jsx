import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Globe, Coins, ArrowRight, Sparkles, X } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { registerOrLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [nationName, setNationName] = useState('');
  const [pin, setPin] = useState('');
  const [currencyName, setCurrencyName] = useState('Credits');
  const [currencySymbol, setCurrencySymbol] = useState('₪');
  const [usdExchangeRate, setUsdExchangeRate] = useState('2.50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleRateChange = (e) => {
    let val = e.target.value;
    // Restrict to 2 decimal places
    if (val.includes('.')) {
      const [whole, decimals] = val.split('.');
      if (decimals.length > 2) {
        val = `${whole}.${decimals.slice(0, 2)}`;
      }
    }
    setUsdExchangeRate(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const parsedRate = Math.max(0.01, +(Number(usdExchangeRate) || 1.0).toFixed(2));

    try {
      await registerOrLogin({
        nationName,
        pin,
        currencyName: isRegister ? currencyName.trim() : undefined,
        currencySymbol: isRegister ? currencySymbol.trim() : undefined,
        usdExchangeRate: isRegister ? parsedRate : undefined
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    const demoNum = Math.floor(Math.random() * 900 + 100);
    setNationName(`Republic of Valoria ${demoNum}`);
    setPin('1234');
    setCurrencyName('Valorian Dinar');
    setCurrencySymbol('VD');
    setUsdExchangeRate('3.20');
    setIsRegister(true);
  };

  const previewCapital = (100000 * (Number(usdExchangeRate) || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-dark-900 shadow-2xl">
        
        {/* Top glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-cyan via-brand-green to-brand-purple" />

        <div className="p-6 sm:p-8">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-green/10 border border-brand-green/20 text-brand-green">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  {isRegister ? 'Register Nation' : 'Sign In'}
                </h2>
                <p className="text-xs text-slate-400">
                  Access your companies, portfolio & trading account
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* CRITICAL SECURITY BANNER */}
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold text-amber-200">SECURITY NOTICE:</span> Never use your official NationStates password or secret PIN here.
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-brand-red/40 bg-brand-red/10 text-brand-red text-xs">
              {error}
            </div>
          )}

          {/* Mode Switch Tabs */}
          <div className="flex rounded-xl bg-dark-850 p-1 mb-5 border border-white/5">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                !isRegister 
                  ? 'bg-dark-750 text-white shadow-sm border border-white/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                isRegister 
                  ? 'bg-dark-750 text-white shadow-sm border border-white/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New Nation
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nation Name <span className="text-brand-green">*</span>
              </label>
              <input
                type="text"
                required
                value={nationName}
                onChange={(e) => setNationName(e.target.value)}
                placeholder="e.g. Federal Republic of Testland"
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-green/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                PIN / Password <span className="text-brand-green">*</span>
              </label>
              <input
                type="password"
                required
                minLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Create a 4+ digit PIN"
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-green/60"
              />
            </div>

            {/* Registration Custom Currency Inputs */}
            {isRegister && (
              <div className="p-4 rounded-xl bg-dark-850/60 border border-white/5 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-semibold text-brand-cyan mb-1">
                  <Coins className="w-4 h-4" /> National Currency Settings
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Currency Name</label>
                    <input
                      type="text"
                      value={currencyName}
                      onChange={(e) => setCurrencyName(e.target.value)}
                      placeholder="e.g. Dinar, Credits"
                      className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Symbol</label>
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="e.g. ₪, ₢, £, $"
                      className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    USD Exchange Rate (1 USD = X {currencyName || 'Currency'}) — <span className="text-slate-500">Max 2 Decimals</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={usdExchangeRate}
                    onChange={handleRateChange}
                    placeholder="e.g. 1.02"
                    className="w-full px-3 py-2 rounded-lg bg-dark-900 border border-white/10 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Starting balance: <strong>{currencySymbol}{previewCapital}</strong>
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dim hover:to-emerald-500 text-dark-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-green/20 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Processing...' : (isRegister ? 'Register Nation' : 'Sign In')}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleDemoFill}
                className="w-full py-2 px-3 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs flex items-center justify-center gap-1.5 border border-white/5 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-gold" /> Auto-Fill Demo Nation
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
