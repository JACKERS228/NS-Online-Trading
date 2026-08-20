const { createClient } = require('@libsql/client');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// Determine database target: Cloud (Turso / LibSQL) or Local File
const forceLocal = process.env.USE_LOCAL_DB === 'true' || process.env.DB_MODE === 'local';
const isCloudDb = !forceLocal && Boolean(process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL);
const localDbPath = `file:${path.join(__dirname, 'trading_simulation.db').replace(/\\/g, '/')}`;
const dbUrl = isCloudDb ? (process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL) : localDbPath;
const authToken = isCloudDb ? (process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN) : undefined;

console.log(`[Database] Mode: ${isCloudDb ? 'Encrypted Cloud Database (Turso)' : 'Local File Database (trading_simulation.db)'}`);

const client = createClient({
  url: dbUrl,
  authToken: authToken,
});

class SecureDatabaseManager {
  constructor() {
    this.client = client;
    this.isReady = false;
  }

  async init() {
    await this.createTables();
    await this.seedInitialData();
    this.isReady = true;
    console.log(`[Database] Schema verified and security rules enforced.`);
  }

  // Parameterized query returning multiple rows
  async all(sql, args = []) {
    const res = await this.client.execute({ sql, args });
    return res.rows.map(row => ({ ...row }));
  }

  // Parameterized query returning single row
  async get(sql, args = []) {
    const res = await this.client.execute({ sql, args });
    if (res.rows.length === 0) return null;
    return { ...res.rows[0] };
  }

  // Parameterized query for INSERT/UPDATE/DELETE
  async run(sql, args = []) {
    const res = await this.client.execute({ sql, args });
    return {
      changes: res.rowsAffected,
      lastInsertRowid: res.lastInsertRowid
    };
  }

  // Atomic batch transaction
  async batch(statements) {
    return await this.client.batch(statements, 'write');
  }

  async createTables() {
    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS nations (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        currency_name TEXT NOT NULL DEFAULT 'Credits',
        currency_symbol TEXT NOT NULL DEFAULT '¤',
        usd_exchange_rate REAL NOT NULL DEFAULT 1.0,
        cash_balance_usd REAL NOT NULL DEFAULT 100000.0,
        starting_balance_usd REAL NOT NULL DEFAULT 100000.0,
        created_at INTEGER NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS assets (
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
      );`,

      `CREATE TABLE IF NOT EXISTS price_candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nation_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        average_buy_price_usd REAL NOT NULL DEFAULT 0,
        total_dividends_earned_usd REAL NOT NULL DEFAULT 0,
        UNIQUE(nation_id, asset_id)
      );`,

      `CREATE TABLE IF NOT EXISTS orders (
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
      );`,

      `CREATE TABLE IF NOT EXISTS news_events (
        id TEXT PRIMARY KEY,
        asset_id TEXT,
        headline TEXT NOT NULL,
        detail TEXT NOT NULL,
        category TEXT NOT NULL,
        impact_factor REAL NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS auctions (
        id TEXT PRIMARY KEY,
        seller_nation_id TEXT NOT NULL,
        seller_nation_name TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        starting_bid_usd REAL NOT NULL,
        current_bid_usd REAL NOT NULL,
        highest_bidder_nation_id TEXT,
        highest_bidder_nation_name TEXT,
        buyout_price_usd REAL,
        collectible_id TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS collectibles (
        id TEXT PRIMARY KEY,
        owner_nation_id TEXT NOT NULL,
        original_creator_nation_id TEXT,
        original_creator_nation_name TEXT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        acquisition_price_usd REAL NOT NULL,
        estimated_value_usd REAL NOT NULL,
        is_listed_for_auction INTEGER NOT NULL DEFAULT 0,
        acquired_at INTEGER NOT NULL
      );`,

      `CREATE TABLE IF NOT EXISTS auction_bids (
        id TEXT PRIMARY KEY,
        auction_id TEXT NOT NULL,
        bidder_nation_id TEXT NOT NULL,
        bidder_nation_name TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );`
    ], 'write');
  }

  async seedInitialData() {
    const res = await this.get('SELECT COUNT(*) as count FROM assets');
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
        dividend_yield: 0.045,
        health_score: 88,
        created_at: now
      },

      // Starter Companies
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

    const statements = [];

    for (const asset of initialAssets) {
      statements.push({
        sql: `INSERT INTO assets (
          id, ticker, name, type, nation_id, nation_name, sector, description,
          current_price_usd, open_price_24h_usd, high_24h_usd, low_24h_usd,
          volume_24h, market_cap_usd, shares_outstanding, shares_float,
          volatility, dividend_yield, health_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          asset.id, asset.ticker, asset.name, asset.type, asset.nation_id, asset.nation_name, asset.sector, asset.description,
          asset.current_price_usd, asset.open_price_24h_usd, asset.high_24h_usd, asset.low_24h_usd,
          asset.volume_24h, asset.market_cap_usd, asset.shares_outstanding, asset.shares_float,
          asset.volatility, asset.dividend_yield, asset.health_score, asset.created_at
        ]
      });

      // 30 initial candles
      const basePrice = asset.current_price_usd;
      let prevClose = basePrice * 0.96;
      const intervalMs = 60 * 1000;

      for (let i = 30; i >= 0; i--) {
        const candleTime = now - (i * intervalMs);
        const changePercent = (Math.random() - 0.49) * asset.volatility * 0.4;
        const open = prevClose;
        const close = Math.max(0.01, +(open * (1 + changePercent)).toFixed(2));
        const high = +(Math.max(open, close) * 1.004).toFixed(2);
        const low = +(Math.min(open, close) * 0.996).toFixed(2);
        const volume = Math.floor(Math.random() * (asset.volume_24h / 400) + 50);

        statements.push({
          sql: `INSERT INTO price_candles (asset_id, timeframe, timestamp, open, high, low, close, volume)
                VALUES (?, '1m', ?, ?, ?, ?, ?, ?)`,
          args: [asset.id, candleTime, open, high, low, close, volume]
        });
        prevClose = close;
      }
    }

    // Seed News
    statements.push({
      sql: `INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuidv4(),
        'comm_oil',
        'Global Energy Commission Forecasts Sustained Demand',
        'Surging demand in industrial manufacturing drives steady baseline accumulation of crude oil reserves across major trading blocs.',
        'COMMODITY',
        0.025,
        now - 3600000
      ]
    });

    statements.push({
      sql: `INSERT INTO news_events (id, asset_id, headline, detail, category, impact_factor, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        uuidv4(),
        'crypto_sov',
        'SoverCoin Staking Treasury Passes Milestone Yield Target',
        'Autonomous smart-contracts distribute protocol dividends to sovereign liquidity providers as on-chain adoption rises.',
        'CRYPTO',
        0.048,
        now - 1800000
      ]
    });

    await this.client.batch(statements, 'write');
  }
}

const db = new SecureDatabaseManager();

module.exports = db;
