import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Building2, Cpu, Shield, Zap, Wheat, HeartPulse, 
  Factory, Film, Gem, Rocket, Sparkles, CheckCircle2, 
  ArrowRight, TrendingUp, HelpCircle, Info
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SECTORS = [
  { id: 'Technology & AI', label: 'Technology & AI', icon: Cpu, desc: 'Computers, artificial intelligence, software' },
  { id: 'Defense & Aerospace', label: 'Defense & Aerospace', icon: Shield, desc: 'Satellites, aircraft, military gear' },
  { id: 'Energy & Utilities', label: 'Energy & Power', icon: Zap, desc: 'Clean power, solar, nuclear, oil & gas' },
  { id: 'Healthcare & Pharma', label: 'Healthcare & Medicine', icon: HeartPulse, desc: 'Hospitals, medical research, pharmaceuticals' },
  { id: 'Agriculture & Food', label: 'Farming & Food', icon: Wheat, desc: 'Grain harvests, crops, packaged foods' },
  { id: 'Heavy Manufacturing', label: 'Factories & Industry', icon: Factory, desc: 'Robotics, machinery, steel refining' },
  { id: 'Transport & Space', label: 'Transport & Space', icon: Rocket, desc: 'Airlines, shipping, trains, rockets' },
  { id: 'Luxury Goods', label: 'Luxury & Jewelry', icon: Gem, desc: 'High-end watches, fashion, premium items' },
  { id: 'Media & Entertainment', label: 'Media & Entertainment', icon: Film, desc: 'Movies, gaming, streaming, journalism' },
];

const SCALE_LABELS = {
  1: { name: 'Small Startup', range: '~$15M Total Value', desc: 'A brand-new, agile company with lots of room to grow fast.' },
  2: { name: 'Growing Business', range: '~$75M Total Value', desc: 'A solid local company with steady sales and expanding operations.' },
  3: { name: 'Established Corporation', range: '~$500M Total Value', desc: 'A recognized nationwide company with strong customer demand.' },
  4: { name: 'Large Conglomerate', range: '~$5B Total Value', desc: 'An industrial giant with massive factories and global sales.' },
  5: { name: 'Massive Global Titan', range: '~$45B+ Total Value', desc: 'One of the biggest companies in the world, dominating entire markets.' },
};

const PROFIT_LABELS = {
  1: { name: 'Growing Fast (No Profit Yet)', desc: 'Spends most cash on growth and research, currently operating at a loss.' },
  2: { name: 'Breaking Even', desc: 'Making just enough revenue to cover business costs.' },
  3: { name: 'Steady & Healthy Profits', desc: 'Consistently makes a comfortable profit quarter after quarter.' },
  4: { name: 'Very Profitable (Cash Rich)', desc: 'High profit margins with lots of extra cash coming in.' },
  5: { name: 'Market Monopoly (Super High Profits)', desc: 'Dominates the industry and makes enormous profits with little competition.' },
};

const VOLATILITY_LABELS = {
  1: { name: 'Very Stable (Low Risk)', desc: 'Prices move gently up or down. Great for calm, defensive investing.' },
  2: { name: 'Moderately Stable', desc: 'Fairly steady prices with modest reactions to daily news.' },
  3: { name: 'Standard Market Movement', desc: 'Normal price changes in response to market events and company earnings.' },
  4: { name: 'Wild & Fast Moving (Higher Risk)', desc: 'Bigger price swings that can deliver quick gains or quick drops.' },
  5: { name: 'Extreme Rollercoaster (High Risk / High Reward)', desc: 'Huge price jumps and sharp drops driven by intense trader hype.' },
};

