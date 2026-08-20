import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import TradingChart from './TradingChart';
import { 
  TrendingUp, TrendingDown, DollarSign, ArrowUpRight, 
  ArrowDownRight, Search, Activity, ShieldCheck, 
  Layers, ChevronRight, Zap
} from 'lucide-react';

// Memoized Asset List Item in Screener
const AssetListItem = React.memo(function AssetListItem({ asset, isSelected, flash, onSelect, formatMoney }) {
  const isUp = (Number(asset.change_24h) || 0) >= 0;

  return (
    <button
      onClick={() => onSelect(asset.ticker)}
      className={`w-full p-3 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
        isSelected
          ? 'bg-dark-800 border-brand-cyan/40 shadow-lg'
          : 'bg-dark-900/60 border-white/5 hover:border-white/15 hover:bg-dark-850'
      } ${
        flash === 'up' ? 'animate-pulse bg-brand-green/10' : flash === 'down' ? 'animate-pulse bg-brand-red/10' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
          asset.type === 'crypto' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
          asset.type === 'commodity' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
          'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20'
        }`}>
          {asset.ticker.slice(0, 3)}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white text-xs font-mono">{asset.ticker}</span>
            <span className="text-[10px] text-slate-400 font-sans truncate max-w-[90px]">{asset.name}</span>
          </div>
          <div className="text-[10px] text-slate-500 uppercase font-mono">
            {asset.type} • {asset.sector || 'Sovereign Asset'}
          </div>
        </div>
      </div>

      <div className="text-right font-mono">
        <div className="text-xs font-bold text-white">
          {formatMoney(asset.current_price_usd)}
        </div>
        <div className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${
          isUp ? 'text-brand-green' : 'text-brand-red'
        }`}>
          {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isUp ? '+' : ''}{(Number(asset.change_24h) || 0).toFixed(2)}%
        </div>
      </div>
    </button>
  );
});

// Memoized Live Order Flow Row
const LiveTradeRow = React.memo(function LiveTradeRow({ trade, formatMoney }) {
  const isBuy = trade.side === 'BUY';
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-dark-950/40 border border-white/5 font-mono text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
          isBuy ? 'bg-brand-green/20 text-brand-green' : 'bg-brand-red/20 text-brand-red'
        }`}>
          {trade.side}
        </span>
        <span className="font-bold text-white">{trade.ticker}</span>
        <span className="text-slate-400 text-[10px] truncate max-w-[80px]">{trade.trader}</span>
      </div>
      <div className="text-right">
        <span className="text-slate-200 font-bold">{trade.quantity.toLocaleString()}</span>
        <span className="text-slate-400 text-[10px] ml-1">@ {formatMoney(trade.price_usd)}</span>
      </div>
    </div>
  );
});

