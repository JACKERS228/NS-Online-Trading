import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Package, Flame, Shield, Wheat, Mountain, Gem, 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  ArrowRight, ShieldCheck, Activity
} from 'lucide-react';

export default function CommoditiesMarket({ onSelectCommodity }) {
  const { formatMoney, formatRawUSD } = useAuth();
  const { assets, setSelectedTicker, priceFlashMap } = useMarket();

  const commodities = assets.filter(a => a.type === 'commodity');

  const getCommodityIcon = (ticker) => {
    switch (ticker) {
      case 'OIL': return { icon: Flame, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      case 'GOLD': return { icon: Gem, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
      case 'URNM': return { icon: Shield, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
      case 'COAL': return { icon: Mountain, color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' };
      case 'WHT': return { icon: Wheat, color: 'text-amber-300 bg-amber-300/10 border-amber-300/20' };
      case 'TITN': return { icon: ShieldCheck, color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' };
      default: return { icon: Package, color: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20' };
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-amber-500/20 shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Package className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Global Strategic Commodities Exchange
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Trade vital energy, agricultural, and industrial resource contracts priced in global benchmark reserves.
            </p>
          </div>
        </div>
      </div>

      {/* Commodities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commodities.map((comm) => {
          const { icon: Icon, color } = getCommodityIcon(comm.ticker);
          const chg = comm.change_24h !== undefined ? Number(comm.change_24h) : 0;
          const isPos = chg >= 0;
          const flash = priceFlashMap[comm.ticker];

          return (
            <div
              key={comm.id}
              className={`p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl flex flex-col justify-between space-y-4 transition ${
                flash === 'up' ? 'border-brand-green/50 bg-dark-850' : flash === 'down' ? 'border-brand-red/50 bg-dark-850' : 'hover:border-amber-500/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl border ${color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{comm.name}</h3>
                      <span className="font-mono text-xs text-slate-400 font-bold">({comm.ticker})</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-0.5 ${
                    isPos ? 'text-brand-green bg-brand-green/10' : 'text-brand-red bg-brand-red/10'
                  }`}>
                    {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {isPos ? '+' : ''}{chg.toFixed(2)}%
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2">
                  {comm.description}
                </p>
              </div>

              {/* Price Metrics */}
              <div className="space-y-2 pt-3 border-t border-white/5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Spot Market Price:</span>
                  <span className="text-lg font-black text-white">
                    {formatMoney(comm.current_price_usd)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>USD Benchmark:</span>
                  <span className="text-slate-300 font-semibold">{formatRawUSD(comm.current_price_usd)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>24h Traded Volume:</span>
                  <span className="text-brand-cyan font-semibold">{Number(comm.volume_24h).toLocaleString()} units</span>
                </div>
              </div>

              {/* Trade Button */}
              <button
                onClick={() => {
                  setSelectedTicker(comm.ticker);
                  if (onSelectCommodity) onSelectCommodity();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-dark-800 hover:bg-dark-750 border border-white/10 hover:border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
              >
                Trade {comm.ticker} Spot Contract <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
