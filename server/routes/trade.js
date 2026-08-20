const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateNation } = require('./auth');

// Execute a Trade (BUY or SELL)
router.post('/order', authenticateNation, async (req, res) => {
  try {
    const { assetId, ticker, side, quantity } = req.body;
    const nation = req.nation;

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    const orderSide = (side || '').toUpperCase();
    if (orderSide !== 'BUY' && orderSide !== 'SELL') {
      return res.status(400).json({ error: 'Side must be BUY or SELL' });
    }

    // Find asset
    let asset;
    if (assetId) {
      asset = await db.get('SELECT * FROM assets WHERE id = ? AND is_delisted = 0', [assetId]);
    } else if (ticker) {
      asset = await db.get('SELECT * FROM assets WHERE UPPER(ticker) = UPPER(?) AND is_delisted = 0', [ticker]);
    }

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found or delisted' });
    }

    const price = Number(asset.current_price_usd);
    const totalCostUsd = +(price * qty).toFixed(2);

    let portfolioRecord = await db.get('SELECT * FROM portfolios WHERE nation_id = ? AND asset_id = ?', [nation.id, asset.id]);
    const freshNation = await db.get('SELECT cash_balance_usd FROM nations WHERE id = ?', [nation.id]);

    const batchStatements = [];

    if (orderSide === 'BUY') {
      if (freshNation.cash_balance_usd < totalCostUsd) {
        return res.status(400).json({
          error: `Insufficient funds: Order requires $${totalCostUsd.toLocaleString()} USD, but cash balance is $${Number(freshNation.cash_balance_usd).toLocaleString()} USD`
        });
      }

      // Deduct cash
      batchStatements.push({
        sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd - ? WHERE id = ?',
        args: [totalCostUsd, nation.id]
      });

      if (portfolioRecord) {
        const oldTotalCost = Number(portfolioRecord.quantity) * Number(portfolioRecord.average_buy_price_usd);
        const newQty = Number(portfolioRecord.quantity) + qty;
        const newAvgPrice = +((oldTotalCost + totalCostUsd) / newQty).toFixed(4);

        batchStatements.push({
          sql: 'UPDATE portfolios SET quantity = ?, average_buy_price_usd = ? WHERE id = ?',
          args: [newQty, newAvgPrice, portfolioRecord.id]
        });
      } else {
        batchStatements.push({
          sql: 'INSERT INTO portfolios (nation_id, asset_id, quantity, average_buy_price_usd, total_dividends_earned_usd) VALUES (?, ?, ?, ?, 0)',
          args: [nation.id, asset.id, qty, price]
        });
      }
    } else {
      // SELL
      if (!portfolioRecord || Number(portfolioRecord.quantity) < qty) {
        const available = portfolioRecord ? Number(portfolioRecord.quantity) : 0;
        return res.status(400).json({
          error: `Insufficient holdings: You own ${available} units of ${asset.ticker}, cannot sell ${qty}`
        });
      }

      // Add cash
      batchStatements.push({
        sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
        args: [totalCostUsd, nation.id]
      });

      const remainingQty = Number(portfolioRecord.quantity) - qty;
      if (remainingQty <= 0.000001) {
        batchStatements.push({
          sql: 'DELETE FROM portfolios WHERE id = ?',
          args: [portfolioRecord.id]
        });
      } else {
        batchStatements.push({
          sql: 'UPDATE portfolios SET quantity = ? WHERE id = ?',
          args: [remainingQty, portfolioRecord.id]
        });
      }
    }

    // Record order history
    const orderId = uuidv4();
    batchStatements.push({
      sql: `INSERT INTO orders (id, nation_id, asset_id, side, type, execution_price_usd, quantity, total_usd, status, timestamp)
            VALUES (?, ?, ?, ?, 'MARKET', ?, ?, ?, 'FILLED', ?)`,
      args: [orderId, nation.id, asset.id, orderSide, price, qty, totalCostUsd, Date.now()]
    });

    // Update asset 24h volume
    batchStatements.push({
      sql: 'UPDATE assets SET volume_24h = volume_24h + ? WHERE id = ?',
      args: [qty, asset.id]
    });

    // Execute atomically
    await db.batch(batchStatements);

    // Return updated balance & position
    const updatedNation = await db.get('SELECT cash_balance_usd FROM nations WHERE id = ?', [nation.id]);
    const updatedPosition = await db.get('SELECT * FROM portfolios WHERE nation_id = ? AND asset_id = ?', [nation.id, asset.id]);

    res.json({
      message: `Successfully executed ${orderSide} order for ${qty} ${asset.ticker} at $${price.toFixed(2)} USD`,
      cash_balance_usd: updatedNation.cash_balance_usd,
      position: updatedPosition || { quantity: 0, average_buy_price_usd: 0 },
      trade: {
        ticker: asset.ticker,
        side: orderSide,
        quantity: qty,
        price_usd: price,
        total_usd: totalCostUsd
      }
    });
  } catch (err) {
    console.error('Trade order error:', err);
    res.status(500).json({ error: 'Failed to execute order: ' + err.message });
  }
});

