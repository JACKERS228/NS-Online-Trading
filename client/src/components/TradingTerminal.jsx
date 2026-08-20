import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  TrendingUp, TrendingDown, Search, ArrowUpRight, ArrowDownRight, 
  DollarSign, Shield, Zap, Sparkles, Building, Coins, Package, 
  CheckCircle2, AlertCircle, RefreshCw, Layers, Sliders
} from 'lucide-react';
import TradingChart from './TradingChart';

export default function TradingTerminal() {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();
  const { assets, selectedTicker, setSelectedTicker, selectedAsset, recentTrades, priceFlashMap } = useMarket();

  // Filter & Search State
  const [filterType, setFilterType] = useState('all'); // 'all', 'stock', 'commodity', 'crypto'
  const [searchQuery, setSearchQuery] = useState('');

  // Order Entry State
  const [orderSide, setOrderSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [quantity, setQuantity] = useState('');
  const [executing, setExecuting] = useState(false);
  const [tradeMessage, setTradeMessage] = useState(null);
  const [userHolding, setUserHolding] = useState(null);

  // Fetch user's current holding for the selected asset
  useEffect(() => {
    if (!nation || !selectedAsset) {
      setUserHolding(null);
      return;
    }

    async function fetchHolding() {
      try {
        const token = localStorage.getItem('ns_trading_token');
        if (!token) return;
        const res = await fetch('/api/trade/portfolio', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const found = (data.holdings || []).find(h => h.asset_id === selectedAsset.id);
          setUserHolding(found || null);
        }
      } catch (err) {
        console.error('Error fetching holding:', err);
      }
    }

    fetchHolding();
  }, [nation, selectedAsset]);

  // Filtered Assets list
  const filteredAssets = assets.filter(a => {
    const matchesType = filterType === 'all' || a.type === filterType;
    const matchesSearch = a.ticker.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (a.sector && a.sector.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  // Calculate Order Cost
  const assetPrice = selectedAsset?.current_price_usd || 0;
  const numQty = Math.max(0, Number(quantity) || 0);
  const totalCostUsd = +(assetPrice * numQty).toFixed(2);

  // Quick percentage allocation
  const handlePercentageSelect = (pct) => {
    if (!selectedAsset) return;
    if (orderSide === 'BUY') {
      if (!nation) return;
      const maxSpendable = nation.cash_balance_usd * pct;
      const maxShares = Math.floor(maxSpendable / selectedAsset.current_price_usd);
      setQuantity(maxShares > 0 ? String(maxShares) : '1');
    } else {
      if (!userHolding || userHolding.quantity <= 0) return;
      const sharesToSell = Math.floor(userHolding.quantity * pct);
      setQuantity(sharesToSell > 0 ? String(sharesToSell) : '1');
    }
  };

  // Execute Order
  const handleExecuteOrder = async (e) => {
    e.preventDefault();
    if (!nation) {
      setAuthModalOpen(true);
      return;
    }
    if (!selectedAsset || numQty <= 0) return;

    setExecuting(true);
    setTradeMessage(null);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          side: orderSide,
          quantity: numQty
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Trade execution failed');
      }

      setTradeMessage({ type: 'success', text: data.message });
      setQuantity('');
      await refreshProfile();
      
      // Update holding state
      if (data.position) {
        setUserHolding(prev => ({
          ...prev,
          quantity: data.position.quantity,
          average_buy_price_usd: data.position.average_buy_price_usd
        }));
      }
    } catch (err) {
      setTradeMessage({ type: 'error', text: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const getSectorBadge = (sector, type) => {
    if (type === 'commodity') return { label: 'Commodity', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
    if (type === 'crypto') return { label: 'Crypto', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
    return { label: sector || 'Stock', color: 'text-brand-cyan bg-brand-cyan/10 border-brand-cyan/20' };
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4">
      
      {/* 3-Column Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* 1. LEFT: Asset Screener & Watchlist (3 cols) */}
        <div className="lg:col-span-3 flex flex-col h-[700px] rounded-2xl bg-dark-900 border border-white/10 overflow-hidden shadow-xl">
          
          {/* Watchlist Header */}
          <div className="p-3 border-b border-white/5 space-y-2 bg-dark-950/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Market Screener</span>
              <span className="text-[10px] font-mono text-slate-400">{filteredAssets.length} Assets</span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticker, name, sector..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-dark-850 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-cyan"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold">
              {[
                { id: 'all', label: 'All' },
                { id: 'stock', label: 'Stocks' },
                { id: 'commodity', label: 'Commodity' },
                { id: 'crypto', label: 'Crypto' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id)}
                  className={`py-1 rounded text-center transition ${
                    filterType === t.id 
                      ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 font-bold' 
                      : 'bg-dark-850 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredAssets.map(asset => {
              const isSelected = selectedTicker.toUpperCase() === asset.ticker.toUpperCase();
              const chg = asset.change_24h !== undefined ? Number(asset.change_24h) : 0;
              const isPos = chg >= 0;
              const flash = priceFlashMap[asset.ticker];

              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedTicker(asset.ticker)}
                  className={`w-full p-3 text-left flex items-center justify-between transition cursor-pointer ${
                    isSelected 
                      ? 'bg-dark-800 border-l-4 border-l-brand-cyan' 
                      : 'hover:bg-dark-850/60'
                  } ${
                    flash === 'up' ? 'bg-brand-green/15' : flash === 'down' ? 'bg-brand-red/15' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white text-xs font-mono">{asset.ticker}</span>
                      <span className={`text-[9px] px-1 py-0.2 rounded border ${
                        asset.type === 'crypto' ? 'border-purple-500/30 text-purple-400' :
                        asset.type === 'commodity' ? 'border-amber-500/30 text-amber-400' :
                        'border-blue-500/30 text-blue-400'
                      }`}>
                        {asset.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                      {asset.name}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-white">
                      {formatMoney(asset.current_price_usd, { showSymbol: true })}
                    </div>
                    <div className={`text-[10px] font-semibold flex items-center justify-end gap-0.5 ${
                      isPos ? 'text-brand-green' : 'text-brand-red'
                    }`}>
                      {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {isPos ? '+' : ''}{chg.toFixed(2)}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. CENTER: Asset Header, Chart & Recent Trade Feed (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          {/* Active Asset Overview Card */}
          {selectedAsset && (
            <div className="p-4 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dark-800 border border-white/10 flex items-center justify-center font-bold text-base text-brand-cyan font-mono">
                    {selectedAsset.ticker.substring(0, 3)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedAsset.name}</h2>
                      <span className="font-mono text-xs text-slate-400">({selectedAsset.ticker})</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>{selectedAsset.sector}</span>
                      <span>•</span>
                      <span className="text-brand-cyan">{selectedAsset.nation_name || 'Global Market'}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Price Metric */}
                <div className="text-right font-mono">
                  <div className="text-2xl font-black text-white">
                    {formatMoney(selectedAsset.current_price_usd)}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-end gap-1.5">
                    <span>USD: <strong className="text-slate-300">{formatRawUSD(selectedAsset.current_price_usd)}</strong></span>
                    <span className={`font-bold px-1.5 py-0.2 rounded text-[11px] ${
                      (selectedAsset.change_24h || 0) >= 0 ? 'text-brand-green bg-brand-green/10' : 'text-brand-red bg-brand-red/10'
                    }`}>
                      {(selectedAsset.change_24h || 0) >= 0 ? '+' : ''}{Number(selectedAsset.change_24h || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Asset Key Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                <div className="p-2 rounded-lg bg-dark-850/60">
                  <span className="text-[10px] text-slate-400 block">24h Range</span>
                  <span className="font-semibold text-slate-200">
                    ${Number(selectedAsset.low_24h_usd).toFixed(2)} - ${Number(selectedAsset.high_24h_usd).toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-dark-850/60">
                  <span className="text-[10px] text-slate-400 block">24h Volume</span>
                  <span className="font-semibold text-brand-cyan">
                    {Number(selectedAsset.volume_24h).toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-dark-850/60">
                  <span className="text-[10px] text-slate-400 block">Market Cap</span>
                  <span className="font-semibold text-slate-200">
                    {selectedAsset.market_cap_usd > 0 ? formatMoney(selectedAsset.market_cap_usd, { compact: true }) : 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-dark-850/60">
                  <span className="text-[10px] text-slate-400 block">Dividend / Yield</span>
                  <span className="font-semibold text-brand-green">
                    {selectedAsset.dividend_yield > 0 ? `${(selectedAsset.dividend_yield * 100).toFixed(1)}% APY` : 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Financial Chart */}
          <div className="h-[360px]">
            <TradingChart asset={selectedAsset} />
          </div>

          {/* Live Order Flow & Recent Trades Stream */}
          <div className="p-3 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-gold animate-pulse" /> Live Market Order Flow
              </span>
              <span className="text-[10px] font-mono text-slate-500">Autonomous NPC & Player Flow</span>
            </div>

            <div className="overflow-x-auto max-h-[140px] overflow-y-auto no-scrollbar">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-[10px] text-slate-500 border-b border-white/5">
                    <th className="pb-1">Ticker</th>
                    <th className="pb-1">Side</th>
                    <th className="pb-1">Price (USD)</th>
                    <th className="pb-1">Quantity</th>
                    <th className="pb-1">Trader</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTrades.slice(0, 8).map((t, idx) => {
                    const isBuy = t.side === 'BUY';
                    return (
                      <tr key={t.id || idx} className="hover:bg-dark-850/50">
                        <td className="py-1 font-bold text-white">{t.ticker}</td>
                        <td className={`py-1 font-bold ${isBuy ? 'text-brand-green' : 'text-brand-red'}`}>{t.side}</td>
                        <td className="py-1 text-slate-200">${Number(t.price_usd).toFixed(2)}</td>
                        <td className="py-1 text-slate-300">{Number(t.quantity).toLocaleString()}</td>
                        <td className="py-1 text-[10px] text-slate-400 truncate max-w-[120px]">{t.trader}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. RIGHT: Order Execution Terminal (3 cols) */}
        <div className="lg:col-span-3 flex flex-col rounded-2xl bg-dark-900 border border-white/10 p-4 shadow-xl space-y-4">
          
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Order Entry Desk</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-mono">
              Market Order
            </span>
          </div>

          {/* Buy / Sell Tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-dark-850 p-1 border border-white/5">
            <button
              onClick={() => setOrderSide('BUY')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                orderSide === 'BUY'
                  ? 'bg-brand-green text-dark-950 shadow-lg shadow-brand-green/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Buy
            </button>
            <button
              onClick={() => setOrderSide('SELL')}
              className={`py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                orderSide === 'SELL'
                  ? 'bg-brand-red text-white shadow-lg shadow-brand-red/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" /> Sell
            </button>
          </div>

          {/* User Available Capital / Position Indicator */}
          <div className="p-3 rounded-xl bg-dark-850/70 border border-white/5 space-y-1.5 text-xs">
            {nation ? (
              <>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Available Cash:</span>
                  <span className="font-bold text-white font-mono">{formatMoney(nation.cash_balance_usd)}</span>
                </div>
                {userHolding && (
                  <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/5">
                    <span>Your Holding ({selectedAsset?.ticker}):</span>
                    <span className="font-bold text-brand-cyan font-mono">
                      {userHolding.quantity.toLocaleString()} units
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-slate-400 py-1">
                <span className="text-brand-gold font-medium">Guest Mode:</span> Sign in to execute live orders
              </div>
            )}
          </div>

          {/* Order Input Form */}
          <form onSubmit={handleExecuteOrder} className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                <label className="font-medium">Quantity (Units / Shares)</label>
                {selectedAsset && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    @ {formatMoney(selectedAsset.current_price_usd)}
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-brand-cyan"
              />
            </div>

            {/* Quick Percentage Allocation Buttons */}
            <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
              {[
                { label: '25%', val: 0.25 },
                { label: '50%', val: 0.50 },
                { label: '75%', val: 0.75 },
                { label: 'Max', val: 1.00 },
              ].map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePercentageSelect(p.val)}
                  className="py-1 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white border border-white/5 transition"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Order Preview Box */}
            <div className="p-3.5 rounded-xl bg-dark-950/80 border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Estimated Value:</span>
                <span className="font-bold text-white">
                  {formatMoney(totalCostUsd)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>USD Equivalent:</span>
                <span className="text-slate-300 font-semibold">{formatRawUSD(totalCostUsd)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Execution Fee:</span>
                <span className="text-brand-green font-semibold">$0.00 (Zero Fee)</span>
              </div>
            </div>

            {tradeMessage && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                tradeMessage.type === 'success'
                  ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                  : 'bg-brand-red/10 border-brand-red/30 text-brand-red'
              }`}>
                {tradeMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                <span className="leading-snug">{tradeMessage.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={executing || numQty <= 0}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50 ${
                orderSide === 'BUY'
                  ? 'bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dim text-dark-950 shadow-brand-green/20'
                  : 'bg-gradient-to-r from-brand-red to-rose-700 hover:from-brand-red-dim text-white shadow-brand-red/20'
              }`}
            >
              {executing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Executing On-Exchange...</>
              ) : nation ? (
                `${orderSide} ${numQty > 0 ? numQty.toLocaleString() : ''} ${selectedAsset?.ticker || ''}`
              ) : (
                'Sign In Nation to Execute'
              )}
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
