const db = require('../db');
const { v4: uuidv4 } = require('uuid');

class MarketSimulationEngine {
  constructor() {
    this.intervalId = null;
    this.tickRateMs = 5000; // Tick every 5 seconds
    this.subscribers = new Set();
    this.recentTrades = [];
    this.latestNews = [];
  }

  // Subscribe client SSE response stream
  subscribe(res) {
    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });

    // Send initial snapshot
    const initialData = {
      type: 'SNAPSHOT',
      assets: this.getAllAssets(),
      recentTrades: this.recentTrades.slice(0, 15),
      latestNews: this.getLatestNews(10),
      timestamp: Date.now()
    };
    res.write(`data: ${JSON.stringify(initialData)}\n\n`);
  }

  broadcast(data) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.subscribers) {
      try {
        client.write(payload);
      } catch (err) {
        this.subscribers.delete(client);
      }
    }
  }

  getAllAssets() {
    return db.prepare(`
      SELECT * FROM assets WHERE is_delisted = 0 ORDER BY type ASC, market_cap_usd DESC, current_price_usd DESC
    `).all();
  }

  getLatestNews(limit = 15) {
    return db.prepare(`
      SELECT n.*, a.ticker, a.name as asset_name 
      FROM news_events n
      LEFT JOIN assets a ON n.asset_id = a.id
      ORDER BY n.timestamp DESC
      LIMIT ?
    `).all(limit);
  }

  start() {
    if (this.intervalId) return;
    console.log(`[Market Engine] Starting real-time simulation engine (Tick: ${this.tickRateMs}ms)...`);
    
    // Load initial trades and news
    this.latestNews = this.getLatestNews(20);

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.tickRateMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Market Engine] Simulation engine stopped.');
    }
  }

  tick() {
    const now = Date.now();
    const assets = this.getAllAssets();
    if (!assets || assets.length === 0) return;

    // Randomly roll for a dynamic corporate/macro news event (~8% chance per tick)
    let triggeredEvent = null;
    if (Math.random() < 0.08) {
      triggeredEvent = this.generateRandomMarketEvent(assets, now);
    }

    const updatedAssets = [];
    const newTrades = [];

    const updateAssetStmt = db.prepare(`
      UPDATE assets SET
        current_price_usd = @current_price_usd,
        high_24h_usd = @high_24h_usd,
        low_24h_usd = @low_24h_usd,
        volume_24h = @volume_24h,
        market_cap_usd = @market_cap_usd
      WHERE id = @id
    `);

    const insertCandleStmt = db.prepare(`
      INSERT INTO price_candles (asset_id, timeframe, timestamp, open, high, low, close, volume)
      VALUES (@asset_id, '1m', @timestamp, @open, @high, @low, @close, @volume)
    `);

    const updateCandleStmt = db.prepare(`
      UPDATE price_candles SET
        high = MAX(high, @high),
        low = MIN(low, @low),
        close = @close,
        volume = volume + @volume
      WHERE id = @id
    `);

    const getRecentCandleStmt = db.prepare(`
      SELECT id, open, high, low, close, volume, timestamp 
      FROM price_candles 
      WHERE asset_id = ? AND timeframe = '1m' 
      ORDER BY timestamp DESC LIMIT 1
    `);

    const tx = db.transaction(() => {
      for (const asset of assets) {
        // Base drift based on health score (50 is neutral, >50 bullish drift, <50 bearish drift)
        const healthDrift = (asset.health_score - 50) * 0.0001;
        
        // Random standard deviation scaled by volatility
        const randComponent = (Math.random() - 0.495) * asset.volatility * 0.15;
        
        // Event shock if this asset was targeted
        let shock = 0;
        if (triggeredEvent && triggeredEvent.asset_id === asset.id) {
          shock = triggeredEvent.impact_factor;
        }

        let changePercent = healthDrift + randComponent + shock;
        
        // Clamp maximum move per single tick to prevent breaking bounds
        changePercent = Math.max(-0.25, Math.min(0.35, changePercent));

        const oldPrice = asset.current_price_usd;
        let newPrice = +(oldPrice * (1 + changePercent)).toFixed(2);
        if (newPrice < 0.01) newPrice = 0.01;

        // Calculate tick volume
        const tickVolume = Math.floor(Math.random() * (asset.current_price_usd > 100 ? 500 : 5000) + 10);
        const newVolume24h = asset.volume_24h + tickVolume;
        const newHigh = Math.max(asset.high_24h_usd, newPrice);
        const newLow = Math.min(asset.low_24h_usd, newPrice);
        const newMarketCap = asset.shares_outstanding > 0 ? +(newPrice * asset.shares_outstanding).toFixed(2) : 0;

        updateAssetStmt.run({
          id: asset.id,
          current_price_usd: newPrice,
          high_24h_usd: newHigh,
          low_24h_usd: newLow,
          volume_24h: newVolume24h,
          market_cap_usd: newMarketCap
        });

        // 1m Candle Management
        const latestCandle = getRecentCandleStmt.get(asset.id);
        const oneMinuteMs = 60 * 1000;

        if (!latestCandle || (now - latestCandle.timestamp) >= oneMinuteMs) {
          // Start new 1-minute candle
          insertCandleStmt.run({
            asset_id: asset.id,
            timestamp: Math.floor(now / 60000) * 60000,
            open: oldPrice,
            high: Math.max(oldPrice, newPrice),
            low: Math.min(oldPrice, newPrice),
            close: newPrice,
            volume: tickVolume
          });
        } else {
          // Update existing 1-minute candle
          updateCandleStmt.run({
            id: latestCandle.id,
            high: newPrice,
            low: newPrice,
            close: newPrice,
            volume: tickVolume
          });
        }

        // Generate simulated NPC trade for the live stream
        const tradeSide = newPrice >= oldPrice ? 'BUY' : 'SELL';
        const tradeQty = Math.floor(Math.random() * 200 + 5);
        const trade = {
          id: uuidv4().substring(0, 8),
          ticker: asset.ticker,
          name: asset.name,
          side: tradeSide,
          price_usd: newPrice,
          quantity: tradeQty,
          total_usd: +(newPrice * tradeQty).toFixed(2),
          timestamp: now,
          trader: this.getRandomTraderName(asset.nation_name)
        };
        newTrades.push(trade);

        updatedAssets.push({
          id: asset.id,
          ticker: asset.ticker,
          name: asset.name,
          type: asset.type,
          current_price_usd: newPrice,
          prev_price_usd: oldPrice,
          change_24h: +(((newPrice - asset.open_price_24h_usd) / asset.open_price_24h_usd) * 100).toFixed(2),
          high_24h_usd: newHigh,
          low_24h_usd: newLow,
          volume_24h: newVolume24h,
          market_cap_usd: newMarketCap
        });
      }
    });

    tx();

    // Keep recent trades buffer
    this.recentTrades = [...newTrades.slice(0, 5), ...this.recentTrades].slice(0, 30);

    // Broadcast tick update to all connected clients
    this.broadcast({
      type: 'TICK',
      timestamp: now,
      assets: updatedAssets,
      trades: newTrades.slice(0, 5),
      event: triggeredEvent ? {
        headline: triggeredEvent.headline,
        detail: triggeredEvent.detail,
        category: triggeredEvent.category,
        ticker: triggeredEvent.ticker
      } : null
    });
  }

  generateRandomMarketEvent(assets, timestamp) {
    const targetAsset = assets[Math.floor(Math.random() * assets.length)];
    if (!targetAsset) return null;

    const eventTemplates = {
      stock: [
        {
          category: 'EARNINGS',
          headline: `${targetAsset.name} Reports Strong Financial Margins`,
          detail: `Quarterly results exceed analyst consensus with robust order book growth and healthy cash reserves.`,
          impact: 0.06 + Math.random() * 0.08
        },
        {
          category: 'DIVIDEND',
          headline: `${targetAsset.name} Distributes Special Cash Dividend`,
          detail: `Corporate board authorizes direct capital distribution of yield dividends to all recorded shareholders.`,
          impact: 0.03 + Math.random() * 0.04,
          isDividend: true
        },
        {
          category: 'POLICY',
          headline: `Government Awards Strategic Infrastructure Contract to ${targetAsset.name}`,
          detail: `Multi-year sovereign modernization procurement agreement boosts forward enterprise valuation.`,
          impact: 0.05 + Math.random() * 0.07
        },
        {
          category: 'SCANDAL',
          headline: `Internal Supply Audit Triggers Investigation at ${targetAsset.name}`,
          detail: `Regulatory scrutiny over component certifications leads to short-term production delays.`,
          impact: -(0.06 + Math.random() * 0.08)
        }
      ],
      commodity: [
        {
          category: 'COMMODITY',
          headline: `Global Trade Bottlenecks Tighten ${targetAsset.name} Reserves`,
          detail: `Export terminal maintenance and sovereign stockpiling create sudden spot-market inventory crunches.`,
          impact: 0.05 + Math.random() * 0.09
        },
        {
          category: 'COMMODITY',
          headline: `Surplus Extraction Boosts Spot Supplies of ${targetAsset.name}`,
          detail: `New regional extraction facilities come online ahead of schedule, dampening short-term spot premiums.`,
          impact: -(0.04 + Math.random() * 0.07)
        }
      ],
      crypto: [
        {
          category: 'CRYPTO',
          headline: `Institutional Vaults Deploy Liquidity into ${targetAsset.name}`,
          detail: `Surging decentralized staking participation accelerates network fee burns and token accumulation.`,
          impact: 0.12 + Math.random() * 0.18
        },
        {
          category: 'CRYPTO',
          headline: `High Volatility Liquidations Shake ${targetAsset.name} Derivatives`,
          detail: `Cascading margin settlements trigger sharp intraday pullback before stabilization.`,
          impact: -(0.10 + Math.random() * 0.15)
        }
      ]
    };

    const typeTemplates = eventTemplates[targetAsset.type] || eventTemplates.stock;
    const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];

    const eventId = uuidv4();
    
    // Insert news event into DB
    db.prepare(`
      INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, targetAsset.id, template.headline, template.detail, template.category, template.impact, timestamp);

    // If dividend event, distribute cash to all current holders of this stock
    if (template.isDividend && targetAsset.dividend_yield > 0) {
      this.distributeDividends(targetAsset);
    }

    return {
      id: eventId,
      asset_id: targetAsset.id,
      ticker: targetAsset.ticker,
      headline: template.headline,
      detail: template.detail,
      category: template.category,
      impact_factor: template.impact
    };
  }

  distributeDividends(asset) {
    try {
      const dividendPerShare = +(asset.current_price_usd * (asset.dividend_yield / 4)).toFixed(4); // Quarterly fraction
      if (dividendPerShare <= 0) return;

      const holdings = db.prepare(`
        SELECT p.nation_id, p.quantity, n.name as nation_name 
        FROM portfolios p
        JOIN nations n ON p.nation_id = n.id
        WHERE p.asset_id = ? AND p.quantity > 0
      `).all(asset.id);

      const updateNationBalance = db.prepare(`
        UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?
      `);

      const updatePortfolioDividends = db.prepare(`
        UPDATE portfolios SET total_dividends_earned_usd = total_dividends_earned_usd + ? WHERE nation_id = ? AND asset_id = ?
      `);

      const divTx = db.transaction(() => {
        for (const h of holdings) {
          const totalPayout = +(h.quantity * dividendPerShare).toFixed(2);
          if (totalPayout > 0) {
            updateNationBalance.run(totalPayout, h.nation_id);
            updatePortfolioDividends.run(totalPayout, h.nation_id, asset.id);
          }
        }
      });

      divTx();
      console.log(`[Market Engine] Distributed $${dividendPerShare}/sh dividend for ${asset.ticker} to ${holdings.length} shareholder(s).`);
    } catch (err) {
      console.error('[Market Engine] Error distributing dividends:', err);
    }
  }

  getRandomTraderName(nationName) {
    const bots = [
      'Citadel Sovereign Fund',
      'Quantum Capital Liquidity',
      'Pacific Rim Arbitrage',
      'Nordic Mutual Reserve',
      'Valoria Central Desk',
      'Apex Algorithmic Desk',
      'Aegis Institutional Trust',
      'Vanguard Sovereign Wealth'
    ];
    if (nationName && Math.random() < 0.4) {
      return `${nationName} National Reserve`;
    }
    return bots[Math.floor(Math.random() * bots.length)];
  }
}

const engine = new MarketSimulationEngine();
module.exports = engine;
