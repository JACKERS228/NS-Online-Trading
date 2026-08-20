import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, startTransition } from 'react';

const MarketContext = createContext(null);

export function MarketProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [selectedTicker, setSelectedTickerState] = useState('AGIS');
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
  const flashTimerRef = useRef(null);

  const setSelectedTicker = useCallback((ticker) => {
    startTransition(() => {
      setSelectedTickerState(ticker);
    });
  }, []);

  function computeMarketStats(assetList) {
    let totalCap = 0;
    let totalVol = 0;
    let topGainer = null;
    let topLoser = null;

    for (let i = 0; i < assetList.length; i++) {
      const a = assetList[i];
      totalCap += (Number(a.market_cap_usd) || 0);
      totalVol += (Number(a.volume_24h) || 0);
      const chg = a.change_24h !== undefined ? Number(a.change_24h) : 0;
      if (!topGainer || chg > (Number(topGainer.change_24h) || 0)) topGainer = a;
      if (!topLoser || chg < (Number(topLoser.change_24h) || 0)) topLoser = a;
    }

    return {
      totalMarketCapUsd: totalCap,
      total24hVolume: totalVol,
      topGainer,
      topLoser
    };
  }

  // Setup Server-Sent Events (SSE) stream with low-priority transitions
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
            startTransition(() => {
              setAssets(data.assets || []);
              setRecentTrades(data.recentTrades || []);
              setBreakingNews(data.latestNews || []);
              setMarketStats(computeMarketStats(data.assets || []));
            });
          } else if (data.type === 'TICK') {
            startTransition(() => {
              setAssets((prevAssets) => {
                const assetMap = new Map(prevAssets.map(a => [a.id, a]));
                const flashes = {};

                (data.assets || []).forEach(updated => {
                  const existing = assetMap.get(updated.id);
                  if (existing) {
                    const newPrice = Number(updated.current_price_usd);
                    const oldPrice = Number(existing.current_price_usd);
                    if (newPrice > oldPrice) {
                      flashes[updated.ticker] = 'up';
                    } else if (newPrice < oldPrice) {
                      flashes[updated.ticker] = 'down';
                    }
                    assetMap.set(updated.id, { ...existing, ...updated });
                  } else {
                    assetMap.set(updated.id, updated);
                  }
                });

                // Batch trigger flashes and single clear timeout
                if (Object.keys(flashes).length > 0) {
                  setPriceFlashMap(flashes);

                  if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
                  flashTimerRef.current = setTimeout(() => {
                    setPriceFlashMap({});
                  }, 1000);
                }

                const newAssetList = Array.from(assetMap.values());
                setMarketStats(computeMarketStats(newAssetList));
                return newAssetList;
              });

              if (data.trades && data.trades.length > 0) {
                setRecentTrades(prev => [...data.trades, ...prev].slice(0, 25));
              }

              if (data.event) {
                setBreakingNews(prev => [{
                  id: Date.now().toString(),
                  ...data.event,
                  timestamp: data.timestamp
                }, ...prev].slice(0, 20));
              }
            });
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        setConnectionStatus('reconnecting');
        es.close();
        reconnectTimeout = setTimeout(connectSSE, 4000);
      };
    }

    connectSSE();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const selectedAsset = useMemo(() => {
    return assets.find(a => a.ticker.toUpperCase() === selectedTicker.toUpperCase()) || assets[0] || null;
  }, [assets, selectedTicker]);

  const contextValue = useMemo(() => ({
    assets,
    selectedTicker,
    setSelectedTicker,
    selectedAsset,
    recentTrades,
    breakingNews,
    priceFlashMap,
    connectionStatus,
    marketStats
  }), [
    assets,
    selectedTicker,
    setSelectedTicker,
    selectedAsset,
    recentTrades,
    breakingNews,
    priceFlashMap,
    connectionStatus,
    marketStats
  ]);

  return (
    <MarketContext.Provider value={contextValue}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
