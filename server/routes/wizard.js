const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateNation } = require('./auth');

// Calculation helper for Company Creation Wizard
function calculateCompanyMetrics({ sector, scaleTier = 3, profitabilityTier = 3, volatilityTier = 3, publicFloatPercent = 50 }) {
  // Scale Tier determines baseline Market Cap in USD
  const scaleCaps = {
    1: 15000000,      // Startup / Micro-Cap: ~$15M
    2: 75000000,      // Small Enterprise: ~$75M
    3: 500000000,     // Mid-Cap: ~$500M
    4: 5000000000,    // Large-Cap: ~$5B
    5: 45000000000    // MegaCorp: ~$45B
  };

  const profitMultipliers = {
    1: 0.65, // Speculative / Loss-making
    2: 0.85, // Early Traction
    3: 1.05, // Steady Margins
    4: 1.35, // High Cash Flow
    5: 1.75  // Industry Monopoly
  };

  const volatilityValues = {
    1: 0.025, // Blue-Chip
    2: 0.040, // Balanced Defensive
    3: 0.065, // Moderate Growth
    4: 0.095, // High-Beta
    5: 0.140  // Speculative Moonshot
  };

  const sectorDividendBase = {
    'Energy & Utilities': 0.048,
    'Defense & Aerospace': 0.035,
    'Healthcare & Pharma': 0.028,
    'Agriculture & Food': 0.038,
    'Heavy Manufacturing': 0.032,
    'Technology & AI': 0.012,
    'Media & Entertainment': 0.020,
    'Luxury Goods': 0.025,
    'Transport & Space': 0.022
  };

  const baseCap = scaleCaps[scaleTier] || scaleCaps[3];
  const mult = profitMultipliers[profitabilityTier] || 1.0;
  const marketCapUsd = +(baseCap * mult).toFixed(2);

  // Target share price between $15 and $120
  const targetSharePrice = +(15 + (scaleTier * 12) + (profitabilityTier * 6) + (Math.random() * 5)).toFixed(2);
  const sharesOutstanding = Math.floor(marketCapUsd / targetSharePrice);
  const floatPct = Math.max(10, Math.min(90, Number(publicFloatPercent) || 50));
  const sharesFloat = Math.floor(sharesOutstanding * (floatPct / 100));

  const baseDiv = sectorDividendBase[sector] || 0.025;
  const divYield = profitabilityTier >= 3 ? +(baseDiv * (profitabilityTier / 3)).toFixed(4) : 0;
  const healthScore = Math.min(100, Math.max(10, (profitabilityTier * 16) + (scaleTier * 4)));
  const vol = volatilityValues[volatilityTier] || 0.065;
  const initialVolume24h = Math.floor(sharesFloat * 0.08);

  return {
    initialPriceUsd: targetSharePrice,
    marketCapUsd,
    sharesOutstanding,
    sharesFloat,
    floatPercent: floatPct,
    volatility: vol,
    dividendYield: divYield,
    healthScore,
    estimatedVolume24h: initialVolume24h
  };
}

// Preview Company Wizard calculation without creating
router.post('/company/preview', (req, res) => {
  try {
    const metrics = calculateCompanyMetrics(req.body);
    res.json(metrics);
  } catch (err) {
    res.status(400).json({ error: 'Calculation error' });
  }
});