// Get nation's complete portfolio
router.get('/portfolio', authenticateNation, async (req, res) => {
  try {
    const nationId = req.nation.id;

    const holdings = await db.all(`
      SELECT 
        p.id as portfolio_id,
        p.asset_id,
        p.quantity,
        p.average_buy_price_usd,
        p.total_dividends_earned_usd,
        a.ticker,
        a.name as asset_name,
        a.type as asset_type,
        a.sector,
        a.current_price_usd,
        a.open_price_24h_usd,
        a.dividend_yield
      FROM portfolios p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.nation_id = ? AND p.quantity > 0
      ORDER BY (p.quantity * a.current_price_usd) DESC
    `, [nationId]);

    let totalPortfolioValueUsd = 0;
    let totalUnrealizedPnlUsd = 0;
    let totalInvestedUsd = 0;

    const formattedHoldings = holdings.map(h => {
      const marketValueUsd = +(Number(h.quantity) * Number(h.current_price_usd)).toFixed(2);
      const costBasisUsd = +(Number(h.quantity) * Number(h.average_buy_price_usd)).toFixed(2);
      const pnlUsd = +(marketValueUsd - costBasisUsd).toFixed(2);
      const pnlPercent = costBasisUsd > 0 ? +((pnlUsd / costBasisUsd) * 100).toFixed(2) : 0;

      totalPortfolioValueUsd += marketValueUsd;
      totalInvestedUsd += costBasisUsd;
      totalUnrealizedPnlUsd += pnlUsd;

      return {
        ...h,
        market_value_usd: marketValueUsd,
        cost_basis_usd: costBasisUsd,
        unrealized_pnl_usd: pnlUsd,
        unrealized_pnl_percent: pnlPercent
      };
    });

    const freshNation = await db.get('SELECT cash_balance_usd, currency_name, currency_symbol, usd_exchange_rate, starting_balance_usd FROM nations WHERE id = ?', [nationId]);
    const netWorthUsd = +(Number(freshNation.cash_balance_usd) + totalPortfolioValueUsd).toFixed(2);
    const totalAllTimePnlUsd = +(netWorthUsd - Number(freshNation.starting_balance_usd)).toFixed(2);
    const totalAllTimePnlPercent = freshNation.starting_balance_usd > 0 
      ? +((totalAllTimePnlUsd / Number(freshNation.starting_balance_usd)) * 100).toFixed(2) 
      : 0;

    res.json({
      cash_balance_usd: freshNation.cash_balance_usd,
      portfolio_value_usd: +totalPortfolioValueUsd.toFixed(2),
      net_worth_usd: netWorthUsd,
      total_invested_usd: +totalInvestedUsd.toFixed(2),
      total_unrealized_pnl_usd: +totalUnrealizedPnlUsd.toFixed(2),
      total_all_time_pnl_usd: totalAllTimePnlUsd,
      total_all_time_pnl_percent: totalAllTimePnlPercent,
      holdings: formattedHoldings
    });
  } catch (err) {
    console.error('Portfolio error:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get trade execution history
router.get('/history', authenticateNation, async (req, res) => {
  try {
    const orders = await db.all(`
      SELECT 
        o.id, o.side, o.type, o.execution_price_usd, o.quantity, o.total_usd, o.status, o.timestamp,
        a.ticker, a.name as asset_name, a.type as asset_type
      FROM orders o
      JOIN assets a ON o.asset_id = a.id
      WHERE o.nation_id = ?
      ORDER BY o.timestamp DESC
      LIMIT 50
    `, [req.nation.id]);

    res.json({ orders });
  } catch (err) {
    console.error('Trade history error:', err);
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

module.exports = router;
