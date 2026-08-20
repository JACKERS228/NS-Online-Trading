import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MarketProvider } from './context/MarketContext';
import Header from './components/Header';
import TradingTerminal from './components/TradingTerminal';
import CompanyWizard from './components/CompanyWizard';
import CryptoLaunchpad from './components/CryptoLaunchpad';
import CommoditiesMarket from './components/CommoditiesMarket';
import PortfolioView from './components/PortfolioView';
import ForexAndNations from './components/ForexAndNations';
import NewsFeed from './components/NewsFeed';
import AuthModal from './components/AuthModal';

function MainApp() {
  const [activeTab, setActiveTab] = useState('terminal');
  const { authModalOpen, setAuthModalOpen } = useAuth();

  return (
    <div className="min-h-screen bg-dark-950 text-slate-200 flex flex-col selection:bg-brand-cyan/30 selection:text-white">
      
      {/* Top Header & Ticker Tape */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Content */}
      <main className="flex-1 pb-16">
        {activeTab === 'terminal' && <TradingTerminal />}
        {activeTab === 'wizard' && <CompanyWizard onCompanyCreated={() => setActiveTab('terminal')} />}
        {activeTab === 'crypto' && <CryptoLaunchpad onTokenCreated={() => setActiveTab('terminal')} />}
        {activeTab === 'commodities' && <CommoditiesMarket onSelectCommodity={() => setActiveTab('terminal')} />}
        {activeTab === 'portfolio' && <PortfolioView onSelectAsset={() => setActiveTab('terminal')} />}
        {activeTab === 'forex' && <ForexAndNations />}
        {activeTab === 'news' && <NewsFeed onSelectAsset={() => setActiveTab('terminal')} />}
      </main>

      {/* Footer Disclaimer */}
      <footer className="border-t border-white/5 bg-dark-900/60 py-6 px-4 text-center text-xs text-slate-500 font-mono space-y-2">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>🏛️ NationStates Online Trading Simulation Desk</span>
          <span className="text-amber-400/80">⚠️ Fan-made simulation. Do NOT use official NationStates passwords or PINs.</span>
          <span className="text-brand-green">● Simulation Engine Online</span>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MarketProvider>
        <MainApp />
      </MarketProvider>
    </AuthProvider>
  );
}