// Create Company and Launch IPO
router.post('/company/create', authenticateNation, (req, res) => {
  try {
    const { name, ticker, sector, description, scaleTier, profitabilityTier, volatilityTier, publicFloatPercent } = req.body;
    const nation = req.nation;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!ticker || !ticker.trim()) {
      return res.status(400).json({ error: 'Ticker symbol is required' });
    }

    const cleanTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanTicker.length < 2 || cleanTicker.length > 5) {
      return res.status(400).json({ error: 'Ticker must be 2 to 5 alphanumeric characters' });
    }

    const existingTicker = db.prepare('SELECT id FROM assets WHERE UPPER(ticker) = ?').get(cleanTicker);
    if (existingTicker) {
      return res.status(400).json({ error: `Ticker symbol '${cleanTicker}' is already registered` });
    }

    const metrics = calculateCompanyMetrics({
      sector: sector || 'Technology & AI',
      scaleTier: Number(scaleTier) || 3,
      profitabilityTier: Number(profitabilityTier) || 3,
      volatilityTier: Number(volatilityTier) || 3,
      publicFloatPercent: Number(publicFloatPercent) || 50
    });

    const assetId = `stock_${uuidv4().substring(0, 8)}`;
    const now = Date.now();

    const createTx = db.transaction(() => {
      // Insert asset
      db.prepare(`
        INSERT INTO assets (
          id, ticker, name, type, nation_id, nation_name, sector, description,
          current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
          volume_24h, market_cap_usd, shares_outstanding, shares_float,
          volatility, dividend_yield, health_score, created_at
        ) VALUES (
          ?, ?, ?, 'stock', ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        assetId, cleanTicker, name.trim(), nation.id, nation.name, sector || 'Technology & AI', description || '',
        metrics.initialPriceUsd, metrics.initialPriceUsd, metrics.initialPriceUsd, metrics.initialPriceUsd,
        metrics.estimatedVolume24h, metrics.marketCapUsd, metrics.sharesOutstanding, metrics.sharesFloat,
        metrics.volatility, metrics.dividendYield, metrics.healthScore, now
      );

      // Grant founder retained equity shares to creating nation (100% - Float %)
      const founderShares = metrics.sharesOutstanding - metrics.sharesFloat;
      if (founderShares > 0) {
        db.prepare(`
          INSERT INTO portfolios (nation_id, asset_id, quantity, average_buy_price_usd, total_dividends_earned_usd)
          VALUES (?, ?, ?, ?, 0)
        `).run(nation.id, assetId, founderShares, metrics.initialPriceUsd);
      }

      // Seed initial candles
      const intervalMs = 60 * 1000;
      let prevClose = metrics.initialPriceUsd * 0.98;
      for (let i = 25; i >= 0; i--) {
        const candleTime = now - (i * intervalMs);
        const randVariation = (Math.random() - 0.49) * metrics.volatility * 0.3;
        const open = prevClose;
        const close = +(open * (1 + randVariation)).toFixed(2);
        const high = +(Math.max(open, close) * 1.003).toFixed(2);
        const low = +(Math.min(open, close) * 0.997).toFixed(2);
        const volume = Math.floor(Math.random() * (metrics.estimatedVolume24h / 50) + 10);

        db.prepare(`
          INSERT INTO price_candles (asset_id, timeframe, timestamp, open, high, low, close, volume)
          VALUES (?, '1m', ?, ?, ?, ?, ?, ?)
        `).run(assetId, candleTime, open, high, low, close, volume);
        prevClose = close;
      }

      // Broadcast IPO News event
      const newsId = uuidv4();
      db.prepare(`
        INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
        VALUES (?, ?, ?, ?, 'EARNINGS', 0.08, ?)
      `).run(
        newsId, assetId,
        `IPO Launch: ${name.trim()} (${cleanTicker}) Debuts on Global Exchange`,
        `Founded in ${nation.name}, ${name.trim()} officially begins public stock trading with an initial valuation of $${(metrics.marketCapUsd / 1000000).toFixed(1)}M USD.`,
        now
      );
    });

    createTx();

    const createdAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);

    res.json({
      message: `IPO successful! ${createdAsset.name} (${createdAsset.ticker}) is now live.`,
      asset: createdAsset,
      founderShares: metrics.sharesOutstanding - metrics.sharesFloat
    });
  } catch (err) {
    console.error('Create company error:', err);
    res.status(500).json({ error: 'Failed to launch company IPO' });
  }
});

// Launch Fictional Cryptocurrency Token
router.post('/crypto/create', authenticateNation, (req, res) => {
  try {
    const { tokenName, ticker, category, description, supplyTier = 2, hypeLevel = 3, stakingYield = 5 } = req.body;
    const nation = req.nation;

    if (!tokenName || !tokenName.trim()) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    if (!ticker || !ticker.trim()) {
      return res.status(400).json({ error: 'Token ticker is required' });
    }

    const cleanTicker = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanTicker.length < 2 || cleanTicker.length > 6) {
      return res.status(400).json({ error: 'Ticker must be 2 to 6 alphanumeric characters' });
    }

    const existingTicker = db.prepare('SELECT id FROM assets WHERE UPPER(ticker) = ?').get(cleanTicker);
    if (existingTicker) {
      return res.status(400).json({ error: `Ticker '${cleanTicker}' is already taken` });
    }

    const supplies = {
      1: 1000000,       // 1 Million
      2: 21000000,      // 21 Million
      3: 100000000,     // 100 Million
      4: 1000000000,    // 1 Billion
      5: 100000000000   // 100 Billion
    };

    const maxSupply = supplies[supplyTier] || 21000000;
    
    // Initial token price based on supply and hype
    const basePrices = {
      1: 50.0,
      2: 12.50,
      3: 2.20,
      4: 0.35,
      5: 0.0042
    };

    const hypeMult = 0.5 + (Number(hypeLevel) * 0.3);
    const initialPrice = +(basePrices[supplyTier] * hypeMult).toFixed(4);
    const marketCap = +(initialPrice * maxSupply).toFixed(2);
    const volatility = 0.08 + (Number(hypeLevel) * 0.03); // High crypto volatility
    const yieldRate = +(Math.max(0, Math.min(25, Number(stakingYield))) / 100).toFixed(4);
    const now = Date.now();
    const assetId = `crypto_${uuidv4().substring(0, 8)}`;

    const createTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO assets (
          id, ticker, name, type, nation_id, nation_name, sector, description,
          current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
          volume_24h, market_cap_usd, shares_outstanding, shares_float,
          volatility, dividend_yield, health_score, created_at
        ) VALUES (
          ?, ?, ?, 'crypto', ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 70, ?
        )
      `).run(
        assetId, cleanTicker, tokenName.trim(), nation.id, nation.name, category || 'Cryptocurrency', description || '',
        initialPrice, initialPrice, initialPrice, initialPrice,
        Math.floor(maxSupply * 0.05), marketCap, maxSupply, Math.floor(maxSupply * 0.8),
        volatility, yieldRate, now
      );

      // Founder mint bonus (10% of supply)
      const founderTokens = Math.floor(maxSupply * 0.1);
      db.prepare(`
        INSERT INTO portfolios (nation_id, asset_id, quantity, average_buy_price_usd, total_dividends_earned_usd)
        VALUES (?, ?, ?, ?, 0)
      `).run(nation.id, assetId, founderTokens, initialPrice);

      // Seed initial candles
      const intervalMs = 60 * 1000;
      let prevClose = initialPrice * 0.95;
      for (let i = 25; i >= 0; i--) {
        const candleTime = now - (i * intervalMs);
        const randVariation = (Math.random() - 0.48) * volatility * 0.5;
        const open = prevClose;
        const close = +(open * (1 + randVariation)).toFixed(4);
        const high = +(Math.max(open, close) * 1.008).toFixed(4);
        const low = +(Math.min(open, close) * 0.992).toFixed(4);
        const volume = Math.floor(Math.random() * (maxSupply * 0.001) + 100);

        db.prepare(`
          INSERT INTO price_candles (asset_id, timeframe, timestamp, open, high, low, close, volume)
          VALUES (?, '1m', ?, ?, ?, ?, ?, ?)
        `).run(assetId, candleTime, open, high, low, close, volume);
        prevClose = close;
      }

      // News event
      const newsId = uuidv4();
      db.prepare(`
        INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
        VALUES (?, ?, ?, ?, 'CRYPTO', 0.15, ?)
      `).run(
        newsId, assetId,
        `Token Genesis: ${tokenName.trim()} (${cleanTicker}) Minted by ${nation.name}`,
        `A new sovereign cryptocurrency protocol has launched with an initial staking yield of ${(yieldRate * 100).toFixed(1)}%.`,
        now
      );
    });

    createTx();

    const createdToken = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);

    res.json({
      message: `Token genesis successful! ${createdToken.name} (${createdToken.ticker}) is now live.`,
      asset: createdToken
    });
  } catch (err) {
    console.error('Create crypto error:', err);
    res.status(500).json({ error: 'Failed to mint cryptocurrency token' });
  }
});

module.exports = router;