// Pure client-side high-speed valuation engine
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

  // Wizard Form State
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

  // Instant pure client-side math computation (<0.001ms, 0 network lag)
  const metrics = useMemo(() => {
    return computeValuation(sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent);
  }, [sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent]);

  const founderShares = metrics.sharesOutstanding - metrics.sharesFloat;
  const founderEquityValueUsd = +(founderShares * metrics.initialPriceUsd).toFixed(2);

  // Handle IPO Launch
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
      
      {/* Title & Introduction Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Create Your Own Public Company
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Build a company using simple sliders. We will calculate the starting stock price, total value, and give you free founder shares!
            </p>
          </div>
        </div>

        {nation && (
          <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
            <span className="text-slate-400 block text-[10px]">Founded By Nation</span>
            <span className="font-bold text-brand-cyan">{nation.name}</span>
          </div>
        )}
      </div>

      {/* Success Modal / Card after IPO */}
      {successResult && (
        <div className="p-6 rounded-2xl bg-dark-900 border border-brand-green/40 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center gap-3 text-brand-green">
            <CheckCircle2 className="w-8 h-8" />
            <div>
              <h2 className="text-lg font-bold text-white">Your Company is Now Live on the Market!</h2>
              <p className="text-xs text-slate-300">
                <strong>{successResult.asset.name}</strong> ({successResult.asset.ticker}) is now trading. Anyone can buy and sell its shares.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-950/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block">Starting Share Price:</span>
              <span className="text-base font-bold text-white">{formatMoney(successResult.asset.current_price_usd)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Your Free Founder Shares:</span>
              <span className="text-base font-bold text-brand-cyan">
                {successResult.founderShares.toLocaleString()} Shares ({100 - publicFloatPercent}%)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Total Company Value:</span>
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
              <TrendingUp className="w-4 h-4" /> Go Trade {successResult.asset.ticker}
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setName('');
                setTicker('');
              }}
              className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Create Another Company
            </button>
          </div>
        </div>
      )}

      {/* Main Creation Grid */}
      <form onSubmit={handleLaunchIPO} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Sliders & Selectors (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Step 1: Corporate Identity */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">1</span>
              Company Name & Industry
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
                  placeholder="e.g. Apex Robotics Corp"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Short Stock Symbol (Ticker) <span className="text-brand-green">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. APEX (3-5 letters)"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm uppercase focus:outline-none focus:border-brand-cyan"
                />
              </div>
            </div>

            {/* Sector Choice Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                What does this company do?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTORS.map((s) => {
                  const Icon = s.icon;
                  const isSelected = sector === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSector(s.id)}
                      className={`p-3 rounded-xl text-left border transition flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-brand-cyan/15 border-brand-cyan/50 text-white shadow-md'
                          : 'bg-dark-850 border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-brand-cyan' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold leading-tight truncate">{s.label}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step 2: Scale & Financial Margins */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">2</span>
              Company Size & Profitability
            </div>

            {/* Scale Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">How big is the company?</span>
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
                <span className="font-semibold text-slate-300">How profitable is it right now?</span>
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

          {/* Step 3: Volatility & Public Float */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">3</span>
              Risk Level & How Many Shares You Keep
            </div>

            {/* Volatility Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Price Swings (Risk Level):</span>
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
                <span className="font-semibold text-slate-300">Shares for the Public vs You:</span>
                <span className="font-bold text-amber-400 font-mono">{publicFloatPercent}% for Public / {100 - publicFloatPercent}% Kept by You</span>
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
                You will automatically receive <strong>{100 - publicFloatPercent}% of all shares</strong> in your portfolio for free as the founder!
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Auto-Calculated Valuation & Launch Box (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sticky top-24 p-6 rounded-2xl bg-gradient-to-b from-dark-900 to-dark-950 border border-brand-cyan/30 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
                <h3 className="text-base font-bold text-white">Calculated Stock Value</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-green/10 text-brand-green font-mono font-bold">
                Auto-Calculated
              </span>
            </div>

            {/* Big Initial Price Display */}
            <div className="p-4 rounded-xl bg-dark-850 border border-white/5 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block uppercase tracking-wider">Starting Price Per Share</span>
              <div className="text-3xl font-black text-white">
                {formatMoney(metrics.initialPriceUsd)}
              </div>
              <div className="text-xs text-slate-400">
                In US Dollars: <strong className="text-slate-300">{formatRawUSD(metrics.initialPriceUsd)}</strong>
              </div>
            </div>

            {/* Calculated Metrics Breakdown */}
            <div className="space-y-2.5 font-mono text-xs divide-y divide-white/5">
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>Total Company Worth:</span>
                <span className="font-bold text-white">{formatMoney(metrics.marketCapUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Total Shares Created:</span>
                <span className="font-bold text-slate-200">{metrics.sharesOutstanding.toLocaleString()} shares</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Shares Available to Public:</span>
                <span className="font-bold text-amber-400">{metrics.sharesFloat.toLocaleString()} ({publicFloatPercent}%)</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Free Founder Shares:</span>
                <span className="font-bold text-brand-cyan">{founderShares.toLocaleString()} shares</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Value of Your Shares:</span>
                <span className="font-bold text-brand-green">{formatMoney(founderEquityValueUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Bonus Payouts (Dividends):</span>
                <span className="font-bold text-brand-green">
                  {metrics.dividendYield > 0 ? `${(metrics.dividendYield * 100).toFixed(1)}% per year` : 'None (Reinvesting in growth)'}
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
                'Creating Company on Market...'
              ) : nation ? (
                <>Launch {ticker || 'Company'} to the Market <ArrowRight className="w-4 h-4" /></>
              ) : (
                'Sign In Nation to Create Company'
              )}
            </button>

            <p className="text-[11px] text-slate-500 text-center leading-tight">
              Once created, computer traders and other players will begin trading your stock, and your company will pay regular dividends to your portfolio if profitable.
            </p>

          </div>

        </div>

      </form>

    </div>
  );
});
