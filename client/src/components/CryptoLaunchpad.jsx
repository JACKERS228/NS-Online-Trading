import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Coins, Sparkles, Flame, ShieldCheck, Zap, Rocket, 
  TrendingUp, CheckCircle2, ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

const CATEGORIES = [
  { id: 'Sovereign National Reserve', label: 'National Reserve', icon: ShieldCheck, desc: 'Central bank treasury token' },
  { id: 'DeFi & Yield Protocol', label: 'Staking & Yield', icon: Zap, desc: 'Automated rewards token' },
  { id: 'Meme & Community Hype', label: 'Meme Coin', icon: Flame, desc: 'Community-driven viral token' },
  { id: 'Autonomous Utility', label: 'Utility Token', icon: Rocket, desc: 'App & service compute fuel' },
];

const SUPPLIES = {
  1: { name: 'Ultra-Rare', supply: 1000000, label: '1 Million' },
  2: { name: 'Standard', supply: 21000000, label: '21 Million' },
  3: { name: 'Large', supply: 100000000, label: '100 Million' },
  4: { name: 'Massive', supply: 1000000000, label: '1 Billion' },
  5: { name: 'Hyper Supply', supply: 100000000000, label: '100 Billion' },
};

const BASE_PRICES = {
  1: 50.0,
  2: 12.50,
  3: 2.20,
  4: 0.35,
  5: 0.0042
};

export default React.memo(function CryptoLaunchpad({ onTokenCreated }) {
  const { nation, formatMoney, refreshProfile, setAuthModalOpen } = useAuth();
  const { setSelectedTicker } = useMarket();

  const [tokenName, setTokenName] = useState('');
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState('Sovereign National Reserve');
  const [description, setDescription] = useState('');
  const [supplyTier, setSupplyTier] = useState(2);
  const [hypeLevel, setHypeLevel] = useState(3);
  const [stakingYield, setStakingYield] = useState(6);

  const [loading, setLoading] = useState(false);
  const [successToken, setSuccessToken] = useState(null);
  const [error, setError] = useState('');

  const tokenomics = useMemo(() => {
    const supply = SUPPLIES[supplyTier]?.supply || 21000000;
    const hypeMult = 0.5 + (Number(hypeLevel) * 0.3);
    const initialPrice = +(BASE_PRICES[supplyTier] * hypeMult).toFixed(4);
    const marketCap = +(initialPrice * supply).toFixed(2);
    const founderAllocation = Math.floor(supply * 0.1);
    const founderValue = +(founderAllocation * initialPrice).toFixed(2);

    return {
      supply,
      initialPrice,
      marketCap,
      founderAllocation,
      founderValue
    };
  }, [supplyTier, hypeLevel]);

  const handleMintGenesis = useCallback(async (e) => {
    e.preventDefault();
    if (!nation) {
      setAuthModalOpen(true);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/wizard/crypto/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tokenName,
          ticker,
          category,
          description,
          supplyTier,
          hypeLevel,
          stakingYield
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create cryptocurrency');
      }

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 }
      });

      setSuccessToken(data.asset);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nation, tokenName, ticker, category, description, supplyTier, hypeLevel, stakingYield, refreshProfile, setAuthModalOpen]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-purple-950/40 to-dark-900 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Create Cryptocurrency
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Launch a new crypto token with custom supply and staking rewards.
            </p>
          </div>
        </div>

        {nation && (
          <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
            <span className="text-slate-400 block text-[10px]">Issuer</span>
            <span className="font-bold text-purple-400">{nation.name}</span>
          </div>
        )}
      </div>

      {/* Success Card */}
      {successToken && (
        <div className="p-6 rounded-2xl bg-dark-900 border border-purple-500/40 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 text-purple-400">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h2 className="text-lg font-bold text-white">Token Created!</h2>
              <p className="text-xs text-slate-300">
                <strong>{successToken.name}</strong> ({successToken.ticker}) is now live.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-950/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block">Starting Price:</span>
              <span className="text-base font-bold text-white">${Number(successToken.current_price_usd).toFixed(4)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Your Stash (10%):</span>
              <span className="text-base font-bold text-purple-400">{tokenomics.founderAllocation.toLocaleString()} {successToken.ticker}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Market Cap:</span>
              <span className="text-base font-bold text-brand-green">{formatMoney(successToken.market_cap_usd)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedTicker(successToken.ticker);
                if (onTokenCreated) onTokenCreated();
              }}
              className="py-2.5 px-5 rounded-xl bg-purple-500 hover:bg-purple-400 text-dark-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
            >
              <TrendingUp className="w-4 h-4" /> Trade {successToken.ticker}
            </button>
            <button
              onClick={() => {
                setSuccessToken(null);
                setTokenName('');
                setTicker('');
              }}
              className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Create Another
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleMintGenesis} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 text-xs flex items-center justify-center font-mono">1</span>
              Token Info
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Token Name <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g. Solaris Credit"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Ticker Symbol <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. SOC"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm uppercase focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Category Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Token Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`p-3 rounded-xl text-left border transition flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/50 text-white shadow-md'
                          : 'bg-dark-850 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-dark-800 text-slate-400'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{c.label}</span>
                        <p className="text-[10px] text-slate-500">{c.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tokenomics & Sliders */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 text-xs flex items-center justify-center font-mono">2</span>
              Supply & Rewards
            </div>

            {/* Supply Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Max Supply:</span>
                <span className="font-bold text-purple-400 font-mono">{SUPPLIES[supplyTier]?.label}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={supplyTier}
                onChange={(e) => setSupplyTier(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Hype Level Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Hype Level:</span>
                <span className="font-bold text-brand-gold font-mono">Level {hypeLevel} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={hypeLevel}
                onChange={(e) => setHypeLevel(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Staking Yield Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Staking Yield:</span>
                <span className="font-bold text-brand-green font-mono">{stakingYield}% APY</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={stakingYield}
                onChange={(e) => setStakingYield(Number(e.target.value))}
                className="w-full accent-brand-green cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Right Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sticky top-24 p-6 rounded-2xl bg-gradient-to-b from-dark-900 to-dark-950 border border-purple-500/30 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Token Summary</h3>
              </div>
            </div>

            {/* Token Price */}
            <div className="p-4 rounded-xl bg-dark-850 border border-white/5 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block uppercase tracking-wider">Starting Price</span>
              <div className="text-3xl font-black text-purple-400">
                ${tokenomics.initialPrice} USD
              </div>
              <div className="text-xs text-slate-400">
                In Your Currency: <strong className="text-slate-200">{formatMoney(tokenomics.initialPrice)}</strong>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2.5 font-mono text-xs divide-y divide-white/5">
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>Total Supply:</span>
                <span className="font-bold text-white">{tokenomics.supply.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Market Cap:</span>
                <span className="font-bold text-brand-green">{formatMoney(tokenomics.marketCap)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Stash (10%):</span>
                <span className="font-bold text-purple-400">{tokenomics.founderAllocation.toLocaleString()} {ticker || 'Tokens'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Stake Value:</span>
                <span className="font-bold text-brand-green">{formatMoney(tokenomics.founderValue)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Staking Yield:</span>
                <span className="font-bold text-brand-cyan">{stakingYield}% APY</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !tokenName.trim() || !ticker.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-brand-cyan hover:from-purple-400 hover:to-cyan-400 text-dark-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-500/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Launching...'
              ) : nation ? (
                <>Launch {ticker || 'Token'} <ArrowRight className="w-4 h-4" /></>
              ) : (
                'Sign In to Launch'
              )}
            </button>

          </div>

        </div>

      </form>

    </div>
  );
});
