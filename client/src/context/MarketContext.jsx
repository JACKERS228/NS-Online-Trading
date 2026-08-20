import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('AGIS');
  const [recentTrades, setRecentTrades] = useState([]);
  const [breakingNews, setBreakingNews] = useState([]);
  const [priceFlashMap, setPriceFlashMap] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [marketStats, setMarketStats] = useState({
    totalMarketCapUsd: 0,
    total24hVolume: 0,
    topGainer: null,
    topLoser: null
  });

  const eventSourceRef = useRef(null);
  const flashTimersRef = useRef({});

  // Setup Server-Sent Events (SSE) stream
  useEffect(() => {
    let reconnectTimeout = null;

    function connectSSE() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setConnectionStatus('connecting');
      const es = new EventSource('/api/market/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus('connected');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'SNAPSHOT') {
            setAssets(data.assets || []);
            setRecentTrades(data.recentTrades || []);
            setBreakingNews(data.latestNews || []);
            computeMarketStats(data.assets || []);
          } else if (data.type === 'TICK') {
            // Update assets with flash cues
            setAssets((prevAssets) => {
              const assetMap = new Map(prevAssets.map(a => [a.id, a]));
              const flashes = {};

              (data.assets || []).forEach(updated => {
                const existing = assetMap.get(updated.id);
                if (existing) {
                  if (updated.current_price_usd > existing.current_price_usd) {
                    flashes[updated.ticker] = 'up';
                  } else if (updated.current_price_usd < existing.current_price_usd) {
                    flashes[updated.ticker] = 'down';
                  }
                  assetMap.set(updated.id, { ...existing, ...updated });
                } else {
                  assetMap.set(updated.id, updated);
                }
              });

              // Trigger flashes
              if (Object.keys(flashes).length > 0) {
                setPriceFlashMap(prev => ({ ...prev, ...flashes }));

                // Clear flash after 1200ms
                Object.keys(flashes).forEach(ticker => {
                  if (flashTimersRef.current[ticker]) {
                    clearTimeout(flashTimersRef.current[ticker]);
                  }
                  flashTimersRef.current[ticker] = setTimeout(() => {
                    setPriceFlashMap(prev => {
                      const next = { ...prev };
                      delete next[ticker];
                      return next;
                    });
                  }, 1200);
                });
              }

              const newAssetList = Array.from(assetMap.values());
              computeMarketStats(newAssetList);
              return newAssetList;
            });

            // Prepend new trades
            if (data.trades && data.trades.length > 0) {
              setRecentTrades(prev => [...data.trades, ...prev].slice(0, 30));
            }

            // Append breaking event if any
            if (data.event) {
              setBreakingNews(prev => [{
                id: Date.now().toString(),
                ...data.event,
                timestamp: data.timestamp
              }, ...prev].slice(0, 20));
            }
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        setConnectionStatus('reconnecting');
        es.close();
        // Try reconnecting in 3 seconds
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  function computeMarketStats(assetList) {
    let totalCap = 0;
    let totalVol = 0;
    let topGainer = null;
    let topLoser = null;

    assetList.forEach(a => {
      totalCap += (a.market_cap_usd || 0);
      totalVol += (a.volume_24h || 0);
      const chg = a.change_24h !== undefined ? Number(a.change_24h) : 0;
      if (!topGainer || chg > (topGainer.change_24h || 0)) topGainer = a;
      if (!topLoser || chg < (topLoser.change_24h || 0)) topLoser = a;
    });

    setMarketStats({
      totalMarketCapUsd: totalCap,
      total24hVolume: totalVol,
      topGainer,
      topLoser
    });
  }

  const selectedAsset = assets.find(a => a.ticker.toUpperCase() === selectedTicker.toUpperCase()) || assets[0] || null;

  return (
    <MarketContext.Provider value={{
      assets,
      selectedTicker,
      setSelectedTicker,
      selectedAsset,
      recentTrades,
      breakingNews,
      priceFlashMap,
      connectionStatus,
      marketStats
    }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
