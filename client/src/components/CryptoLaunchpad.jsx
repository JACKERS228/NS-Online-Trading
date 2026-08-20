import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Coins, Sparkles, Flame, ShieldCheck, Zap, Rocket, 
  TrendingUp, CheckCircle2, ArrowRight, Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CryptoLaunchpad({ onTokenCreated }) {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();
  const { setSelectedTicker } = useMarket();

  const [tokenName, setTokenName] = useState('');
  const [ticker, setTicker] = useState('');
  const [category, setCategory] = useState('Sovereign National Reserve');
  const [description, setDescription] = useState('');
  const [supplyTier, setSupplyTier] = useState(2); // 1 to 5 (21M default)
  const [hypeLevel, setHypeLevel] = useState(3); // 1 to 5
  const [stakingYield, setStakingYield] = useState(6); // %

  const [loading, setLoading] = useState(false);
  const [successToken, setSuccessToken] = useState(null);
  const [error, setError] = useState('');

  const categories = [
    { id: 'Sovereign National Reserve', label: 'Sovereign Reserve', icon: ShieldCheck, desc: 'Central bank backed crypto treasury asset' },
    { id: 'DeFi & Yield Protocol', label: 'DeFi & Yield', icon: Zap, desc: 'Automated staking contracts and protocol fees' },
    { id: 'Meme & Community Hype', label: 'Meme / Moonshot', icon: Flame, desc: 'Viral speculative asset driven by social sentiment' },
    { id: 'Autonomous Utility', label: 'Tech Utility', icon: Rocket, desc: 'Network compute fuel and decentralized storage token' },
  ];

  const supplies = {
    1: { name: 'Ultra-Scarce', supply: 1000000, label: '1,000,000 Tokens' },
    2: { name: 'Sovereign Standard', supply: 21000000, label: '21,000,000 Tokens' },
    3: { name: 'Utility Reserve', supply: 100000000, label: '100,000,000 Tokens' },
    4: { name: 'High Liquidity', supply: 1000000000, label: '1,000,000,000 Tokens' },
    5: { name: 'Memecoin Hyper-Supply', supply: 100000000000, label: '100,000,000,000 Tokens' },
  };

  const basePrices = {
    1: 50.0,
    2: 12.50,
    3: 2.20,
    4: 0.35,
    5: 0.0042
  };

  const currentSupply = supplies[supplyTier].supply;
  const hypeMult = 0.5 + (Number(hypeLevel) * 0.3);
  const estimatedInitialPriceUsd = +(basePrices[supplyTier] * hypeMult).toFixed(4);
  const estimatedMarketCapUsd = +(estimatedInitialPriceUsd * currentSupply).toFixed(2);
  const founderTokens = Math.floor(currentSupply * 0.1); // 10% founder genesis allocation
  const founderEquityValueUsd = +(founderTokens * estimatedInitialPriceUsd).toFixed(2);

  const handleMintGenesis = async (e) => {
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
        throw new Error(data.error || 'Failed to mint cryptocurrency');
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
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Launchpad Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-purple-950/40 to-dark-900 border border-purple-500/20 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Coins className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Fictional Cryptocurrency Genesis Launchpad
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Deploy sovereign crypto assets, staking protocols, or memecoins directly to the simulated exchange.
            </p>
          </div>
        </div>

        {nation && (
          <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
            <span className="text-slate-400 block text-[10px]">Sovereign Issuer</span>
            <span className="font-bold text-purple-400">{nation.name}</span>
          </div>
        )}
      </div>

      {/* Success Notification */}
      {successToken && (
        <div className="p-6 rounded-2xl bg-dark-900 border border-purple-500/40 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 text-purple-400">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h2 className="text-lg font-bold text-white">Genesis Block Minted Successfully!</h2>
              <p className="text-xs text-slate-300">
                <strong>{successToken.name}</strong> ({successToken.ticker}) is now live on the trading desk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-950/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block">Genesis Price:</span>
              <span className="text-base font-bold text-white">${Number(successToken.current_price_usd).toFixed(4)} USD</span>
            </div>
            <div>
              <span className="text-slate-400 block">Founder Allocation (10%):</span>
              <span className="text-base font-bold text-purple-400">{founderTokens.toLocaleString()} {successToken.ticker}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Total Market Cap:</span>
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
              <TrendingUp className="w-4 h-4" /> View {successToken.ticker} on Trading Desk
            </button>
            <button
              onClick={() => {
                setSuccessToken(null);
                setTokenName('');
                setTicker('');
              }}
              className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
            >
              Mint Another Crypto
            </button>
          </div>
        </div>
      )}

      {/* Minting Form Grid */}
      <form onSubmit={handleMintGenesis} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 text-xs flex items-center justify-center font-mono">1</span>
              Token Identity & Protocol Category
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
                  placeholder="e.g. Sovereign Reserve Token"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Token Ticker Symbol <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. SRT"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm uppercase focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Category Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Crypto Token Archetype
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((c) => {
                  const Icon = c.icon;
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`p-3 rounded-xl text-left border transition flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-purple-500/15 border-purple-500/50 text-white shadow-md'
                          : 'bg-dark-850 border-white/5 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-dark-800 text-slate-400'}`}>
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
              Tokenomics, Supply & Staking Yield
            </div>

            {/* Supply Tier Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Max Supply Cap:</span>
                <span className="font-bold text-purple-400 font-mono">{supplies[supplyTier].label}</span>
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
                <span className="font-semibold text-slate-300">Speculative Hype Factor:</span>
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

            {/* Staking Yield APY Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Protocol Staking Yield (APY):</span>
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

        {/* Right Preview & Genesis Button (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sticky top-24 p-6 rounded-2xl bg-gradient-to-b from-dark-900 to-dark-950 border border-purple-500/30 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Genesis Tokenomics</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono font-bold">
                Smart Contract
              </span>
            </div>

            {/* Initial Token Price */}
            <div className="p-4 rounded-xl bg-dark-850 border border-white/5 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block uppercase tracking-wider">Estimated Genesis Token Price</span>
              <div className="text-3xl font-black text-purple-400">
                ${estimatedInitialPriceUsd} USD
              </div>
              <div className="text-xs text-slate-400">
                In National Currency: <strong className="text-slate-200">{formatMoney(estimatedInitialPriceUsd)}</strong>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="space-y-2.5 font-mono text-xs divide-y divide-white/5">
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>Total Token Supply:</span>
                <span className="font-bold text-white">{currentSupply.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Genesis Market Cap:</span>
                <span className="font-bold text-brand-green">{formatMoney(estimatedMarketCapUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Founder Genesis Mint (10%):</span>
                <span className="font-bold text-purple-400">{founderTokens.toLocaleString()} {ticker || 'Tokens'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Founder Stake Value:</span>
                <span className="font-bold text-brand-green">{formatMoney(founderEquityValueUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Staking Protocol Yield:</span>
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
                'Minting Genesis Block...'
              ) : nation ? (
                <>Mint & Launch {ticker || 'Token'} On Exchange <ArrowRight className="w-4 h-4" /></>
              ) : (
                'Sign In Nation to Launch Token'
              )}
            </button>

          </div>

        </div>

      </form>

    </div>
  );
}
