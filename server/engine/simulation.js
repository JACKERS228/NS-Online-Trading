const db = require('../db');
const { v4: uuidv4 } = require('uuid');

class MarketSimulationEngine {
  constructor() {
    this.intervalId = null;
    this.tickRateMs = 5000;
    this.subscribers = new Set();
    this.recentTrades = [];
    this.latestNews = [];
    this.isProcessingTick = false;
  }

  async subscribe(res) {
    this.subscribers.add(res);
    res.on('close', () => {
      this.subscribers.delete(res);
    });

    const assets = await this.getAllAssets();
    const news = await this.getLatestNews(10);

    const initialData = {
      type: 'SNAPSHOT',
      assets: assets,
      recentTrades: this.recentTrades.slice(0, 15),
      latestNews: news,
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

  async getAllAssets() {
    return await db.all(`
      SELECT * FROM assets WHERE is_delisted = 0 ORDER BY type ASC, market_cap_usd DESC, current_price_usd DESC
    `);
  }

  async getLatestNews(limit = 15) {
    return await db.all(`
      SELECT n.*, a.ticker, a.name as asset_name 
      FROM news_events n
      LEFT JOIN assets a ON n.asset_id = a.id
      ORDER BY n.timestamp DESC
      LIMIT ?
    `, [limit]);
  }

  async start() {
    if (this.intervalId) return;
    console.log(`[Market Engine] Starting real-time simulation engine (Tick: ${this.tickRateMs}ms)...`);
    
    this.latestNews = await this.getLatestNews(20);

    this.intervalId = setInterval(async () => {
      if (this.isProcessingTick) return;
      this.isProcessingTick = true;
      try {
        await this.tick();
      } catch (err) {
        console.error('[Market Engine] Tick error:', err);
      } finally {
        this.isProcessingTick = false;
      }
    }, this.tickRateMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Market Engine] Simulation engine stopped.');
    }
  }

  async tick() {
    const now = Date.now();
    const assets = await this.getAllAssets();
    if (!assets || assets.length === 0) return;

    let triggeredEvent = null;
    if (Math.random() < 0.08) {
      triggeredEvent = await this.generateRandomMarketEvent(assets, now);
    }

    const updatedAssets = [];
    const newTrades = [];
    const batchStatements = [];

    for (const asset of assets) {
      const healthDrift = (Number(asset.health_score) - 50) * 0.0001;
      const randComponent = (Math.random() - 0.495) * Number(asset.volatility) * 0.15;
      
      let shock = 0;
      if (triggeredEvent && triggeredEvent.asset_id === asset.id) {
        shock = Number(triggeredEvent.impact_factor);
      }

      let changePercent = healthDrift + randComponent + shock;
      changePercent = Math.max(-0.25, Math.min(0.35, changePercent));

      const oldPrice = Number(asset.current_price_usd);
      let newPrice = +(oldPrice * (1 + changePercent)).toFixed(2);
      if (newPrice < 0.01) newPrice = 0.01;

      const tickVolume = Math.floor(Math.random() * (oldPrice > 100 ? 500 : 5000) + 10);
      const newVolume24h = Number(asset.volume_24h) + tickVolume;
      const newHigh = Math.max(Number(asset.high_24h_usd), newPrice);
      const newLow = Math.min(Number(asset.low_24h_usd), newPrice);
      const newMarketCap = Number(asset.shares_outstanding) > 0 ? +(newPrice * Number(asset.shares_outstanding)).toFixed(2) : 0;

      batchStatements.push({
        sql: `UPDATE assets SET
          current_price_usd = ?,
          high_24h_usd = ?,
          low_24h_usd = ?,
          volume_24h = ?,
          market_cap_usd = ?
        WHERE id = ?`,
        args: [newPrice, newHigh, newLow, newVolume24h, newMarketCap, asset.id]
      });

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
        change_24h: +(((newPrice - Number(asset.open_price_24h_usd)) / Number(asset.open_price_24h_usd)) * 100).toFixed(2),
        high_24h_usd: newHigh,
        low_24h_usd: newLow,
        volume_24h: newVolume24h,
        market_cap_usd: newMarketCap
      });
    }

    if (batchStatements.length > 0) {
      await db.batch(batchStatements);
    }

    // Process auction lifecycle finalizations
    await this.processAuctionLifecycles(now);

    this.recentTrades = [...newTrades.slice(0, 5), ...this.recentTrades].slice(0, 30);

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

