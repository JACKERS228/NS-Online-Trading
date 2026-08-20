import React, { useState, useEffect } from 'react';
import { useMarket } from '../context/MarketContext';
import { 
  Newspaper, TrendingUp, TrendingDown, DollarSign, 
  Flame, ShieldAlert, Sparkles, Zap, ArrowRight, RefreshCw
} from 'lucide-react';

export default function NewsFeed({ onSelectAsset }) {
  const { breakingNews, setSelectedTicker } = useMarket();
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [allNews, setAllNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch('/api/market/news?limit=30');
        if (res.ok) {
          const data = await res.json();
          setAllNews(data.news || []);
        }
      } catch (err) {
        console.error('Error loading news:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNews();
  }, [breakingNews]);

  const combinedNews = [...breakingNews, ...allNews.filter(n => !breakingNews.some(b => b.id === n.id))];

  const filteredNews = combinedNews.filter(n => {
    if (filterCategory === 'ALL') return true;
    return (n.category || '').toUpperCase() === filterCategory;
  });

  const getCategoryBadge = (cat) => {
    switch (cat) {
      case 'EARNINGS': return { label: 'Earnings', color: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20' };
      case 'DIVIDEND': return { label: 'Dividend Payout', color: 'text-brand-green bg-brand-green/10 border-brand-green/20' };
      case 'COMMODITY': return { label: 'Commodity Shock', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
      case 'CRYPTO': return { label: 'Crypto Network', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
      case 'SCANDAL': return { label: 'Investigation', color: 'text-brand-red bg-brand-red/10 border-brand-red/20' };
      case 'POLICY': return { label: 'Sovereign Policy', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
      default: return { label: cat || 'Market', color: 'text-slate-300 bg-dark-800 border-white/10' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold flex items-center justify-center shadow-lg shadow-brand-gold/10">
            <Newspaper className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Sovereign Market News Wire & Dispatches
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Live automated corporate earnings, dividend distributions, supply bottlenecks, and macro telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2 text-xs font-semibold">
        {[
          { id: 'ALL', label: 'All Breaking Dispatches' },
          { id: 'EARNINGS', label: 'Earnings & IPOs' },
          { id: 'DIVIDEND', label: 'Dividends' },
          { id: 'COMMODITY', label: 'Commodity Shocks' },
          { id: 'CRYPTO', label: 'Crypto Telemetry' },
          { id: 'SCANDAL', label: 'Scandals' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`py-1.5 px-3.5 rounded-xl border transition cursor-pointer ${
              filterCategory === cat.id
                ? 'bg-dark-750 text-brand-cyan border-brand-cyan/40 font-bold shadow-sm'
                : 'bg-dark-900 text-slate-400 border-white/5 hover:text-white hover:bg-dark-850'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* News Feed List */}
      <div className="space-y-3">
        {filteredNews.length === 0 ? (
          <div className="p-12 rounded-2xl bg-dark-900 border border-white/10 text-center text-slate-500">
            <Newspaper className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm">No dispatches matching the selected category.</p>
          </div>
        ) : (
          filteredNews.map((item, idx) => {
            const badge = getCategoryBadge(item.category);
            const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Just now';
            const impact = item.impact_factor !== undefined ? Number(item.impact_factor) : 0;
            const isPos = impact >= 0;

            return (
              <div
                key={item.id || idx}
                className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl flex flex-col sm:flex-row items-start justify-between gap-4 transition hover:border-white/20"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${badge.color}`}>
                      {badge.label}
                    </span>
                    {item.ticker && (
                      <span className="font-mono text-xs font-bold text-white bg-dark-800 px-2 py-0.5 rounded border border-white/5">
                        {item.ticker}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">{timeStr}</span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                    {item.headline}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {item.detail}
                  </p>
                </div>

                {/* Impact / Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  {impact !== 0 && (
                    <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                      isPos ? 'text-brand-green bg-brand-green/10 border-brand-green/20' : 'text-brand-red bg-brand-red/10 border-brand-red/20'
                    }`}>
                      {isPos ? '+' : ''}{(impact * 100).toFixed(1)}% Est. Impact
                    </span>
                  )}

                  {item.ticker && (
                    <button
                      onClick={() => {
                        setSelectedTicker(item.ticker);
                        if (onSelectAsset) onSelectAsset();
                      }}
                      className="py-1.5 px-3 rounded-xl bg-dark-800 hover:bg-dark-750 text-brand-cyan text-xs font-bold border border-white/10 hover:border-brand-cyan/40 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      Trade {item.ticker} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