// Isolated Order Execution Desk
const OrderDesk = React.memo(function OrderDesk({
  asset,
  nation,
  formatMoney,
  formatRawUSD,
  onOrderSuccess,
  onRequireAuth
}) {
  const [side, setSide] = useState('BUY');
  const [quantity, setQuantity] = useState(10);
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch holding for active asset
  const fetchHolding = useCallback(async () => {
    const token = localStorage.getItem('ns_trading_token');
    if (!token || !asset) return;

    try {
      const res = await fetch('/api/trade/portfolio', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const found = (data.holdings || []).find(h => h.asset_id === asset.id);
        setHolding(found || null);
      }
    } catch (err) {
      console.error('Error fetching holding:', err);
    }
  }, [asset]);

  useEffect(() => {
    fetchHolding();
  }, [fetchHolding]);

  const priceUsd = Number(asset?.current_price_usd) || 0;
  const numQty = Math.max(1, Number(quantity) || 1);
  const totalUsd = priceUsd * numQty;
  const maxBuyShares = nation ? Math.floor(Number(nation.cash_balance_usd) / (priceUsd || 1)) : 0;
  const maxSellShares = holding ? Number(holding.quantity) : 0;

  const handleOrder = async (e) => {
    e.preventDefault();
    if (!nation) {
      onRequireAuth();
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ticker: asset.ticker,
          side,
          quantity: numQty
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Trade execution rejected');
      }

      setSuccess(data.message);
      await fetchHolding();
      onOrderSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return null;

  return (
    <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-cyan" /> Order Entry Desk
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-mono font-bold">
          Market Order
        </span>
      </div>

      {/* Buy / Sell Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs font-bold">
        <button
          type="button"
          onClick={() => { setSide('BUY'); setError(''); setSuccess(''); }}
          className={`py-2 rounded-lg transition cursor-pointer ${
            side === 'BUY' ? 'bg-brand-green text-dark-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          BUY {asset.ticker}
        </button>
        <button
          type="button"
          onClick={() => { setSide('SELL'); setError(''); setSuccess(''); }}
          className={`py-2 rounded-lg transition cursor-pointer ${
            side === 'SELL' ? 'bg-brand-red text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          SELL {asset.ticker}
        </button>
      </div>

      <form onSubmit={handleOrder} className="space-y-4">
        {/* Quantity Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Order Quantity</span>
            <span className="font-mono text-[11px]">
              {side === 'BUY' ? (
                <>Max Buy: <strong className="text-brand-green">{maxBuyShares.toLocaleString()}</strong></>
              ) : (
                <>Available: <strong className="text-amber-400">{maxSellShares.toLocaleString()}</strong></>
              )}
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              min="1"
              max={side === 'SELL' ? maxSellShares : undefined}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-base font-bold focus:outline-none focus:border-brand-cyan"
            />
            <button
              type="button"
              onClick={() => setQuantity(side === 'BUY' ? Math.max(1, maxBuyShares) : Math.max(1, maxSellShares))}
              className="absolute right-2.5 top-2.5 px-2 py-1 rounded bg-dark-750 text-[10px] font-mono text-brand-cyan font-bold hover:bg-dark-700"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Preset Quantity Buttons */}
        <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
          {[10, 50, 100, 500].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuantity(q)}
              className="py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-white/5 text-slate-300 font-semibold"
            >
              +{q}
            </button>
          ))}
        </div>

        {/* Order Cost Breakdown */}
        <div className="p-3.5 rounded-xl bg-dark-950/60 border border-white/5 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Spot Execution Price:</span>
            <span className="text-white font-bold">{formatMoney(priceUsd)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Estimated Total Value:</span>
            <span className={`text-base font-extrabold ${side === 'BUY' ? 'text-brand-green' : 'text-brand-red'}`}>
              {formatMoney(totalUsd)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-white/5">
            <span>USD Benchmark:</span>
            <span className="text-slate-400">{formatRawUSD(totalUsd)}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-brand-green/10 border border-brand-green/30 text-brand-green text-xs">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || numQty <= 0 || (side === 'SELL' && maxSellShares <= 0)}
          className={`w-full py-3.5 rounded-xl font-extrabold text-sm shadow-xl transition cursor-pointer disabled:opacity-40 ${
            side === 'BUY'
              ? 'bg-brand-green hover:bg-emerald-400 text-dark-950 shadow-brand-green/20'
              : 'bg-brand-red hover:bg-rose-500 text-white shadow-brand-red/20'
          }`}
        >
          {loading ? (
            'Executing Order on Engine...'
          ) : nation ? (
            `${side} ${numQty.toLocaleString()} ${asset.ticker}`
          ) : (
            'Sign In Nation to Trade'
          )}
        </button>
      </form>
    </div>
  );
});

