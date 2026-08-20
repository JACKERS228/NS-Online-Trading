import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Building2, Cpu, Shield, Zap, Wheat, HeartPulse, 
  Factory, Film, Gem, Rocket, Sparkles, CheckCircle2, 
  ArrowRight, TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SECTORS = [
  { id: 'Technology & AI', label: 'Tech & AI', icon: Cpu, desc: 'Software, hardware, AI' },
  { id: 'Defense & Aerospace', label: 'Defense', icon: Shield, desc: 'Aviation, security, satellites' },
  { id: 'Energy & Utilities', label: 'Energy', icon: Zap, desc: 'Power, solar, oil & gas' },
  { id: 'Healthcare & Pharma', label: 'Healthcare', icon: HeartPulse, desc: 'Medicine, biotech, hospitals' },
  { id: 'Agriculture & Food', label: 'Agriculture', icon: Wheat, desc: 'Farming, food production' },
  { id: 'Heavy Manufacturing', label: 'Manufacturing', icon: Factory, desc: 'Robotics, industrial equipment' },
  { id: 'Transport & Space', label: 'Transport', icon: Rocket, desc: 'Logistics, aerospace, rail' },
  { id: 'Luxury Goods', label: 'Luxury', icon: Gem, desc: 'Fashion, jewelry, goods' },
  { id: 'Media & Entertainment', label: 'Media', icon: Film, desc: 'Gaming, streaming, news' },
];

const SCALE_LABELS = {
  1: { name: 'Startup', range: '$15M', desc: 'Early stage with high growth potential.' },
  2: { name: 'Small Business', range: '$75M', desc: 'Solid regional operations and steady revenue.' },
  3: { name: 'Mid-Cap', range: '$500M', desc: 'Established national market share.' },
  4: { name: 'Large Corp', range: '$5B', desc: 'Major industry player with large-scale output.' },
  5: { name: 'Mega Corp', range: '$45B+', desc: 'Global market leader with massive reach.' },
};

const PROFIT_LABELS = {
  1: { name: 'Growth (No Profit)', desc: 'Reinvesting all cash into expansion.' },
  2: { name: 'Break-Even', desc: 'Covering operational expenses.' },
  3: { name: 'Profitable', desc: 'Consistent, dependable quarterly earnings.' },
  4: { name: 'High Margin', desc: 'Strong pricing power and surplus cash.' },
  5: { name: 'Market Leader', desc: 'Dominant market position with top margins.' },
};

const VOLATILITY_LABELS = {
  1: { name: 'Low Risk', desc: 'Steady prices, minimal swings.' },
  2: { name: 'Moderate', desc: 'Modest reactions to news.' },
  3: { name: 'Standard', desc: 'Normal market movement.' },
  4: { name: 'High Risk', desc: 'Fast, sharp price swings.' },
  5: { name: 'Very High Risk', desc: 'Extreme speculative swings.' },
};

