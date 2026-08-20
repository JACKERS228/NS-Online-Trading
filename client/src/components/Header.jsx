import React, { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { 
  TrendingUp, Building2, Coins, Package, Briefcase, 
  Globe2, Newspaper, LogIn, LogOut, RotateCcw, 
  ChevronDown, DollarSign, Activity, Radio, Gavel
} from 'lucide-react';
import CurrencySettingsModal from './CurrencySettingsModal';

const TickerTapeItem = React.memo(function TickerTapeItem({ asset, flash, onSelect }) {
  const chg = asset.change_24h !== undefined ? Number(asset.change_24h) : 0;
  const isPos = chg >= 0;

  return (
    <button
      onClick={() => onSelect(asset.ticker)}
      className={`flex items-center gap-2 px-2.5 py-1 rounded-lg transition hover:bg-dark-800 cursor-pointer ${
        flash === 'up' ? 'bg-brand-green/20 text-brand-green' : flash === 'down' ? 'bg-brand-red/20 text-brand-red' : 'text-slate-300'
      }`}
    >
      <span className="font-bold text-white">{asset.ticker}</span>
      <span className="font-medium">${Number(asset.current_price_usd).toFixed(2)}</span>
      <span className={`text-[10px] font-semibold ${isPos ? 'text-brand-green' : 'text-brand-red'}`}>
        {isPos ? '+' : ''}{chg.toFixed(2)}%
      </span>
    </button>
  );
});

export default React.memo(function Header({ activeTab, setActiveTab }) {
  const { 
    nation, 
    useNationalCurrency, 
    setUseNationalCurrency, 
    setAuthModalOpen, 
    logout, 
    resetSandbox,
    formatMoney 
  } = useAuth();

  const { assets, priceFlashMap, setSelectedTicker } = useMarket();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleTickerSelect = useCallback((ticker) => {
    setSelectedTicker(ticker);
    setActiveTab('terminal');
  }, [setSelectedTicker, setActiveTab]);

  const handleReset = useCallback(async () => {
    try {
      await resetSandbox();
      setConfirmResetOpen(false);
      setSettingsOpen(false);
    } catch (err) {
      alert('Failed to reset account: ' + err.message);
    }
  }, [resetSandbox]);

  const tabs = [
    { id: 'terminal', label: 'Trade', icon: TrendingUp },
    { id: 'wizard', label: 'Companies', icon: Building2 },
    { id: 'crypto', label: 'Crypto', icon: Coins },
    { id: 'commodities', label: 'Commodities', icon: Package },
    { id: 'auctions', label: 'Auctions', icon: Gavel },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
    { id: 'forex', label: 'Nations', icon: Globe2 },
    { id: 'news', label: 'News', icon: Newspaper },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-dark-950/95 backdrop-blur-lg">
      
      {/* 1. Scrolling Market Ticker Tape */}
      <div className="w-full bg-dark-900/90 border-b border-white/5 py-1 px-3 overflow-x-auto no-scrollbar flex items-center gap-4 text-[11px] font-mono">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20 text-[10px] uppercase font-bold shrink-0">
          <Radio className="w-3 h-3 animate-pulse" /> Live
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {assets.map((asset) => (
            <TickerTapeItem
              key={asset.id}
              asset={asset}
              flash={priceFlashMap[asset.ticker]}
              onSelect={handleTickerSelect}
            />
          ))}
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan via-brand-green to-emerald-600 p-0.5 shadow-lg shadow-brand-green/10">
            <div className="w-full h-full bg-dark-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand-green" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">
                NS <span className="text-brand-cyan">TRADING</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Stock & Commodity Market
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-dark-900/80 p-1 rounded-xl border border-white/5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-dark-750 text-white shadow-sm border border-white/10 text-brand-cyan'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-dark-850'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-cyan' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Currency Toggle, Balance & Nation Profile */}
        <div className="flex items-center gap-3">
          
          {/* Dual Currency Toggle Button */}
          {nation && (
            <button
              onClick={() => setUseNationalCurrency(!useNationalCurrency)}
              title="Toggle Currency"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-900 border border-white/10 hover:border-brand-cyan/40 text-xs transition cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-brand-gold" />
              <div className="text-left font-mono">
                <span className="text-[10px] text-slate-400 block leading-none">Currency</span>
                <span className="font-bold text-brand-cyan text-[11px]">
                  {useNationalCurrency ? `${nation.currency_symbol} ${nation.currency_name}` : 'USD'}
                </span>
              </div>
            </button>
          )}

          {/* Cash Balance Display */}
          {nation ? (
            <div className="text-right font-mono px-3 py-1 rounded-xl bg-dark-900/80 border border-white/5">
              <span className="text-[10px] text-slate-400 block leading-tight">Cash</span>
              <span className="text-xs font-bold text-brand-green">
                {formatMoney(nation.cash_balance_usd)}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green to-emerald-600 hover:from-brand-green-dim text-dark-950 font-bold text-xs shadow-md transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}

          {/* Nation Profile Dropdown */}
          {nation && (
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl bg-dark-900 border border-white/10 hover:border-white/20 transition cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-dark-750 border border-white/10 flex items-center justify-center text-xs font-bold text-brand-cyan">
                  {nation.name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
              </button>

              {/* Dropdown Menu */}
              {settingsOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-dark-900 border border-white/10 shadow-2xl p-2 z-50 animate-fadeIn">
                  <div className="p-3 border-b border-white/5">
                    <div className="text-xs font-bold text-white truncate">{nation.name}</div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                      <span>Rate:</span>
                      <span className="font-mono text-brand-cyan">1 USD = {nation.usd_exchange_rate} {nation.currency_symbol}</span>
                    </div>
                  </div>

                  <div className="py-1 space-y-1">
                    <button
                      onClick={() => {
                        setCurrencyModalOpen(true);
                        setSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs text-left text-slate-300 hover:bg-dark-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <Coins className="w-4 h-4 text-brand-gold" /> Currency Settings
                    </button>

                    <button
                      onClick={() => {
                        setConfirmResetOpen(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs text-left text-amber-400 hover:bg-dark-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-400" /> Reset to $100k
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setSettingsOpen(false);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-xs text-left text-brand-red hover:bg-dark-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-brand-red" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden border-t border-white/5 bg-dark-950/90 px-2 py-1 overflow-x-auto flex gap-1 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                isActive
                  ? 'bg-dark-800 text-brand-cyan border border-white/10'
                  : 'text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Currency Settings Modal */}
      <CurrencySettingsModal
        isOpen={currencyModalOpen}
        onClose={() => setCurrencyModalOpen(false)}
      />

      {/* Confirm Sandbox Reset Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-dark-900 border border-amber-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Reset Account?</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This resets your cash balance to <strong>$100,000 USD</strong> and clears your positions.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmResetOpen(false)}
                className="flex-1 py-2 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold hover:bg-dark-750 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});
