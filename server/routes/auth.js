const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'ns-market-super-secret-key-2026';

// Middleware to authenticate JWT
async function authenticateNation(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Session missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const nation = await db.get('SELECT * FROM nations WHERE id = ?', [decoded.nationId]);
    if (!nation) {
      return res.status(401).json({ error: 'Nation not found' });
    }
    req.nation = nation;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

// Sign In or Register Nation with PIN
router.post('/register-or-login', async (req, res) => {
  try {
    const { nationName, pin, currencyName, currencySymbol, usdExchangeRate } = req.body;

    if (!nationName || !nationName.trim()) {
      return res.status(400).json({ error: 'Nation name is required' });
    }

    if (!pin || pin.length < 4) {
      return res.status(400).json({ error: 'PIN / Password must be at least 4 characters' });
    }

    const trimmedName = nationName.trim();
    const existing = await db.get('SELECT * FROM nations WHERE LOWER(name) = LOWER(?)', [trimmedName]);

    if (existing) {
      // Authenticate with PIN using bcrypt timing-safe comparison
      const isMatch = await bcrypt.compare(pin, existing.pin_hash);
      if (!isMatch) {
        return res.status(401).json({
          error: 'Incorrect PIN for this Nation. If you registered previously, enter your correct PIN.'
        });
      }

      const token = jwt.sign({ nationId: existing.id, nationName: existing.name }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({
        message: `Welcome back, ${existing.name}!`,
        token,
        nation: {
          id: existing.id,
          name: existing.name,
          currency_name: existing.currency_name,
          currency_symbol: existing.currency_symbol,
          usd_exchange_rate: existing.usd_exchange_rate,
          cash_balance_usd: existing.cash_balance_usd,
          starting_balance_usd: existing.starting_balance_usd,
          created_at: existing.created_at
        },
        securityReminder: 'Security reminder: Never reuse your official NationStates account password or secret PIN.'
      });
    } else {
      // Register new nation
      const pinHash = await bcrypt.hash(pin, 10);
      const newNationId = uuidv4();
      const currName = (currencyName && currencyName.trim()) ? currencyName.trim() : 'Credits';
      const currSymbol = (currencySymbol && currencySymbol.trim()) ? currencySymbol.trim() : '¤';
      const exchangeRate = (usdExchangeRate && !isNaN(usdExchangeRate) && usdExchangeRate > 0) ? Number(usdExchangeRate) : 1.0;
      const initialCapital = 100000.0;
      const now = Date.now();

      await db.run(`
        INSERT INTO nations (
          id, name, pin_hash, currency_name, currency_symbol, usd_exchange_rate,
          cash_balance_usd, starting_balance_usd, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [newNationId, trimmedName, pinHash, currName, currSymbol, exchangeRate, initialCapital, initialCapital, now]);

      const createdNation = await db.get('SELECT * FROM nations WHERE id = ?', [newNationId]);
      const token = jwt.sign({ nationId: createdNation.id, nationName: createdNation.name }, JWT_SECRET, { expiresIn: '30d' });

      return res.json({
        message: `Nation '${createdNation.name}' successfully registered!`,
        token,
        nation: {
          id: createdNation.id,
          name: createdNation.name,
          currency_name: createdNation.currency_name,
          currency_symbol: createdNation.currency_symbol,
          usd_exchange_rate: createdNation.usd_exchange_rate,
          cash_balance_usd: createdNation.cash_balance_usd,
          starting_balance_usd: createdNation.starting_balance_usd,
          created_at: createdNation.created_at
        },
        securityReminder: 'Security reminder: Never reuse your official NationStates account password or secret PIN.'
      });
    }
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Server authentication error' });
  }
});

// Get current nation profile and fresh balance
router.get('/me', authenticateNation, async (req, res) => {
  try {
    const nation = req.nation;

    // Calculate total portfolio asset value in USD
    const holdings = await db.all(`
      SELECT p.quantity, a.current_price_usd 
      FROM portfolios p
      JOIN assets a ON p.asset_id = a.id
      WHERE p.nation_id = ? AND p.quantity > 0
    `, [nation.id]);

    const portfolioValueUsd = holdings.reduce((sum, h) => sum + (h.quantity * h.current_price_usd), 0);
    const netWorthUsd = +(nation.cash_balance_usd + portfolioValueUsd).toFixed(2);

    res.json({
      nation: {
        id: nation.id,
        name: nation.name,
        currency_name: nation.currency_name,
        currency_symbol: nation.currency_symbol,
        usd_exchange_rate: nation.usd_exchange_rate,
        cash_balance_usd: nation.cash_balance_usd,
        portfolio_value_usd: +portfolioValueUsd.toFixed(2),
        net_worth_usd: netWorthUsd,
        starting_balance_usd: nation.starting_balance_usd,
        created_at: nation.created_at
      }
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to fetch nation profile' });
  }
});

// Update Nation Currency & USD Exchange Rate Settings
router.post('/update-currency', authenticateNation, async (req, res) => {
  try {
    const { currencyName, currencySymbol, usdExchangeRate } = req.body;

    if (!currencyName || !currencyName.trim()) {
      return res.status(400).json({ error: 'Currency name is required' });
    }
    if (!currencySymbol || !currencySymbol.trim()) {
      return res.status(400).json({ error: 'Currency symbol is required' });
    }
    const rate = Number(usdExchangeRate);
    if (isNaN(rate) || rate <= 0) {
      return res.status(400).json({ error: 'Exchange rate must be a positive number' });
    }

    await db.run(`
      UPDATE nations SET
        currency_name = ?,
        currency_symbol = ?,
        usd_exchange_rate = ?
      WHERE id = ?
    `, [currencyName.trim(), currencySymbol.trim(), rate, req.nation.id]);

    const updated = await db.get('SELECT * FROM nations WHERE id = ?', [req.nation.id]);

    res.json({
      message: 'Currency settings updated successfully',
      nation: updated
    });
  } catch (err) {
    console.error('Update currency error:', err);
    res.status(500).json({ error: 'Failed to update currency settings' });
  }
});

// Reset Sandbox for current nation
router.post('/reset-sandbox', authenticateNation, async (req, res) => {
  try {
    const nationId = req.nation.id;
    const initialCash = req.nation.starting_balance_usd || 100000.0;

    await db.batch([
      { sql: 'DELETE FROM portfolios WHERE nation_id = ?', args: [nationId] },
      { sql: 'DELETE FROM orders WHERE nation_id = ?', args: [nationId] },
      { sql: 'UPDATE nations SET cash_balance_usd = ? WHERE id = ?', args: [initialCash, nationId] }
    ]);

    res.json({
      message: 'Sandbox successfully reset to default starting balance of $100,000 USD',
      cash_balance_usd: initialCash
    });
  } catch (err) {
    console.error('Reset sandbox error:', err);
    res.status(500).json({ error: 'Failed to reset sandbox' });
  }
});

// List all registered nations & their forex exchange rates
router.get('/nations', async (req, res) => {
  try {
    const nations = await db.all(`
      SELECT 
        n.id, n.name, n.currency_name, n.currency_symbol, n.usd_exchange_rate,
        n.cash_balance_usd, n.created_at,
        COALESCE(SUM(p.quantity * a.current_price_usd), 0) as portfolio_value_usd
      FROM nations n
      LEFT JOIN portfolios p ON n.id = p.nation_id
      LEFT JOIN assets a ON p.asset_id = a.id
      GROUP BY n.id
      ORDER BY (n.cash_balance_usd + COALESCE(SUM(p.quantity * a.current_price_usd), 0)) DESC
    `);

    const formatted = nations.map(n => ({
      id: n.id,
      name: n.name,
      currency_name: n.currency_name,
      currency_symbol: n.currency_symbol,
      usd_exchange_rate: n.usd_exchange_rate,
      cash_balance_usd: n.cash_balance_usd,
      portfolio_value_usd: +Number(n.portfolio_value_usd).toFixed(2),
      net_worth_usd: +(Number(n.cash_balance_usd) + Number(n.portfolio_value_usd)).toFixed(2),
      created_at: n.created_at
    }));

    res.json({ nations: formatted });
  } catch (err) {
    console.error('Fetch nations error:', err);
    res.status(500).json({ error: 'Failed to fetch nations directory' });
  }
});

module.exports = { router, authenticateNation };