function computeValuation(sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent) {
  const scaleCaps = { 1: 15000000, 2: 75000000, 3: 500000000, 4: 5000000000, 5: 45000000000 };
  const profitMultipliers = { 1: 0.65, 2: 0.85, 3: 1.05, 4: 1.35, 5: 1.75 };
  const volatilityValues = { 1: 0.025, 2: 0.040, 3: 0.065, 4: 0.095, 5: 0.140 };

  const sectorDividendBase = {
    'Energy & Utilities': 0.048,
    'Defense & Aerospace': 0.035,
    'Healthcare & Pharma': 0.028,
    'Agriculture & Food': 0.038,
    'Heavy Manufacturing': 0.032,
    'Technology & AI': 0.012,
    'Media & Entertainment': 0.020,
    'Luxury Goods': 0.025,
    'Transport & Space': 0.022
  };

  const baseCap = scaleCaps[scaleTier] || scaleCaps[3];
  const mult = profitMultipliers[profitabilityTier] || 1.0;
  const marketCapUsd = +(baseCap * mult).toFixed(2);

  const targetSharePrice = +(15 + (scaleTier * 12) + (profitabilityTier * 6)).toFixed(2);
  const sharesOutstanding = Math.floor(marketCapUsd / targetSharePrice);
  const floatPct = Math.max(10, Math.min(90, Number(publicFloatPercent) || 50));
  const sharesFloat = Math.floor(sharesOutstanding * (floatPct / 100));

  const baseDiv = sectorDividendBase[sector] || 0.025;
  const divYield = profitabilityTier >= 3 ? +(baseDiv * (profitabilityTier / 3)).toFixed(4) : 0;
  const healthScore = Math.min(100, Math.max(10, (profitabilityTier * 16) + (scaleTier * 4)));
  const vol = volatilityValues[volatilityTier] || 0.065;
  const initialVolume24h = Math.floor(sharesFloat * 0.08);

  return {
    initialPriceUsd: targetSharePrice,
    marketCapUsd,
    sharesOutstanding,
    sharesFloat,
    floatPercent: floatPct,
    volatility: vol,
    dividendYield: divYield,
    healthScore,
    estimatedVolume24h: initialVolume24h
  };
}

