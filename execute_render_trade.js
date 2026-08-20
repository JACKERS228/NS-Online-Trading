const { createClient } = require('./server/node_modules/@libsql/client');
const dotenv = require('./server/node_modules/dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server/.env') });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function executeTradeAndVerify() {
  const BASE_URL = 'https://ns-online-trading.onrender.com';
  console.log('1. Signing in as Imperial Dominion of Solaria on Render...');
  
  const loginRes = await fetch(`${BASE_URL}/api/auth/register-or-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nationName: 'Imperial Dominion of Solaria',
      pin: '2026'
    })
  });

  const loginData = await loginRes.json();
  console.log('   ✓ Sign in result:', loginData.message);
  const token = loginData.token;

  console.log('\n2. Executing live BUY order for 10 GOLD on Render production...');
  const orderRes = await fetch(`${BASE_URL}/api/trade/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ticker: 'GOLD',
      side: 'BUY',
      quantity: 10
    })
  });

  const orderData = await orderRes.json();
  console.log('   ✓ Trade Execution Result:', orderData.message);

  console.log('\n3. Directly querying Turso cloud database for the new trade & portfolio...');
  const orders = await client.execute("SELECT o.side, o.quantity, o.execution_price_usd, o.total_usd, o.timestamp, a.ticker, n.name as nation_name FROM orders o JOIN assets a ON o.asset_id = a.id JOIN nations n ON o.nation_id = n.id WHERE n.name = 'Imperial Dominion of Solaria'");
  console.log(`   ✓ Found ${orders.rows.length} trade(s) in Turso for Imperial Dominion of Solaria:`);
  orders.rows.forEach(o => {
    console.log(`     • ${o.nation_name}: ${o.side} ${o.quantity} ${o.ticker} @ $${Number(o.execution_price_usd).toFixed(2)} (Total: $${Number(o.total_usd).toFixed(2)} USD)`);
  });

  const holdings = await client.execute("SELECT p.quantity, p.average_buy_price_usd, a.ticker, n.name as nation_name FROM portfolios p JOIN assets a ON p.asset_id = a.id JOIN nations n ON p.nation_id = n.id WHERE n.name = 'Imperial Dominion of Solaria'");
  console.log(`   ✓ Found ${holdings.rows.length} holding(s) in Turso:`);
  holdings.rows.forEach(h => {
    console.log(`     • ${h.nation_name} owns: ${h.quantity} units of ${h.ticker} @ avg $${Number(h.average_buy_price_usd).toFixed(2)} USD`);
  });
}

executeTradeAndVerify();
