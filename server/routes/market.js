const express = require('express');
const router = express.Router();
const db = require('../db');
const engine = require('../engine/simulation');

// Get all assets with 24h performance metrics
router.get('/assets', (req, res) => {
  try {
    const assets = db.prepare(`
      SELECT 
        id, ticker, name, type, nation_id, nation_name, sector, description,
        current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
        volume_24h, market_cap_usd, shares_outstanding, shares_float,
        volatility, dividend_yield, health_score, created_at,
        ROUND(((current_price_usd - open_price_24h_usd) / open_price_24h_usd) * 100, 2) as change_24h
      FROM assets 
      WHERE is_delisted = 0 
      ORDER BY 
        CASE type 
          WHEN 'stock' THEN 1 
          WHEN 'commodity' THEN 2 
          WHEN 'crypto' THEN 3 
          ELSE 4 
        END,
        market_cap_usd DESC,
        current_price_usd DESC
    `).all();

    res.json({ assets });
  } catch (err) {
    console.error('Fetch assets error:', err);
    res.status(500).json({ error: 'Failed to fetch market assets' });
  }
});

// Get single asset details by ticker
router.get('/asset/:ticker', (req, res) => {
  try {
    const { ticker } = req.params;
    const asset = db.prepare(`
      SELECT 
        id, ticker, name, type, nation_id, nation_name, sector, description,
        current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
        volume_24h, market_cap_usd, shares_outstanding, shares_float,
        volatility, dividend_yield, health_score, created_at,
        ROUND(((current_price_usd - open_price_24h_usd) / open_price_24h_usd) * 100, 2) as change_24h
      FROM assets 
      WHERE UPPER(ticker) = UPPER(?) AND is_delisted = 0
    `).get(ticker);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const recentNews = db.prepare(`
      SELECT * FROM news_events 
      WHERE asset_id = ? OR asset_id IS NULL 
      ORDER BY timestamp DESC 
      LIMIT 5
    `).all(asset.id);

    const recentOrders = db.prepare(`
      SELECT o.*, n.name as nation_name 
      FROM orders o
      JOIN nations n ON o.nation_id = n.id
      WHERE o.asset_id = ?
      ORDER BY o.timestamp DESC
      LIMIT 10
    `).all(asset.id);

    res.json({
      asset,
      recentNews,
      recentOrders
    });
  } catch (err) {
    console.error('Fetch asset error:', err);
    res.status(500).json({ error: 'Failed to fetch asset details' });
  }
});

// Get historical candles for charting
router.get('/candles/:ticker', (req, res) => {
  try {
    const { ticker } = req.params;
    const timeframe = req.query.timeframe || '1m';
    const limit = Math.min(parseInt(req.query.limit) || 100, 300);

    const asset = db.prepare('SELECT id FROM assets WHERE UPPER(ticker) = UPPER(?)').get(ticker);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const candles = db.prepare(`
      SELECT timestamp, open, high, low, close, volume 
      FROM price_candles 
      WHERE asset_id = ? AND timeframe = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(asset.id, timeframe, limit);

    res.json({ ticker: ticker.toUpperCase(), timeframe, candles });
  } catch (err) {
    console.error('Fetch candles error:', err);
    res.status(500).json({ error: 'Failed to fetch chart candles' });
  }
});

// Get latest news items
router.get('/news', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const news = engine.getLatestNews(limit);
    res.json({ news });
  } catch (err) {
    console.error('Fetch news error:', err);
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
});

// Real-time Server-Sent Events (SSE) stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  engine.subscribe(res);
});

module.exports = router;
