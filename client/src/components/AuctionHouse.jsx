import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Gavel, PlusCircle, Shield, Image as ImageIcon, 
  Clock, DollarSign, Sparkles, CheckCircle2, 
  ArrowRight, Search, ShieldCheck, Gem, Landmark, 
  Cpu, Award, ExternalLink, RefreshCw, AlertCircle, 
  Layers, ChevronRight, Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';

const CATEGORIES = [
  { id: 'Relics & Antiques', label: 'Relics & Antiques', icon: Landmark, desc: 'Historical artifacts and royal regalia' },
  { id: 'Military & Defense', label: 'Military & Defense', icon: ShieldCheck, desc: 'Decommissioned naval hulls, prototypes' },
  { id: 'Real Estate & Deeds', label: 'Real Estate & Land', icon: Layers, desc: 'Sovereign island deeds, resource plots' },
  { id: 'Art & Trophies', label: 'Art & Trophies', icon: Award, desc: 'Cultural masterpieces and competition honors' },
  { id: 'Technology Prototypes', label: 'Tech & Blueprints', icon: Cpu, desc: 'Experimental blueprints, rare computing units' },
];

const DURATIONS = [
  { mins: 5, label: '5 Minutes (Rapid)' },
  { mins: 60, label: '1 Hour' },
  { mins: 360, label: '6 Hours' },
  { mins: 1440, label: '24 Hours (1 Day)' },
  { mins: 4320, label: '3 Days' },
];

// Helper to format remaining countdown time
function formatCountdown(expiresAt) {
  const diff = Math.max(0, expiresAt - Date.now());
  if (diff <= 0) return 'Ended';
  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
}

