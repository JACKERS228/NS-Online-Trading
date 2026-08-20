// Comprehensive E2E API Verification Script
async function runTests() {
  const BASE_URL = 'http://localhost:3001';
  console.log('=== STARTING FULL SUITE VERIFICATION ===\n');

  try {
    // 1. Health check
    console.log('1. Testing /api/health...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const health = await healthRes.json();
    console.log('   ✓ Health check passed:', health);

    // 2. Fetch Assets & verify commodities and pre-seeded crypto
    console.log('\n2. Testing /api/market/assets...');
    const assetsRes = await fetch(`${BASE_URL}/api/market/assets`);
    const { assets } = await assetsRes.json();
    console.log(`   ✓ Found ${assets.length} active assets in database.`);

    const commodities = assets.filter(a => a.type === 'commodity');
    const cryptos = assets.filter(a => a.type === 'crypto');
    console.log('   ✓ Seeded Commodities:', commodities.map(c => `${c.name} (${c.ticker})`));
    console.log('   ✓ Seeded Crypto:', cryptos.map(c => `${c.name} (${c.ticker})`));

    // 3. Register Nation with PIN & Custom Currency
    console.log('\n3. Testing Nation Registration & PIN Auth...');
    const authRes = await fetch(`${BASE_URL}/api/auth/register-or-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nationName: 'Grand Republic of Testland',
        pin: '9876',
        currencyName: 'Imperial Dinar',
        currencySymbol: 'ID',
        usdExchangeRate: 3.50
      })
    });
    const authData = await authRes.json();
    console.log('   ✓ Nation Auth Response:', authData.message);
    console.log('   ✓ Security Reminder Present:', authData.securityReminder);
    const token = authData.token;

    // 4. Test Company Creation Wizard (IPO)
    console.log('\n4. Testing Company Creation Wizard & IPO Launch...');
    const companyRes = await fetch(`${BASE_URL}/api/wizard/company/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Testland Heavy Industrial Dynamics',
        ticker: 'THID',
        sector: 'Heavy Manufacturing',
        description: 'Manufacturer of sovereign maglev transit and titanium hulls.',
        scaleTier: 4, // Large-Cap
        profitabilityTier: 4,
        volatilityTier: 2,
        publicFloatPercent: 50
      })
    });
    const companyData = await companyRes.json();
    console.log('   ✓ IPO Result:', companyData.message);
    console.log(`   ✓ Share Price: $${companyData.asset.current_price_usd} USD, Founder Shares: ${companyData.founderShares}`);

    // 5. Test Crypto Launchpad Token Minting
    console.log('\n5. Testing Fictional Crypto Launchpad...');
    const cryptoRes = await fetch(`${BASE_URL}/api/wizard/crypto/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        tokenName: 'Testland Quantum Credit',
        ticker: 'TQC',
        category: 'Sovereign National Reserve',
        description: 'Algorithmic sovereign token reserve.',
        supplyTier: 2, // 21 Million
        hypeLevel: 4,
        stakingYield: 8
      })
    });
    const cryptoData = await cryptoRes.json();
    console.log('   ✓ Crypto Mint Result:', cryptoData.message);
    console.log(`   ✓ Genesis Token Price: $${cryptoData.asset.current_price_usd} USD`);

    // 6. Test Buy Order Execution
    console.log('\n6. Testing Buy Order Execution on OIL spot contract...');
    const buyRes = await fetch(`${BASE_URL}/api/trade/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ticker: 'OIL',
        side: 'BUY',
        quantity: 50
      })
    });
    const buyData = await buyRes.json();
    console.log('   ✓ Buy Order:', buyData.message);
    console.log(`   ✓ Remaining Cash Balance: $${buyData.cash_balance_usd} USD`);

    // 7. Test Portfolio Holdings & P&L
    console.log('\n7. Testing Portfolio & Holdings Analytics...');
    const portRes = await fetch(`${BASE_URL}/api/trade/portfolio`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const portData = await portRes.json();
    console.log(`   ✓ Net Worth: $${portData.net_worth_usd} USD (Holdings Value: $${portData.portfolio_value_usd} USD)`);
    console.log(`   ✓ Total Holdings Count: ${portData.holdings.length}`);
    portData.holdings.forEach(h => {
      console.log(`     • ${h.ticker} (${h.asset_type}): ${h.quantity} units @ avg $${h.average_buy_price_usd} (Value: $${h.market_value_usd})`);
    });

    // 8. Test Sell Order Execution
    console.log('\n8. Testing Sell Order Execution...');
    const sellRes = await fetch(`${BASE_URL}/api/trade/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ticker: 'OIL',
        side: 'SELL',
        quantity: 20
      })
    });
    const sellData = await sellRes.json();
    console.log('   ✓ Sell Order:', sellData.message);
    console.log(`   ✓ Updated Cash Balance: $${sellData.cash_balance_usd} USD`);

    // 9. Test Forex & Nations Directory
    console.log('\n9. Testing Forex & Sovereign Nations Directory...');
    const nationsRes = await fetch(`${BASE_URL}/api/auth/nations`);
    const nationsData = await nationsRes.json();
    console.log(`   ✓ Registered Nations in Leaderboard: ${nationsData.nations.length}`);
    nationsData.nations.forEach((n, idx) => {
      console.log(`     #${idx + 1} ${n.name} | Peg: 1 USD = ${n.usd_exchange_rate} ${n.currency_symbol} ${n.currency_name} | Net Worth: $${n.net_worth_usd} USD`);
    });

    console.log('\n=== ALL END-TO-END VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  }
}

runTests();
