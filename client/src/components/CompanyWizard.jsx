import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Building2, Cpu, Shield, Zap, Wheat, HeartPulse, 
  Factory, Film, Gem, Rocket, Sparkles, CheckCircle2, 
  ArrowRight, Info, Sliders, TrendingUp, DollarSign
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CompanyWizard({ onCompanyCreated }) {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();
  const { setSelectedTicker } = useMarket();

  // Wizard Form State
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [sector, setSector] = useState('Technology & AI');
  const [description, setDescription] = useState('');
  const [scaleTier, setScaleTier] = useState(3); // 1 to 5
  const [profitabilityTier, setProfitabilityTier] = useState(3); // 1 to 5
  const [volatilityTier, setVolatilityTier] = useState(3); // 1 to 5
  const [publicFloatPercent, setPublicFloatPercent] = useState(60); // 10 to 90%

  // Live Preview Calculation State
  const [metrics, setMetrics] = useState({
    initialPriceUsd: 54.00,
    marketCapUsd: 525000000,
    sharesOutstanding: 9722222,
    sharesFloat: 5833333,
    floatPercent: 60,
    volatility: 0.065,
    dividendYield: 0.025,
    healthScore: 60,
    estimatedVolume24h: 466666
  });

  const [loading, setLoading] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [error, setError] = useState('');

  const sectors = [
    { id: 'Technology & AI', label: 'Technology & AI', icon: Cpu, desc: 'Quantum chips, autonomous systems, cloud grids' },
    { id: 'Defense & Aerospace', label: 'Defense & Aerospace', icon: Shield, desc: 'Hypersonic munitions, naval defense, sovereign satellites' },
    { id: 'Energy & Utilities', label: 'Energy & Utilities', icon: Zap, desc: 'Nuclear fusion, synthetic fuel, trans-national power' },
    { id: 'Healthcare & Pharma', label: 'Healthcare & Pharma', icon: HeartPulse, desc: 'Bio-engineering, universal therapeutics, clinical research' },
    { id: 'Agriculture & Food', label: 'Agriculture & Food', icon: Wheat, desc: 'Automated vertical farming, grain reserves, synthetic proteins' },
    { id: 'Heavy Manufacturing', label: 'Heavy Manufacturing', icon: Factory, desc: 'Industrial robotics, naval shipyards, metallurgical refining' },
    { id: 'Transport & Space', label: 'Transport & Space', icon: Rocket, desc: 'Orbital haulers, maglev transit, sub-orbital freight' },
    { id: 'Luxury Goods', label: 'Luxury Goods', icon: Gem, desc: 'High-end horology, haute couture, sovereign reserves' },
    { id: 'Media & Entertainment', label: 'Media & Entertainment', icon: Film, desc: 'Holographic broadcast, neural streaming, global press' },
  ];

  const scaleLabels = {
    1: { name: 'Startup / Micro-Cap', range: '~$15M Cap', desc: 'Agile early-stage firm with exponential growth potential' },
    2: { name: 'Small Enterprise', range: '~$75M Cap', desc: 'Established regional commercial player with solid momentum' },
    3: { name: 'Mid-Cap Corporation', range: '~$500M Cap', desc: 'Major institutional producer with strong national market share' },
    4: { name: 'Large-Cap Conglomerate', range: '~$5B Cap', desc: 'Pillar of national industry with immense operational capacity' },
    5: { name: 'Sovereign MegaCorp', range: '~$45B+ Cap', desc: 'Multi-national titan dominating entire economic sectors' },
  };

  const profitLabels = {
    1: { name: 'Speculative / Cash Burn', desc: 'Aggressive R&D spending, currently running operational losses' },
    2: { name: 'Early Traction', desc: 'Approaching cash flow breakeven with emerging product-market fit' },
    3: { name: 'Steady Profit Margins', desc: 'Dependable consistent quarterly profitability (+12% margins)' },
    4: { name: 'High Cash Flow Generator', desc: 'Exceptional pricing power delivering rich operational cash flow' },
    5: { name: 'Market Monopoly', desc: 'Unmatched industry dominance with fortress balance sheets (+35% margin)' },
  };

  const volatilityLabels = {
    1: { name: 'Conservative Blue-Chip', desc: 'Extremely stable, low fluctuation, defensive dividend focus' },
    2: { name: 'Balanced Defensive', desc: 'Modest market beta, resilient across macroeconomic downturns' },
    3: { name: 'Moderate Growth', desc: 'Standard market correlation with dynamic response to quarterly news' },
    4: { name: 'High-Beta Growth', desc: 'Amplified price swings with substantial momentum runs' },
    5: { name: 'Speculative Moonshot', desc: 'Extreme volatility, rapid rallies, and sharp speculative corrections' },
  };

  // Recalculate metrics on slider changes
  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch('/api/wizard/company/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sector,
            scaleTier,
            profitabilityTier,
            volatilityTier,
            publicFloatPercent
          })
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error('Error fetching preview:', err);
      }
    }
    fetchPreview();
  }, [sector, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent]);

  // Handle IPO Launch
  const handleLaunchIPO = async (e) => {
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
        throw new Error(data.error || 'Failed to launch IPO');
      }

      // Trigger Confetti Celebration
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
  };

  const founderShares = metrics.sharesOutstanding - metrics.sharesFloat;
  const founderEquityValueUsd = +(founderShares * metrics.initialPriceUsd).toFixed(2);

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
              Company Creation Wizard & IPO Launchpad
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Form your sovereign enterprise using sliders and choice cards to auto-calculate IPO valuation, share price, and public float.
            </p>
          </div>
        </div>

        {nation && (
          <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
            <span className="text-slate-400 block text-[10px]">Founding Sovereign Nation</span>
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
              <h2 className="text-lg font-bold text-white">IPO Successfully Launched On Exchange!</h2>
              <p className="text-xs text-slate-300">
                <strong>{successResult.asset.name}</strong> ({successResult.asset.ticker}) is now live and trading on the global market.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-dark-950/60 font-mono text-xs">
            <div>
              <span className="text-slate-400 block">Initial Share Price:</span>
              <span className="text-base font-bold text-white">{formatMoney(successResult.asset.current_price_usd)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Founder Equity Retained:</span>
              <span className="text-base font-bold text-brand-cyan">
                {successResult.founderShares.toLocaleString()} Shares ({100 - publicFloatPercent}%)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Market Cap Valuation:</span>
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
              <TrendingUp className="w-4 h-4" /> View {successResult.asset.ticker} on Trading Desk
            </button>
            <button
              onClick={() => {
                setSuccessResult(null);
                setName('');
                setTicker('');
              }}
              className="py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
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
              Corporate Identity & Sector
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
                  placeholder="e.g. Valoria Cybernetics Corp"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Stock Ticker Symbol <span className="text-brand-green">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. VCYB"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm uppercase focus:outline-none focus:border-brand-cyan"
                />
              </div>
            </div>

            {/* Sector Choice Cards */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">
                Industry Sector
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sectors.map((s) => {
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
              Enterprise Scale & Profitability Sliders
            </div>

            {/* Scale Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Enterprise Scale Tier:</span>
                <span className="font-bold text-brand-cyan font-mono">{scaleLabels[scaleTier].name} ({scaleLabels[scaleTier].range})</span>
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
              <p className="text-[11px] text-slate-400">{scaleLabels[scaleTier].desc}</p>
            </div>

            {/* Profitability Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Profitability & Margin Strength:</span>
                <span className="font-bold text-brand-green font-mono">{profitLabels[profitabilityTier].name}</span>
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
              <p className="text-[11px] text-slate-400">{profitLabels[profitabilityTier].desc}</p>
            </div>
          </div>

          {/* Step 3: Volatility & Public Float */}
          <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <span className="w-6 h-6 rounded-full bg-brand-cyan/10 text-brand-cyan text-xs flex items-center justify-center font-mono">3</span>
              Risk Profile & Public Float %
            </div>

            {/* Volatility Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Market Volatility / Beta Factor:</span>
                <span className="font-bold text-purple-400 font-mono">{volatilityLabels[volatilityTier].name}</span>
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
              <p className="text-[11px] text-slate-400">{volatilityLabels[volatilityTier].desc}</p>
            </div>

            {/* Public Float % Slider */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Public Float % (Available to Traders):</span>
                <span className="font-bold text-amber-400 font-mono">{publicFloatPercent}% Float / {100 - publicFloatPercent}% Founder Retained</span>
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
                You will retain {100 - publicFloatPercent}% of all company shares directly in your sovereign portfolio.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Auto-Calculated Valuation & IPO Box (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sticky top-24 p-6 rounded-2xl bg-gradient-to-b from-dark-900 to-dark-950 border border-brand-cyan/30 shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
                <h3 className="text-base font-bold text-white">Live IPO Valuation Model</h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand-green/10 text-brand-green font-mono font-bold">
                Auto-Calculated
              </span>
            </div>

            {/* Big Initial Price Display */}
            <div className="p-4 rounded-xl bg-dark-850 border border-white/5 text-center font-mono space-y-1">
              <span className="text-xs text-slate-400 block uppercase tracking-wider">Calculated Initial Share Price</span>
              <div className="text-3xl font-black text-white">
                {formatMoney(metrics.initialPriceUsd)}
              </div>
              <div className="text-xs text-slate-400">
                USD Benchmark: <strong className="text-slate-300">{formatRawUSD(metrics.initialPriceUsd)}</strong>
              </div>
            </div>

            {/* Calculated Metrics Breakdown */}
            <div className="space-y-2.5 font-mono text-xs divide-y divide-white/5">
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>Total Market Valuation:</span>
                <span className="font-bold text-white">{formatMoney(metrics.marketCapUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Total Shares Outstanding:</span>
                <span className="font-bold text-slate-200">{metrics.sharesOutstanding.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Public Float Shares:</span>
                <span className="font-bold text-amber-400">{metrics.sharesFloat.toLocaleString()} ({publicFloatPercent}%)</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Your Founder Retained Equity:</span>
                <span className="font-bold text-brand-cyan">{founderShares.toLocaleString()} Shares</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Founder Equity Value:</span>
                <span className="font-bold text-brand-green">{formatMoney(founderEquityValueUsd)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Annual Dividend Yield:</span>
                <span className="font-bold text-brand-green">
                  {metrics.dividendYield > 0 ? `${(metrics.dividendYield * 100).toFixed(1)}% APY` : '0% (Reinvesting)'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 text-slate-300">
                <span>Initial 24h Volume Est:</span>
                <span className="font-bold text-slate-300">{metrics.estimatedVolume24h.toLocaleString()} shares</span>
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
                'Underwriting IPO...'
              ) : nation ? (
                <>Launch {ticker || 'Company'} IPO On Exchange <ArrowRight className="w-4 h-4" /></>
              ) : (
                'Sign In Nation to Launch IPO'
              )}
            </button>

            <p className="text-[11px] text-slate-500 text-center leading-tight">
              Upon launch, your company will begin live simulation with NPC trader order flow, quarterly earnings announcements, and dividend distributions.
            </p>

          </div>

        </div>

      </form>

    </div>
  );
}