export default React.memo(function CompanyWizard({ onCompanyCreated }) {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();
  const { setSelectedTicker } = useMarket();

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [sector, setSector] = useState('Technology & AI');
  const [description, setDescription] = useState('');
  const [scaleTier, setScaleTier] = useState(3);
  const [profitabilityTier, setProfitabilityTier] = useState(3);
  const [volatilityTier, setVolatilityTier] = useState(3);
  const [publicFloatPercent, setPublicFloatPercent] = useState(60);

  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  const metrics = useMemo(() => {
    return computeValuation(sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent);
  }, [sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent]);

  const founderShares = metrics.sharesOutstanding - metrics.sharesFloat;
  const founderEquityValueUsd = +(founderShares * metrics.initialPriceUsd).toFixed(2);

  const handleLaunchIPO = useCallback(async (e) => {
    e.preventDefault();
    if (!nation) {
      setAuthModalOpen(true);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/wizard/company/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          ticker,
          sector,
          description,
          scaleTier,
          profitabilityTier,
          volatilityTier,
          publicFloatPercent
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create company');
      }

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });

      setSuccessResult(data);
      await refreshProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nation, name, ticker, sector, description, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent, refreshProfile, setAuthModalOpen]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Title Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Create Company
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Set your company stats, calculate valuation, and launch to the exchange.
            </p>
          </div>
        </div>

        {nation && (
          <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
            <span className="text-slate-400 block text-[10px]">Nation</span>
            <span className="font-bold text-brand-cyan">{nation.name}</span>
          </div>
        )}
      </div>

      {/* Success Card */}
      {successResult && (
        <div className="p-6 rounded-2xl bg-dark-900 border border-brand-green/40 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 text-brand-green">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h2 className="text-lg font-bold text-white">Company Created!</h2>
              <p className="text-xs text-slate-300">
                <strong>{successResult.asset.name}</strong> ({successResult.asset.ticker}) is now live.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-950/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block">Share Price:</span>
              <span className="text-base font-bold text-white">{formatMoney(successResult.asset.current_price_usd)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Your Founder Shares:</span>
              <span className="text-base font-bold text-brand-cyan">
                {successResult.founderShares.toLocaleString()} ({100 - publicFloatPercent}%)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Market Cap:</span>
              <span className="text-base font-bold text-brand-green">
                {formatMoney(successResult.asset.market_cap_usd)}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedTicker(successResult.asset.ticker);
                if (onCompanyCreated) onCompanyCreated();
              }}
              className="py-2.5 px-5 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-dark-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-cyan/20"
            >
              <TrendingUp className="w-4 h-4" /> Trade {successResult.asset.ticker}
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setName('');
                setTicker('');
              }}
              className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Create Another
            </button>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleLaunchIPO} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Inputs (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Company Info */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">1</span>
              Company Info
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Company Name <span className="text-brand-green">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex Dynamics"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Stock Ticker <span className="text-brand-green">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. APEX"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm uppercase focus:outline-none focus:border-brand-cyan"
                />
              </div>
            </div>

            {/* Sector Choice Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Industry Sector
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SECTORS.map((s) => {
                  const Icon = s.icon;
                  const isSelected = sector === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSector(s.id)}
                      className={`p-2.5 rounded-xl text-left border transition flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-brand-cyan/15 border-brand-cyan/50 text-white shadow-md'
                          : 'bg-dark-850 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-brand-cyan' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold truncate">{s.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Financials */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">2</span>
              Financial Scale
            </div>

            {/* Scale Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Company Size:</span>
                <span className="font-bold text-brand-cyan font-mono">{SCALE_LABELS[scaleTier].name} ({SCALE_LABELS[scaleTier].range})</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={scaleTier}
                onChange={(e) => setScaleTier(Number(e.target.value))}
                className="w-full accent-brand-cyan cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">{SCALE_LABELS[scaleTier].desc}</p>
            </div>

            {/* Profitability Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Profitability:</span>
                <span className="font-bold text-brand-green font-mono">{PROFIT_LABELS[profitabilityTier].name}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={profitabilityTier}
                onChange={(e) => setProfitabilityTier(Number(e.target.value))}
                className="w-full accent-brand-green cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">{PROFIT_LABELS[profitabilityTier].desc}</p>
            </div>
          </div>

          {/* Step 3: Shares & Risk */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">3</span>
              Shares & Risk
            </div>

            {/* Volatility Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Volatility & Risk:</span>
                <span className="font-bold text-purple-400 font-mono">{VOLATILITY_LABELS[volatilityTier].name}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={volatilityTier}
                onChange={(e) => setVolatilityTier(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">{VOLATILITY_LABELS[volatilityTier].desc}</p>
            </div>

            {/* Public Float % Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Public Float %:</span>
                <span className="font-bold text-amber-400 font-mono">{publicFloatPercent}% Public / {100 - publicFloatPercent}% Founder</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={publicFloatPercent}
                onChange={(e) => setPublicFloatPercent(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                You retain {100 - publicFloatPercent}% of all shares in your portfolio.
              </p>
            </div>
          </div>
        </div>

        {/* Right Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sticky top-24 p-6 rounded-2xl bg-gradient-to-b from-dark-900 to-dark-950 border border-brand-cyan/30 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
                <h3 className="text-base font-bold text-white">Valuation Summary</h3>
              </div>
            </div>

            {/* Share Price */}
            <div className="p-4 rounded-xl bg-dark-850 border border-white/5 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block uppercase tracking-wider">Share Price</span>
              <div className="text-3xl font-black text-white">
                {formatMoney(metrics.initialPriceUsd)}
              </div>
              <div className="text-xs text-slate-400">
                USD: <strong className="text-slate-300">{formatRawUSD(metrics.initialPriceUsd)}</strong>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-2.5 font-mono text-xs divide-y divide-white/5">
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>Market Cap:</span>
                <span className="font-bold text-white">{formatMoney(metrics.marketCapUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Total Shares:</span>
                <span className="font-bold text-slate-200">{metrics.sharesOutstanding.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Public Shares:</span>
                <span className="font-bold text-amber-400">{metrics.sharesFloat.toLocaleString()} ({publicFloatPercent}%)</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Founder Shares:</span>
                <span className="font-bold text-brand-cyan">{founderShares.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Equity Value:</span>
                <span className="font-bold text-brand-green">{formatMoney(founderEquityValueUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Dividend Yield:</span>
                <span className="font-bold text-brand-green">
                  {metrics.dividendYield > 0 ? `${(metrics.dividendYield * 100).toFixed(1)}% / yr` : '0%'}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name.trim() || !ticker.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-green to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-dark-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-brand-green/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                'Launching...'
              ) : nation ? (
                <>Launch {ticker || 'Company'} <ArrowRight className="w-4 h-4" /></>
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