// Single Auction Card
const AuctionCard = React.memo(function AuctionCard({
  auction,
  nation,
  formatMoney,
  onBidClick,
  onBuyoutClick
}) {
  const [imgError, setImgError] = useState(false);
  const isSeller = nation && nation.id === auction.seller_nation_id;
  const isHighestBidder = nation && nation.id === auction.highest_bidder_nation_id;
  const timeStr = formatCountdown(auction.expires_at);

  return (
    <div className="rounded-2xl bg-dark-900 border border-white/10 shadow-xl overflow-hidden flex flex-col justify-between hover:border-brand-cyan/40 transition group">
      
      {/* Top Image Preview with zero-server storage (rendered directly in browser) */}
      <div className="relative w-full h-44 bg-dark-950 flex items-center justify-center overflow-hidden border-b border-white/5">
        {auction.image_url && !imgError ? (
          <img
            src={auction.image_url}
            alt={auction.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 gap-2 p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-dark-850 border border-white/5 flex items-center justify-center text-slate-400">
              <Gavel className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-mono text-slate-500">{auction.category}</span>
          </div>
        )}

        {/* Category Badge */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-dark-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300 font-bold">
          {auction.category}
        </span>

        {/* Countdown Badge */}
        <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg backdrop-blur-md border text-[10px] font-mono font-bold flex items-center gap-1 ${
          timeStr === 'Ended' 
            ? 'bg-brand-red/80 border-brand-red text-white' 
            : 'bg-dark-950/80 border-white/10 text-brand-cyan'
        }`}>
          <Clock className="w-3 h-3" /> {timeStr}
        </span>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-white group-hover:text-brand-cyan transition line-clamp-1">
            {auction.title}
          </h3>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1">
            {auction.description || 'Custom sovereign roleplay collectible item.'}
          </p>
          <div className="text-[10px] text-slate-500 font-mono mt-2 flex items-center justify-between">
            <span>Seller: <strong className="text-slate-300">{auction.seller_nation_name}</strong></span>
            <span>{auction.bid_count || 0} Bid(s)</span>
          </div>
        </div>

        {/* Price & Bidding Info */}
        <div className="pt-3 border-t border-white/5 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Current Bid:</span>
            <span className="text-base font-black text-brand-green">
              {formatMoney(auction.current_bid_usd)}
            </span>
          </div>

          {auction.highest_bidder_nation_name && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>High Bidder:</span>
              <span className={`font-semibold truncate max-w-[120px] ${isHighestBidder ? 'text-brand-cyan' : 'text-slate-300'}`}>
                {isHighestBidder ? 'You (Winning)' : auction.highest_bidder_nation_name}
              </span>
            </div>
          )}

          {auction.buyout_price_usd && (
            <div className="flex items-center justify-between text-[11px] text-amber-400/90 pt-1 border-t border-white/5">
              <span>Buyout Price:</span>
              <span className="font-bold">{formatMoney(auction.buyout_price_usd)}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <button
            onClick={() => onBidClick(auction)}
            disabled={isSeller}
            className="flex-1 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-white/10 hover:border-brand-cyan/40 text-brand-cyan text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Gavel className="w-3.5 h-3.5" /> Place Bid
          </button>

          {auction.buyout_price_usd && (
            <button
              onClick={() => onBuyoutClick(auction)}
              disabled={isSeller}
              className="py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Instant Buyout"
            >
              <Zap className="w-3.5 h-3.5" /> Buyout
            </button>
          )}
        </div>

      </div>

    </div>
  );
});

// Single Vault Collectible Item Card
const VaultItemCard = React.memo(function VaultItemCard({
  item,
  formatMoney,
  onRelistClick
}) {
  const [imgError, setImgError] = useState(false);
  const pnl = Number(item.estimated_value_usd) - Number(item.acquisition_price_usd);
  const isPos = pnl >= 0;

  return (
    <div className="rounded-2xl bg-dark-900 border border-white/10 shadow-xl overflow-hidden flex flex-col justify-between space-y-3 p-4">
      <div className="flex items-start gap-3.5">
        <div className="w-16 h-16 rounded-xl bg-dark-950 border border-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center">
          {item.image_url && !imgError ? (
            <img
              src={item.image_url}
              alt={item.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Gem className="w-6 h-6 text-brand-cyan" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-800 text-slate-400 font-mono">
              {item.category}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
            {item.description || 'Owned sovereign roleplay collectible.'}
          </p>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Origin: <strong className="text-slate-400">{item.original_creator_nation_name || 'Autonomous Guild'}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-dark-950/60 font-mono text-xs border border-white/5">
        <div>
          <span className="text-[10px] text-slate-400 block">Cost Paid:</span>
          <span className="font-semibold text-slate-200">{formatMoney(item.acquisition_price_usd)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Estimated Value:</span>
          <span className="font-bold text-brand-green">{formatMoney(item.estimated_value_usd)}</span>
        </div>
      </div>

      <div className="pt-1">
        {item.is_listed_for_auction ? (
          <div className="py-2 text-center text-xs font-bold text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
            Listed on Auction
          </div>
        ) : (
          <button
            onClick={() => onRelistClick(item)}
            className="w-full py-2 rounded-xl bg-dark-800 hover:bg-dark-750 border border-white/10 hover:border-brand-cyan/40 text-brand-cyan text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Gavel className="w-3.5 h-3.5" /> Sell on Auction
          </button>
        )}
      </div>
    </div>
  );
});

export default React.memo(function AuctionHouse() {
  const { nation, formatMoney, formatRawUSD, refreshProfile, setAuthModalOpen } = useAuth();

  const [activeTab, setActiveTab] = useState('auctions'); // 'auctions', 'create', 'vault', 'history'
  const [auctions, setAuctions] = useState([]);
  const [vaultItems, setVaultItems] = useState([]);
  const [totalVaultVal, setTotalVaultVal] = useState(0);
  const [historyList, setHistoryList] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Listing creation form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Relics & Antiques');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [startingBidUsd, setStartingBidUsd] = useState('1000');
  const [buyoutPriceUsd, setBuyoutPriceUsd] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modals for bidding & relisting
  const [bidModalAuction, setBidModalAuction] = useState(null);
  const [bidInput, setBidInput] = useState('');
  const [bidLoading, setBidLoading] = useState(false);
  const [bidError, setBidError] = useState('');

  const [buyoutModalAuction, setBuyoutModalAuction] = useState(null);
  const [buyoutLoading, setBuyoutLoading] = useState(false);

  const [relistModalItem, setRelistModalItem] = useState(null);
  const [relistBid, setRelistBid] = useState('1000');
  const [relistBuyout, setRelistBuyout] = useState('');
  const [relistDuration, setRelistDuration] = useState(60);
  const [relistLoading, setRelistLoading] = useState(false);
  const [relistError, setRelistError] = useState('');

  // Fetch active auctions
  const fetchAuctions = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/active');
      if (res.ok) {
        const data = await res.json();
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Error fetching auctions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch vault inventory
  const fetchVault = useCallback(async () => {
    const token = localStorage.getItem('ns_trading_token');
    if (!token) return;
    try {
      const res = await fetch('/api/auction/inventory', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVaultItems(data.items || []);
        setTotalVaultVal(data.totalVaultValueUsd || 0);
      }
    } catch (err) {
      console.error('Error fetching vault:', err);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
    fetchVault();
    fetchHistory();

    const interval = setInterval(() => {
      fetchAuctions();
      if (nation) fetchVault();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchAuctions, fetchVault, fetchHistory, nation]);

  // Filtered auctions
  const filteredAuctions = useMemo(() => {
    return auctions.filter(a => {
      const matchesCat = categoryFilter === 'ALL' || a.category === categoryFilter;
      const matchesSearch = searchQuery === '' ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [auctions, categoryFilter, searchQuery]);

  // Handle Create Listing
  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!nation) {
      setAuthModalOpen(true);
      return;
    }

    setCreateError('');
    setCreateLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/auction/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          category,
          description,
          imageUrl: imageUrl.trim() || null,
          startingBidUsd: Number(startingBidUsd),
          buyoutPriceUsd: buyoutPriceUsd ? Number(buyoutPriceUsd) : null,
          durationMinutes: Number(durationMinutes)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create auction');

      confetti({ particleCount: 90, spread: 60, origin: { y: 0.6 } });
      setTitle('');
      setDescription('');
      setImageUrl('');
      setStartingBidUsd('1000');
      setBuyoutPriceUsd('');
      setActiveTab('auctions');
      await fetchAuctions();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle Bid
  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!bidModalAuction || !nation) return;

    setBidError('');
    setBidLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auctionId: bidModalAuction.id,
          bidAmountUsd: Number(bidInput)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place bid');

      setBidModalAuction(null);
      await refreshProfile();
      await fetchAuctions();
    } catch (err) {
      setBidError(err.message);
    } finally {
      setBidLoading(false);
    }
  };

  // Handle Buyout
  const handleExecuteBuyout = async () => {
    if (!buyoutModalAuction || !nation) return;

    setBuyoutLoading(true);
    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/auction/buyout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ auctionId: buyoutModalAuction.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute buyout');

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setBuyoutModalAuction(null);
      await refreshProfile();
      await fetchAuctions();
      await fetchVault();
    } catch (err) {
      alert(err.message);
    } finally {
      setBuyoutLoading(false);
    }
  };

  // Handle Relist
  const handleRelistSubmit = async (e) => {
    e.preventDefault();
    if (!relistModalItem || !nation) return;

    setRelistError('');
    setRelistLoading(true);

    try {
      const token = localStorage.getItem('ns_trading_token');
      const res = await fetch('/api/auction/relist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          collectibleId: relistModalItem.id,
          startingBidUsd: Number(relistBid),
          buyoutPriceUsd: relistBuyout ? Number(relistBuyout) : null,
          durationMinutes: Number(relistDuration)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to relist item');

      setRelistModalItem(null);
      setActiveTab('auctions');
      await fetchAuctions();
      await fetchVault();
    } catch (err) {
      setRelistError(err.message);
    } finally {
      setRelistLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-white/10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold/20 text-brand-gold flex items-center justify-center">
            <Gavel className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              Auction House & Collectibles
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Auction custom sovereign relics, military hardware, real estate, and rare RP assets.
            </p>
          </div>
        </div>

        {nation && (
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-dark-950/80 border border-white/5 font-mono text-xs text-right shrink-0">
              <span className="text-slate-400 block text-[10px]">Your Vault Value</span>
              <span className="font-bold text-brand-green">{formatMoney(totalVaultVal)} ({vaultItems.length} Items)</span>
            </div>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('auctions')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'auctions'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gavel className="w-4 h-4" /> Live Auctions ({auctions.length})
        </button>

        <button
          onClick={() => setActiveTab('create')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'create'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <PlusCircle className="w-4 h-4" /> Create Auction
        </button>

        <button
          onClick={() => setActiveTab('vault')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'vault'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gem className="w-4 h-4 text-brand-cyan" /> My Vault ({vaultItems.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-2 px-4 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'history'
              ? 'bg-dark-800 text-brand-cyan border border-white/10 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Past Sales ({historyList.length})
        </button>
      </div>

      {/* TAB 1: Live Auctions */}
      {activeTab === 'auctions' && (
        <div className="space-y-5">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            
            {/* Category Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono no-scrollbar">
              <button
                onClick={() => setCategoryFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                  categoryFilter === 'ALL' ? 'bg-brand-cyan text-dark-950 font-bold' : 'bg-dark-900 border border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                    categoryFilter === c.id ? 'bg-brand-cyan text-dark-950 font-bold' : 'bg-dark-900 border border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-dark-900 border border-white/10 text-xs text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>
          </div>

          {/* Auction Gallery */}
          {filteredAuctions.length === 0 ? (
            <div className="p-16 rounded-2xl bg-dark-900 border border-white/10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-dark-850 border border-white/5 flex items-center justify-center mx-auto text-slate-500">
                <Gavel className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">The Auction House is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No active listings right now. Be the first sovereign nation to auction a custom relic, ship, or artifact!
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="py-2.5 px-5 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-dark-950 font-bold text-xs transition cursor-pointer"
              >
                Create First Auction
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredAuctions.map(a => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  nation={nation}
                  formatMoney={formatMoney}
                  onBidClick={(auc) => {
                    if (!nation) { setAuthModalOpen(true); return; }
                    const minBid = auc.highest_bidder_nation_id
                      ? +(auc.current_bid_usd + Math.max(1, auc.current_bid_usd * 0.05)).toFixed(2)
                      : auc.starting_bid_usd;
                    setBidInput(String(minBid));
                    setBidModalAuction(auc);
                    setBidError('');
                  }}
                  onBuyoutClick={(auc) => {
                    if (!nation) { setAuthModalOpen(true); return; }
                    setBuyoutModalAuction(auc);
                  }}
                />
              ))}
            </div>
          )}

        </div>
      )}

      {/* TAB 2: Create Auction */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateListing} className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-5xl">
          
          {/* Left Form Inputs (7 cols) */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-dark-900 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-white/5 pb-2">
              <PlusCircle className="w-4 h-4 text-brand-cyan" /> Item Details
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Item Name <span className="text-brand-green">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Imperial Scepter of Valoria"
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-sm focus:outline-none focus:border-brand-cyan"
              />
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-cyan"
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label} — {c.desc}</option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Description & Lore</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the historical backstory, condition, specifications, or roleplay lore of this item..."
                className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-cyan"
              />
            </div>

            {/* Browser-Rendered Image URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Image Web URL <span className="text-slate-500 font-normal">(Rendered in browser, zero server storage)</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or any public image URL"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-xs focus:outline-none focus:border-brand-cyan font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Images are rendered safely in your browser. No files are uploaded to the database.
              </p>
            </div>

            {/* Bidding & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Starting Bid (USD) <span className="text-brand-green">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={startingBidUsd}
                  onChange={(e) => setStartingBidUsd(e.target.value)}
                  placeholder="1000"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm font-bold focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Instant Buyout Price <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={buyoutPriceUsd}
                  onChange={(e) => setBuyoutPriceUsd(e.target.value)}
                  placeholder="Leave empty for bid only"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm font-bold focus:outline-none focus:border-brand-cyan"
                />
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Auction Duration</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.mins}
                    type="button"
                    onClick={() => setDurationMinutes(d.mins)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      durationMinutes === d.mins
                        ? 'bg-brand-cyan/20 border-brand-cyan text-brand-cyan'
                        : 'bg-dark-850 border-white/5 text-slate-400 hover:border-white/15'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
                {createError}
              </div>
            )}

            <button
              type="submit"
              disabled={createLoading || !title.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-cyan via-brand-green to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-dark-950 font-extrabold text-sm shadow-xl transition cursor-pointer disabled:opacity-50"
            >
              {createLoading ? 'Listing...' : nation ? 'List Item on Auction House' : 'Sign In to List'}
            </button>
          </div>

          {/* Right Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-24 p-5 rounded-2xl bg-dark-900 border border-brand-cyan/30 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-gold" /> Live Browser Preview
                </span>
                <span className="text-[10px] font-mono text-slate-400">Card Mockup</span>
              </div>

              <div className="w-full h-44 rounded-xl bg-dark-950 border border-white/5 overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-slate-600 flex flex-col items-center gap-1 text-xs">
                    <ImageIcon className="w-6 h-6" />
                    <span>Image Preview</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-dark-800 text-brand-cyan font-mono">{category}</span>
                <h4 className="text-base font-bold text-white">{title || 'Item Name'}</h4>
                <p className="text-xs text-slate-400">{description || 'Your custom item lore...'}</p>
              </div>

              <div className="p-3 rounded-xl bg-dark-950/60 font-mono text-xs space-y-1.5 border border-white/5">
                <div className="flex justify-between text-slate-400">
                  <span>Starting Bid:</span>
                  <span className="text-brand-green font-bold">${Number(startingBidUsd || 0).toLocaleString()} USD</span>
                </div>
                {buyoutPriceUsd && (
                  <div className="flex justify-between text-amber-400">
                    <span>Instant Buyout:</span>
                    <span className="font-bold">${Number(buyoutPriceUsd).toLocaleString()} USD</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </form>
      )}

      {/* TAB 3: My Vault (Inventory) */}
      {activeTab === 'vault' && (
        <div className="space-y-5">
          {!nation ? (
            <div className="p-12 rounded-2xl bg-dark-900 border border-white/10 text-center space-y-3">
              <Gem className="w-10 h-10 text-brand-cyan mx-auto" />
              <h3 className="text-base font-bold text-white">Sign In to View Your Vault</h3>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="py-2.5 px-6 rounded-xl bg-brand-green text-dark-950 font-bold text-xs cursor-pointer"
              >
                Sign In
              </button>
            </div>
          ) : vaultItems.length === 0 ? (
            <div className="p-16 rounded-2xl bg-dark-900 border border-white/10 text-center space-y-3">
              <Gem className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">Your Vault is Empty</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Win auctions or execute buyouts to store sovereign relics, ships, and trophies in your nation's vault.
              </p>
              <button
                onClick={() => setActiveTab('auctions')}
                className="py-2.5 px-5 rounded-xl bg-brand-cyan text-dark-950 font-bold text-xs cursor-pointer"
              >
                Browse Auctions
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultItems.map(item => (
                <VaultItemCard
                  key={item.id}
                  item={item}
                  formatMoney={formatMoney}
                  onRelistClick={(it) => {
                    setRelistModalItem(it);
                    setRelistBid(String(it.estimated_value_usd || 1000));
                    setRelistBuyout('');
                    setRelistError('');
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Past Sales */}
      {activeTab === 'history' && (
        <div className="rounded-2xl bg-dark-900 border border-white/10 shadow-xl overflow-hidden">
          {historyList.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm">No completed auctions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/10 bg-dark-950/60 text-slate-400 text-[11px]">
                    <th className="p-3.5">Item</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Seller</th>
                    <th className="p-3.5">Winner</th>
                    <th className="p-3.5">Final Price</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {historyList.map(h => (
                    <tr key={h.id} className="hover:bg-dark-850/50">
                      <td className="p-3.5 font-bold text-white">{h.title}</td>
                      <td className="p-3.5 text-slate-400">{h.category}</td>
                      <td className="p-3.5 text-slate-300">{h.seller_nation_name}</td>
                      <td className="p-3.5 text-brand-cyan font-semibold">{h.winner_nation_name || 'None (Expired)'}</td>
                      <td className="p-3.5 text-brand-green font-bold">{formatMoney(h.final_price_usd)}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          h.status === 'SOLD' ? 'bg-brand-green/20 text-brand-green' : 'bg-dark-800 text-slate-400'
                        }`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bid Modal */}
      {bidModalAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-2xl bg-dark-900 border border-brand-cyan/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-cyan" /> Place Bid
              </h3>
              <button
                onClick={() => setBidModalAuction(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">Bidding on:</div>
              <div className="text-sm font-bold text-white">{bidModalAuction.title}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/60 border border-white/5 font-mono text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Current Bid:</span>
                <span className="font-bold text-white">{formatMoney(bidModalAuction.current_bid_usd)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Your Available Cash:</span>
                <span className="font-bold text-brand-green">{formatMoney(nation?.cash_balance_usd || 0)}</span>
              </div>
            </div>

            <form onSubmit={handlePlaceBid} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Your Bid Amount (USD)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={bidInput}
                  onChange={(e) => setBidInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-base font-bold focus:outline-none focus:border-brand-cyan"
                />
              </div>

              {bidError && (
                <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
                  {bidError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setBidModalAuction(null)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold hover:bg-dark-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bidLoading}
                  className="flex-1 py-2.5 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-dark-950 text-xs font-bold transition cursor-pointer"
                >
                  {bidLoading ? 'Bidding...' : 'Confirm Bid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Buyout Confirmation Modal */}
      {buyoutModalAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-2xl bg-dark-900 border border-amber-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" /> Instant Buyout
              </h3>
              <button
                onClick={() => setBuyoutModalAuction(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Buy <strong>{buyoutModalAuction.title}</strong> immediately for{' '}
              <strong className="text-amber-400">{formatMoney(buyoutModalAuction.buyout_price_usd)}</strong>?
              The item will transfer instantly to your Vault.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBuyoutModalAuction(null)}
                className="flex-1 py-2.5 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold hover:bg-dark-750 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBuyout}
                disabled={buyoutLoading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold transition cursor-pointer"
              >
                {buyoutLoading ? 'Purchasing...' : 'Confirm Buyout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relist Modal */}
      {relistModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="max-w-md w-full p-6 rounded-2xl bg-dark-900 border border-brand-cyan/40 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gavel className="w-5 h-5 text-brand-cyan" /> Sell on Auction
              </h3>
              <button
                onClick={() => setRelistModalItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Listing: <strong className="text-white">{relistModalItem.title}</strong>
            </div>

            <form onSubmit={handleRelistSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Starting Bid (USD)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={relistBid}
                  onChange={(e) => setRelistBid(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm font-bold focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Buyout Price (Optional)</label>
                <input
                  type="number"
                  min="2"
                  value={relistBuyout}
                  onChange={(e) => setRelistBuyout(e.target.value)}
                  placeholder="Optional instant buyout"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white font-mono text-sm font-bold focus:outline-none focus:border-brand-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Duration</label>
                <select
                  value={relistDuration}
                  onChange={(e) => setRelistDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-850 border border-white/10 text-white text-xs"
                >
                  {DURATIONS.map(d => (
                    <option key={d.mins} value={d.mins}>{d.label}</option>
                  ))}
                </select>
              </div>

              {relistError && (
                <div className="p-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
                  {relistError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRelistModalItem(null)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold hover:bg-dark-750 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={relistLoading}
                  className="flex-1 py-2.5 rounded-xl bg-brand-cyan hover:bg-cyan-400 text-dark-950 text-xs font-bold transition cursor-pointer"
                >
                  {relistLoading ? 'Listing...' : 'List on Auction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
});
