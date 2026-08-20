import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  Briefcase, TrendingUp, TrendingDown, DollarSign, 
  Coins, Package, Building2, RotateCcw, ArrowUpRight, 
  ArrowDownRight, RefreshCw, Layers, History, ShieldAlert
} from 'lucide-react';

export default function PortfolioView({ onSelectAsset }) {
  const { nation, formatMoney, formatRawUSD, resetSandbox, refreshProfile, setAuthModalOpen } = useAuth();
  const { setSelectedTicker } = useMarket();

  const [portfolioData, setPortfolioData] = useState(null);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('holdings'); // 'holdings' | 'history'
  const [loading, setLoading] = useState(true);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  useEffect(() => {
    if (!nation) {
      setLoading(false);
      return;
    }

    async function loadPortfolio() {
      try {
        const token = localStorage.getItem('ns_trading_token');
        if (!token) return;

        const [pRes, hRes] = await Promise.all([
          fetch('/api/trade/portfolio', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/trade/history', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (pRes.ok) {
          const pData = await pRes.json();
          setPortfolioData(pData);
        }
        if (hRes.ok) {
          const hData = await hRes.json();
          setTradeHistory(hData.orders || []);
        }
      } catch (err) {
        console.error('Error loading portfolio:', err);
      } finally {
        setLoading(false);
      }
    }

    loadPortfolio();
    const interval = setInterval(loadPortfolio, 5000); // Live sync

    return () => clearInterval(interval);
  }, [nation]);

  if (!nation) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mx-auto border border-brand-cyan/20">
          <Briefcase className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Sign In to View Portfolio</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Sign in or register your sovereign nation profile to track your holdings, profit/loss metrics, and dividend earnings.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="py-2.5 px-6 rounded-xl bg-brand-green hover:bg-brand-green-dim text-dark-950 font-bold text-sm transition cursor-pointer shadow-lg shadow-brand-green/20"
        >
          Sign In Nation Profile
        </button>
      </div>
    );
  }

  const holdings = portfolioData?.holdings || [];
  const isAllTimePos = (portfolioData?.total_all_time_pnl_usd || 0) >= 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Portfolio Top Metrics Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl space-y-6">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-green/10 border border-brand-green/20 text-brand-green flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{nation.name} Sovereign Portfolio</h1>
              <p className="text-xs text-slate-400">
                Active Currency: <strong className="text-brand-cyan">{nation.currency_name} ({nation.currency_symbol})</strong> • 1 USD = {nation.usd_exchange_rate}
              </p>
            </div>
          </div>

          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-amber-400 text-xs font-semibold border border-white/5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Sandbox ($100k)
          </button>
        </div>

        {/* 4 Financial KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          
          <div className="p-4 rounded-xl bg-dark-950/70 border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase">Total Net Worth</span>
            <div className="text-2xl font-black text-white">
              {formatMoney(portfolioData?.net_worth_usd || nation.cash_balance_usd)}
            </div>
            <div className="text-[11px] text-slate-500">
              USD: {formatRawUSD(portfolioData?.net_worth_usd || nation.cash_balance_usd)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-950/70 border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase">Cash Capital</span>
            <div className="text-2xl font-black text-brand-green">
              {formatMoney(nation.cash_balance_usd)}
            </div>
            <div className="text-[11px] text-slate-500">
              Available to deploy
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-950/70 border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase">Active Holdings Value</span>
            <div className="text-2xl font-black text-brand-cyan">
              {formatMoney(portfolioData?.portfolio_value_usd || 0)}
            </div>
            <div className="text-[11px] text-slate-500">
              {holdings.length} Position(s)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-950/70 border border-white/5 space-y-1">
            <span className="text-[11px] text-slate-400 block uppercase">Total All-Time P&L</span>
            <div className={`text-2xl font-black flex items-center gap-1 ${
              isAllTimePos ? 'text-brand-green' : 'text-brand-red'
            }`}>
              {isAllTimePos ? '+' : ''}{formatMoney(portfolioData?.total_all_time_pnl_usd || 0)}
            </div>
            <div className={`text-[11px] font-bold ${isAllTimePos ? 'text-brand-green' : 'text-brand-red'}`}>
              {isAllTimePos ? '+' : ''}{portfolioData?.total_all_time_pnl_percent || 0}% Return
            </div>
          </div>

        </div>

      </div>

      {/* Tabs: Open Holdings vs Trade History */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveSubTab('holdings')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition ${
            activeSubTab === 'holdings'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Open Asset Positions ({holdings.length})
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition ${
            activeSubTab === 'history'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Order Execution History ({tradeHistory.length})
        </button>
      </div>

      {/* Holdings Table */}
      {activeSubTab === 'holdings' && (
        <div className="rounded-2xl bg-dark-900 border border-white/10 shadow-xl overflow-hidden">
          {holdings.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Layers className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">No open positions yet. Visit the Trading Desk or Company Wizard to begin trading!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-dark-950/60 text-slate-400 text-[11px]">
                    <th className="p-3.5">Asset</th>
                    <th className="p-3.5">Quantity</th>
                    <th className="p-3.5">Avg Buy Price</th>
                    <th className="p-3.5">Current Price</th>
                    <th className="p-3.5">Market Value</th>
                    <th className="p-3.5">Unrealized P&L</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {holdings.map((h) => {
                    const isPos = h.unrealized_pnl_usd >= 0;
                    return (
                      <tr key={h.portfolio_id} className="hover:bg-dark-850/50 transition">
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{h.ticker}</span>
                            <span className="text-slate-400 text-[10px] truncate max-w-[120px]">{h.asset_name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-200 font-semibold">{Number(h.quantity).toLocaleString()}</td>
                        <td className="p-3.5 text-slate-400">{formatMoney(h.average_buy_price_usd)}</td>
                        <td className="p-3.5 text-white font-bold">{formatMoney(h.current_price_usd)}</td>
                        <td className="p-3.5 text-slate-200 font-bold">{formatMoney(h.market_value_usd)}</td>
                        <td className={`p-3.5 font-bold ${isPos ? 'text-brand-green' : 'text-brand-red'}`}>
                          {isPos ? '+' : ''}{formatMoney(h.unrealized_pnl_usd)} ({isPos ? '+' : ''}{h.unrealized_pnl_percent}%)
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedTicker(h.ticker);
                              if (onSelectAsset) onSelectAsset();
                            }}
                            className="py-1 px-3 rounded-lg bg-dark-800 hover:bg-dark-750 text-brand-cyan border border-white/10 hover:border-brand-cyan/40 text-[11px] font-bold transition cursor-pointer"
                          >
                            Trade
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Trade Execution History */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl bg-dark-900 border border-white/10 shadow-xl overflow-hidden">
          {tradeHistory.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <History className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">No transaction history recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-dark-950/60 text-slate-400 text-[11px]">
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5">Side</th>
                    <th className="p-3.5">Asset</th>
                    <th className="p-3.5">Quantity</th>
                    <th className="p-3.5">Execution Price</th>
                    <th className="p-3.5">Total Value</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tradeHistory.map((o) => {
                    const isBuy = o.side === 'BUY';
                    const dateStr = new Date(o.timestamp).toLocaleTimeString();
                    return (
                      <tr key={o.id} className="hover:bg-dark-850/50">
                        <td className="p-3.5 text-slate-500">{dateStr}</td>
                        <td className={`p-3.5 font-bold ${isBuy ? 'text-brand-green' : 'text-brand-red'}`}>{o.side}</td>
                        <td className="p-3.5 font-bold text-white">{o.ticker}</td>
                        <td className="p-3.5 text-slate-300">{Number(o.quantity).toLocaleString()}</td>
                        <td className="p-3.5 text-slate-300">{formatMoney(o.execution_price_usd)}</td>
                        <td className="p-3.5 text-slate-200 font-bold">{formatMoney(o.total_usd)}</td>
                        <td className="p-3.5 text-brand-green font-semibold">{o.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-dark-900 border border-amber-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Reset Sandbox Capital?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will reset your cash capital to <strong>$100,000 USD</strong> and clear your open positions.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold hover:bg-dark-750"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await resetSandbox();
                  setResetModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