export default React.memo(function TradingTerminal() {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();
  const { assets, selectedTicker, setSelectedTicker, selectedAsset, recentTrades, priceFlashMap } = useMarket();

  // Search & Filter state with deferred value to prevent INP typing lag
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const deferredSearch = useDeferredValue(searchQuery);
  const deferredFilter = useDeferredValue(filterType);

  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const matchesSearch = deferredSearch === '' ||
        a.ticker.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        a.name.toLowerCase().includes(deferredSearch.toLowerCase());
      
      const matchesType = deferredFilter === 'ALL' || a.type.toUpperCase() === deferredFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, deferredSearch, deferredFilter]);

  const handleOrderSuccess = useCallback(() => {
    refreshProfile();
  }, [refreshProfile]);

  const handleRequireAuth = useCallback(() => {
    setAuthModalOpen(true);
  }, [setAuthModalOpen]);

  const isUp = (Number(selectedAsset?.change_24h) || 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* 3-Column Financial Terminal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Asset Screener (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          
          <div className="p-4 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-3">
            
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Activity className="w-4 h-4 text-brand-cyan" /> Market Screener
              </h2>
              <span className="text-[10px] font-mono text-slate-400">{filteredAssets.length} Assets</span>
            </div>

            {/* Instant Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search ticker or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-dark-850 border border-white/5 text-xs text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] font-mono">
              {['ALL', 'STOCK', 'COMMODITY', 'CRYPTO'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer ${
                    filterType === type ? 'bg-brand-cyan text-dark-950 font-bold' : 'bg-dark-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Virtualized/Scrollable Screener Asset List */}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredAssets.map((asset) => (
                <AssetListItem
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.ticker === asset.ticker}
                  flash={priceFlashMap[asset.ticker]}
                  onSelect={setSelectedTicker}
                  formatMoney={formatMoney}
                />
              ))}
            </div>

          </div>

        </div>

        {/* Middle Column: Interactive Chart & Telemetry (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Asset Hero Banner */}
          {selectedAsset && (
            <div className="p-5 rounded-2xl bg-dark-900 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-dark-850 border border-white/10 flex items-center justify-center font-mono font-black text-lg text-brand-cyan">
                  {selectedAsset.ticker}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-extrabold text-white">{selectedAsset.name}</h1>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-dark-800 text-slate-300 font-mono uppercase">
                      {selectedAsset.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Sector: <span className="text-slate-300">{selectedAsset.sector || 'Sovereign Asset'}</span> • Health: <span className="text-brand-green">{selectedAsset.health_score || 85}/100</span>
                  </p>
                </div>
              </div>

              {/* Price & 24h Change */}
              <div className="text-right font-mono">
                <div className="text-2xl font-black text-white">
                  {formatMoney(selectedAsset.current_price_usd)}
                </div>
                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${
                  isUp ? 'text-brand-green' : 'text-brand-red'
                }`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {isUp ? '+' : ''}{(Number(selectedAsset.change_24h) || 0).toFixed(2)}% (24h)
                </div>
              </div>
            </div>
          )}

          {/* Interactive Chart Component */}
          <div className="min-h-[400px]">
            <TradingChart asset={selectedAsset} />
          </div>

          {/* Asset Telemetry Stats Grid */}
          {selectedAsset && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-dark-900 border border-white/10 font-mono text-xs">
              <div className="p-3 rounded-xl bg-dark-950/60">
                <span className="text-slate-500 block text-[10px] uppercase">Market Cap</span>
                <span className="text-sm font-bold text-white">{formatMoney(selectedAsset.market_cap_usd, { compact: true })}</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-950/60">
                <span className="text-slate-500 block text-[10px] uppercase">24h High</span>
                <span className="text-sm font-bold text-brand-green">{formatMoney(selectedAsset.high_24h_usd)}</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-950/60">
                <span className="text-slate-500 block text-[10px] uppercase">24h Low</span>
                <span className="text-sm font-bold text-brand-red">{formatMoney(selectedAsset.low_24h_usd)}</span>
              </div>
              <div className="p-3 rounded-xl bg-dark-950/60">
                <span className="text-slate-500 block text-[10px] uppercase">24h Volume</span>
                <span className="text-sm font-bold text-brand-cyan">{Number(selectedAsset.volume_24h || 0).toLocaleString()}</span>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Order Entry & Live Trade Feed (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Isolated Order Desk */}
          <OrderDesk
            asset={selectedAsset}
            nation={nation}
            formatMoney={formatMoney}
            formatRawUSD={formatRawUSD}
            onOrderSuccess={handleOrderSuccess}
            onRequireAuth={handleRequireAuth}
          />

          {/* Live Executed Orders Flow */}
          <div className="p-4 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Activity className="w-3.5 h-3.5 text-brand-green" /> Live Order Stream
              </h3>
              <span className="text-[10px] font-mono text-brand-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-ping" /> Real-time
              </span>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {recentTrades.slice(0, 10).map((trade, i) => (
                <LiveTradeRow
                  key={trade.id || i}
                  trade={trade}
                  formatMoney={formatMoney}
                />
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
});
