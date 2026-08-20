const { createClient } = require('./server/node_modules/@libsql/client');
const dotenv = require('./server/node_modules/dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server/.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function inspectTurso() {
  console.log('=== QUERYING TURSO CLOUD DATABASE DIRECTLY ===\n');
  console.log('Database URL:', process.env.TURSO_DATABASE_URL);

  try {
    // Query Nations
    const nations = await client.execute('SELECT id, name, currency_name, currency_symbol, usd_exchange_rate, cash_balance_usd, created_at FROM nations');
    console.log(`\n📋 Registered Nations in Turso (${nations.rows.length}):`);
    nations.rows.forEach(n => {
      console.log(`   • Nation: "${n.name}" | Currency: ${n.currency_symbol} ${n.currency_name} (Rate: ${n.usd_exchange_rate}) | Balance: $${Number(n.cash_balance_usd).toLocaleString()} USD`);
    });

    // Query Assets
    const assets = await client.execute('SELECT id, ticker, name, type, current_price_usd, volume_24h, market_cap_usd FROM assets');
    console.log(`\n🏢 Assets in Turso (${assets.rows.length}):`);
    assets.rows.forEach(a => {
      console.log(`   • [${a.type.toUpperCase()}] ${a.ticker} (${a.name}): $${Number(a.current_price_usd).toFixed(2)} USD (Vol: ${Number(a.volume_24h).toLocaleString()})`);
    });

    // Query Orders
    const orders = await client.execute('SELECT o.side, o.quantity, o.execution_price_usd, o.total_usd, o.timestamp, a.ticker, n.name as nation_name FROM orders o JOIN assets a ON o.asset_id = a.id JOIN nations n ON o.nation_id = n.id ORDER BY o.timestamp DESC LIMIT 10');
    console.log(`\n📈 Executed Trades in Turso (${orders.rows.length}):`);
    orders.rows.forEach(o => {
      console.log(`   • ${o.nation_name}: ${o.side} ${o.quantity} ${o.ticker} @ $${Number(o.execution_price_usd).toFixed(2)} (Total: $${Number(o.total_usd).toFixed(2)} USD)`);
    });

    // Query Portfolios
    const portfolios = await client.execute('SELECT p.quantity, p.average_buy_price_usd, a.ticker, n.name as nation_name FROM portfolios p JOIN assets a ON p.asset_id = a.id JOIN nations n ON p.nation_id = n.id');
    console.log(`\n💼 Active Portfolios in Turso (${portfolios.rows.length}):`);
    portfolios.rows.forEach(p => {
      console.log(`   • ${p.nation_name}: ${p.quantity} shares of ${p.ticker} @ avg $${Number(p.average_buy_price_usd).toFixed(2)}`);
    });

  } catch (err) {
    console.error('Error querying Turso:', err);
  }
}

inspectTurso();