  async processAuctionLifecycles(now) {
    try {
      const expiredAuctions = await db.all(`
        SELECT * FROM auctions
        WHERE status = 'ACTIVE' AND expires_at <= ?
      `, [now]);

      if (!expiredAuctions || expiredAuctions.length === 0) return;

      const batchStatements = [];

      for (const auc of expiredAuctions) {
        if (auc.highest_bidder_nation_id) {
          // Sold to highest bidder
          const finalPrice = auc.current_bid_usd;
          const winnerId = auc.highest_bidder_nation_id;
          const winnerName = auc.highest_bidder_nation_name;

          // 1. Credit final bid to seller
          batchStatements.push({
            sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
            args: [finalPrice, auc.seller_nation_id]
          });

          // 2. Mark auction SOLD
          batchStatements.push({
            sql: "UPDATE auctions SET status = 'SOLD' WHERE id = ?",
            args: [auc.id]
          });

          // 3. Transfer/Create Collectible in Winner Vault
          if (auc.collectible_id) {
            batchStatements.push({
              sql: `UPDATE collectibles SET 
                      owner_nation_id = ?, 
                      acquisition_price_usd = ?, 
                      estimated_value_usd = ?, 
                      is_listed_for_auction = 0, 
                      acquired_at = ? 
                    WHERE id = ?`,
              args: [winnerId, finalPrice, finalPrice, now, auc.collectible_id]
            });
          } else {
            const newColId = `col_${uuidv4().slice(0, 8)}`;
            batchStatements.push({
              sql: `INSERT INTO collectibles (
                      id, owner_nation_id, original_creator_nation_id, original_creator_nation_name,
                      title, category, description, image_url, acquisition_price_usd,
                      estimated_value_usd, is_listed_for_auction, acquired_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
              args: [
                newColId, winnerId, auc.seller_nation_id, auc.seller_nation_name,
                auc.title, auc.category, auc.description, auc.image_url,
                finalPrice, finalPrice, now
              ]
            });
          }
          console.log(`[Auction] Auction '${auc.title}' concluded! Sold to ${winnerName} for $${finalPrice.toLocaleString()} USD.`);
        } else {
          // Expired with no bids
          batchStatements.push({
            sql: "UPDATE auctions SET status = 'EXPIRED' WHERE id = ?",
            args: [auc.id]
          });

          if (auc.collectible_id) {
            batchStatements.push({
              sql: 'UPDATE collectibles SET is_listed_for_auction = 0 WHERE id = ?',
              args: [auc.collectible_id]
            });
          }
          console.log(`[Auction] Auction '${auc.title}' expired with no bids.`);
        }
      }

      if (batchStatements.length > 0) {
        await db.batch(batchStatements);
      }
    } catch (err) {
      console.error('[Auction Engine] Error processing auction lifecycle:', err);
    }
  }

  async generateRandomMarketEvent(assets, timestamp) {
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
          headline: `Government Awards Strategic Contract to ${targetAsset.name}`,
          detail: `Multi-year sovereign procurement agreement boosts forward enterprise valuation.`,
          impact: 0.05 + Math.random() * 0.07
        },
        {
          category: 'SCANDAL',
          headline: `Internal Supply Audit Triggers Investigation at ${targetAsset.name}`,
          detail: `Regulatory scrutiny over component certifications leads to short-term delays.`,
          impact: -(0.06 + Math.random() * 0.08)
        }
      ],
      commodity: [
        {
          category: 'COMMODITY',
          headline: `Global Logistics Bottlenecks Tighten ${targetAsset.name} Reserves`,
          detail: `Export terminal maintenance and sovereign stockpiling create sudden spot inventory crunches.`,
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
          detail: `Surging decentralized staking participation accelerates network fee burns.`,
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
    
    await db.run(`
      INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [eventId, targetAsset.id, template.headline, template.detail, template.category, template.impact, timestamp]);

    if (template.isDividend && Number(targetAsset.dividend_yield) > 0) {
      await this.distributeDividends(targetAsset);
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

  async distributeDividends(asset) {
    try {
      const dividendPerShare = +(Number(asset.current_price_usd) * (Number(asset.dividend_yield) / 4)).toFixed(4);
      if (dividendPerShare <= 0) return;

      const holdings = await db.all(`
        SELECT p.nation_id, p.quantity, n.name as nation_name 
        FROM portfolios p
        JOIN nations n ON p.nation_id = n.id
        WHERE p.asset_id = ? AND p.quantity > 0
      `, [asset.id]);

      const statements = [];

      for (const h of holdings) {
        const totalPayout = +(Number(h.quantity) * dividendPerShare).toFixed(2);
        if (totalPayout > 0) {
          statements.push({
            sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
            args: [totalPayout, h.nation_id]
          });
          statements.push({
            sql: 'UPDATE portfolios SET total_dividends_earned_usd = total_dividends_earned_usd + ? WHERE nation_id = ? AND asset_id = ?',
            args: [totalPayout, h.nation_id, asset.id]
          });
        }
      }

      if (statements.length > 0) {
        await db.batch(statements);
        console.log(`[Market Engine] Distributed $${dividendPerShare}/sh dividend for ${asset.ticker} to ${holdings.length} shareholder(s).`);
      }
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
