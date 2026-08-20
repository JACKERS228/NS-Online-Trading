const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'trading_simulation.db');

class SQLiteDatabase {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.saveTimeout = null;
  }

  async init() {
    this.SQL = await initSqlJs();

    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      this.db = new this.SQL.Database(fileBuffer);
    } else {
      this.db = new this.SQL.Database();
    }

    this.createTables();
    this.seedInitialData();
    this.saveImmediate();
  }

  save() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate();
      this.saveTimeout = null;
    }, 1000);
  }

  saveImmediate() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('[DB] Failed to persist database to disk:', err);
    }
  }

  exec(sql) {
    this.db.run(sql);
    this.save();
  }

  prepare(sql) {
    const self = this;

    function normalizeParams(params) {
      if (!params || params.length === 0) return [];
      if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
        // Named parameter object: map @prop or :prop or $prop to values
        const obj = params[0];
        const res = {};
        for (const [key, val] of Object.entries(obj)) {
          const cleanKey = key.startsWith('@') || key.startsWith(':') || key.startsWith('$') ? key : `@${key}`;
          res[cleanKey] = val === undefined ? null : val;
        }
        return res;
      }
      return params;
    }

    return {
      run(...params) {
        const p = normalizeParams(params);
        try {
          self.db.run(sql, p);
          self.save();
          return { changes: self.db.getRowsModified() };
        } catch (err) {
          throw err;
        }
      },
      get(...params) {
        const p = normalizeParams(params);
        let stmt;
        try {
          stmt = self.db.prepare(sql);
          if (Array.isArray(p)) {
            stmt.bind(p);
          } else {
            stmt.bind(p);
          }
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return null;
        } catch (err) {
          if (stmt) stmt.free();
          throw err;
        }
      },
      all(...params) {
        const p = normalizeParams(params);
        let stmt;
        try {
          stmt = self.db.prepare(sql);
          if (Array.isArray(p)) {
            stmt.bind(p);
          } else {
            stmt.bind(p);
          }
          const rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        } catch (err) {
          if (stmt) stmt.free();
          throw err;
        }
      }
    };
  }

  transaction(fn) {
    return (...args) => {
      this.db.run('BEGIN TRANSACTION;');
      try {
        const result = fn(...args);
        this.db.run('COMMIT;');
        this.save();
        return result;
      } catch (err) {
        this.db.run('ROLLBACK;');
        throw err;
      }
    };
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS nations (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        currency_name TEXT NOT NULL DEFAULT 'Credits',
        currency_symbol TEXT NOT NULL DEFAULT '¤',
        usd_exchange_rate REAL NOT NULL DEFAULT 1.0,
        cash_balance_usd REAL NOT NULL DEFAULT 100000.0,
        starting_balance_usd REAL NOT NULL DEFAULT 100000.0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        ticker TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        nation_id TEXT,
        nation_name TEXT,
        sector TEXT NOT NULL,
        description TEXT,
        current_price_usd REAL NOT NULL,
        open_price_24h_usd REAL NOT NULL,
        high_24h_usd REAL NOT NULL,
        low_24h_usd REAL NOT NULL,
        volume_24h REAL NOT NULL DEFAULT 0,
        market_cap_usd REAL NOT NULL DEFAULT 0,
        shares_outstanding REAL NOT NULL DEFAULT 0,
        shares_float REAL NOT NULL DEFAULT 0,
        volatility REAL NOT NULL DEFAULT 0.05,
        dividend_yield REAL NOT NULL DEFAULT 0.0,
        health_score REAL NOT NULL DEFAULT 50,
        is_delisted INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS price_candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nation_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        average_buy_price_usd REAL NOT NULL DEFAULT 0,
        total_dividends_earned_usd REAL NOT NULL DEFAULT 0,
        UNIQUE(nation_id, asset_id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        nation_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        side TEXT NOT NULL,
        type TEXT NOT NULL,
        target_price_usd REAL,
        execution_price_usd REAL NOT NULL,
        quantity REAL NOT NULL,
        total_usd REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'FILLED',
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS news_events (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        headline TEXT NOT NULL,
        detail TEXT NOT NULL,
        category TEXT NOT NULL,
        impact_factor REAL NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL
      );
    `);
  }

  seedInitialData() {
    const res = this.prepare('SELECT COUNT(*) as count FROM assets').get();
    if (res && res.count > 0) return;

    const now = Date.now();

    const initialAssets = [
      // Commodities
      {
        id: 'comm_oil',
        ticker: 'OIL',
        name: 'Oil',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Energy',
        description: 'Standard benchmark crude petroleum barrel contract.',
        current_price_usd: 78.45,
        open_price_24h_usd: 77.90,
        high_24h_usd: 79.80,
        low_24h_usd: 77.20,
        volume_24h: 12500000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.035,
        dividend_yield: 0.0,
        health_score: 80,
        created_at: now
      },
      {
        id: 'comm_gold',
        ticker: 'GOLD',
        name: 'Gold',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Metals',
        description: 'Refined .9999 fine investment-grade bullion troy ounce.',
        current_price_usd: 2380.00,
        open_price_24h_usd: 2365.50,
        high_24h_usd: 2395.00,
        low_24h_usd: 2360.00,
        volume_24h: 38000000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.018,
        dividend_yield: 0.0,
        health_score: 95,
        created_at: now
      },
      {
        id: 'comm_uranium',
        ticker: 'URNM',
        name: 'Uranium',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Nuclear & Defense',
        description: 'Nuclear energy grade triuranium octoxide (U3O8) kilogram units.',
        current_price_usd: 88.20,
        open_price_24h_usd: 86.50,
        high_24h_usd: 90.10,
        low_24h_usd: 85.80,
        volume_24h: 8900000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.055,
        dividend_yield: 0.0,
        health_score: 75,
        created_at: now
      },
      {
        id: 'comm_coal',
        ticker: 'COAL',
        name: 'Coal',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Energy',
        description: 'High-grade thermal and metallurgical coal metric ton futures.',
        current_price_usd: 135.50,
        open_price_24h_usd: 136.00,
        high_24h_usd: 138.20,
        low_24h_usd: 134.10,
        volume_24h: 6200000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.03,
        dividend_yield: 0.0,
        health_score: 65,
        created_at: now
      },
      {
        id: 'comm_wheat',
        ticker: 'WHT',
        name: 'Wheat',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Agriculture',
        description: 'Global agricultural food reserve standard bushel contract.',
        current_price_usd: 5.65,
        open_price_24h_usd: 5.58,
        high_24h_usd: 5.78,
        low_24h_usd: 5.50,
        volume_24h: 4500000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.04,
        dividend_yield: 0.0,
        health_score: 70,
        created_at: now
      },
      {
        id: 'comm_titanium',
        ticker: 'TITN',
        name: 'Titanium',
        type: 'commodity',
        nation_id: null,
        nation_name: 'Global Market',
        sector: 'Aerospace & Industrial',
        description: 'Aerospace-grade purified titanium sponge metric ton.',
        current_price_usd: 6850.00,
        open_price_24h_usd: 6800.00,
        high_24h_usd: 6920.00,
        low_24h_usd: 6780.00,
        volume_24h: 15400000,
        market_cap_usd: 0,
        shares_outstanding: 0,
        shares_float: 0,
        volatility: 0.025,
        dividend_yield: 0.0,
        health_score: 85,
        created_at: now
      },

      // Single Pre-seeded Crypto (SoverCoin)
      {
        id: 'crypto_sov',
        ticker: 'SOV',
        name: 'SoverCoin',
        type: 'crypto',
        nation_id: null,
        nation_name: 'Autonomous DAO',
        sector: 'Cryptocurrency',
        description: 'The foundational decentralized sovereign reserve cryptocurrency of the NationStates multiverse.',
        current_price_usd: 342.80,
        open_price_24h_usd: 330.00,
        high_24h_usd: 365.00,
        low_24h_usd: 320.50,
        volume_24h: 54000000,
        market_cap_usd: 7198800000,
        shares_outstanding: 21000000,
        shares_float: 16800000,
        volatility: 0.09,
        dividend_yield: 0.045, // 4.5% staking yield
        health_score: 88,
        created_at: now
      },

      // Seed Starter Companies
      {
        id: 'stock_aegis',
        ticker: 'AGIS',
        name: 'Aegis Defense Dynamics',
        type: 'stock',
        nation_id: null,
        nation_name: 'Federal Republic of Testland',
        sector: 'Defense & Aerospace',
        description: 'Manufacturer of advanced hypersonic interceptors, naval cruisers, and sovereign border defense grids.',
        current_price_usd: 142.50,
        open_price_24h_usd: 139.80,
        high_24h_usd: 144.20,
        low_24h_usd: 138.50,
        volume_24h: 18200000,
        market_cap_usd: 14250000000,
        shares_outstanding: 100000000,
        shares_float: 65000000,
        volatility: 0.04,
        dividend_yield: 0.032,
        health_score: 85,
        created_at: now
      },
      {
        id: 'stock_omni',
        ticker: 'OMNI',
        name: 'OmniSilicon Cybernetics',
        type: 'stock',
        nation_id: null,
        nation_name: 'Technocratic Union',
        sector: 'Technology & AI',
        description: 'Pioneers in quantum microprocessors, autonomous neural networks, and automated industrial robotics.',
        current_price_usd: 310.20,
        open_price_24h_usd: 295.00,
        high_24h_usd: 318.50,
        low_24h_usd: 292.00,
        volume_24h: 42000000,
        market_cap_usd: 46530000000,
        shares_outstanding: 150000000,
        shares_float: 105000000,
        volatility: 0.075,
        dividend_yield: 0.012,
        health_score: 92,
        created_at: now
      },
      {
        id: 'stock_terra',
        ticker: 'TERA',
        name: 'TerraHydro Global Energy',
        type: 'stock',
        nation_id: null,
        nation_name: 'Grand Duchy of Auroria',
        sector: 'Energy & Utilities',
        description: 'Major regional provider of synthetic fuels, nuclear fusion power plants, and trans-continental grids.',
        current_price_usd: 64.75,
        open_price_24h_usd: 65.20,
        high_24h_usd: 66.10,
        low_24h_usd: 64.00,
        volume_24h: 9400000,
        market_cap_usd: 8093750000,
        shares_outstanding: 125000000,
        shares_float: 75000000,
        volatility: 0.028,
        dividend_yield: 0.052,
        health_score: 78,
        created_at: now
      },
      {
        id: 'stock_vital',
        ticker: 'VTLX',
        name: 'Vitalis BioPharma Group',
        type: 'stock',
        nation_id: null,
        nation_name: 'United Provinces of Valoria',
        sector: 'Healthcare & Pharma',
        description: 'Developer of cellular regeneration therapies, universal antivirals, and bio-engineered medical solutions.',
        current_price_usd: 88.60,
        open_price_24h_usd: 84.10,
        high_24h_usd: 91.00,
        low_24h_usd: 83.50,
        volume_24h: 14600000,
        market_cap_usd: 5316000000,
        shares_outstanding: 60000000,
        shares_float: 42000000,
        volatility: 0.062,
        dividend_yield: 0.024,
        health_score: 80,
        created_at: now
      }
    ];

    for (const asset of initialAssets) {
      this.prepare(`
        INSERT INTO assets (
          id, ticker, name, type, nation_id, nation_name, sector, description,
          current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
          volume_24h, market_cap_usd, shares_outstanding, shares_float,
          volatility, dividend_yield, health_score, created_at
        ) VALUES (
          @id, @ticker, @name, @type, @nation_id, @nation_name, @sector, @description,
          @current_price_usd, @open_price_24h_usd, @high_24h_usd, @low_24h_usd,
          @volume_24h, @market_cap_usd, @shares_outstanding, @shares_float,
          @volatility, @dividend_yield, @health_score, @created_at
        )
      `).run(asset);

      // Generate 40 initial 1m historical candles
      const basePrice = asset.current_price_usd;
      let prevClose = basePrice * 0.96;
      const intervalMs = 60 * 1000;

      for (let i = 40; i >= 0; i--) {
        const candleTime = now - (i * intervalMs);
        const changePercent = (Math.random() - 0.49) * asset.volatility * 0.4;
        const open = prevClose;
        const close = Math.max(0.01, +(open * (1 + changePercent)).toFixed(2));
        const high = +(Math.max(open, close) * 1.004).toFixed(2);
        const low = +(Math.min(open, close) * 0.996).toFixed(2);
        const volume = Math.floor(Math.random() * (asset.volume_24h / 400) + 50);

        this.prepare(`
          INSERT INTO price_candles (asset_id, timeframe, timestamp, open, high, low, close, volume)
          VALUES (@asset_id, '1m', @timestamp, @open, @high, @low, @close, @volume)
        `).run({
          asset_id: asset.id,
          timestamp: candleTime,
          open,
          high,
          low,
          close,
          volume
        });
        prevClose = close;
      }
    }

    // Seed initial news items
    this.prepare(`
      INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
      VALUES (@id, @asset_id, @headline, @detail, @category, @impact_factor, @timestamp)
    `).run({
      id: uuidv4(),
      asset_id: 'comm_oil',
      headline: 'Global Energy Commission Forecasts Sustained Demand',
      detail: 'Surging demand in industrial manufacturing drives steady baseline accumulation of crude oil reserves across major trading blocs.',
      category: 'COMMODITY',
      impact_factor: 0.025,
      timestamp: now - 3600000
    });

    this.prepare(`
      INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
      VALUES (@id, @asset_id, @headline, @detail, @category, @impact_factor, @timestamp)
    `).run({
      id: uuidv4(),
      asset_id: 'crypto_sov',
      headline: 'SoverCoin Staking Treasury Passes Milestone Yield Target',
      detail: 'Autonomous smart-contracts distribute protocol dividends to sovereign liquidity providers as on-chain adoption rises.',
      category: 'CRYPTO',
      impact_factor: 0.048,
      timestamp: now - 1800000
    });

    this.prepare(`
      INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
      VALUES (@id, @asset_id, @headline, @detail, @category, @impact_factor, @timestamp)
    `).run({
      id: uuidv4(),
      asset_id: 'stock_omni',
      headline: 'OmniSilicon Announces Breakthrough Neural Co-Processor',
      detail: 'Commercial testing yields a 40% efficiency boost in autonomous computation, sparking institutional accumulation.',
      category: 'EARNINGS',
      impact_factor: 0.052,
      timestamp: now - 900000
    });
  }
}

const instance = new SQLiteDatabase();

module.exports = instance;
