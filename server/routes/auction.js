const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateNation } = require('./auth');

// Safe Image URL Validator - Enforces pure HTTP/HTTPS web URLs and strictly rejects binary/base64 data URIs
function validateSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  
  // Reject base64 data URIs or dangerous protocols
  if (trimmed.startsWith('data:') || trimmed.startsWith('javascript:') || trimmed.startsWith('file:')) {
    throw new Error('Image must be a public web URL (http:// or https://), not a direct file upload.');
  }

  // Must match http/https URL
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) {
    throw new Error('Please enter a valid HTTP/HTTPS image URL.');
  }

  return trimmed;
}

// 1. GET /api/auction/active - List all currently active auctions
router.get('/active', async (req, res) => {
  try {
    const now = Date.now();
    const auctions = await db.all(`
      SELECT 
        a.id, a.seller_nation_id, a.seller_nation_name, a.title, a.category,
        a.description, a.image_url, a.starting_bid_usd, a.current_bid_usd,
        a.highest_bidder_nation_id, a.highest_bidder_nation_name, a.buyout_price_usd,
        a.status, a.created_at, a.expires_at,
        (SELECT COUNT(*) FROM auction_bids b WHERE b.auction_id = a.id) as bid_count
      FROM auctions a
      WHERE a.status = 'ACTIVE' AND a.expires_at > ?
      ORDER BY a.expires_at ASC
    `, [now]);

    res.json({ auctions });
  } catch (err) {
    console.error('Fetch active auctions error:', err);
    res.status(500).json({ error: 'Failed to fetch active auctions' });
  }
});

// 2. GET /api/auction/inventory - Fetch authenticated nation's owned collectibles vault
router.get('/inventory', authenticateNation, async (req, res) => {
  try {
    const nationId = req.nation.id;
    const items = await db.all(`
      SELECT * FROM collectibles
      WHERE owner_nation_id = ?
      ORDER BY acquired_at DESC
    `, [nationId]);

    const totalVaultValueUsd = items.reduce((sum, item) => sum + (Number(item.estimated_value_usd) || 0), 0);

    res.json({
      items,
      totalVaultValueUsd: +totalVaultValueUsd.toFixed(2),
      itemCount: items.length
    });
  } catch (err) {
    console.error('Fetch inventory error:', err);
    res.status(500).json({ error: 'Failed to fetch vault inventory' });
  }
});

// 3. GET /api/auction/history - Fetch past / completed auctions
router.get('/history', async (req, res) => {
  try {
    const history = await db.all(`
      SELECT 
        a.id, a.seller_nation_name, a.title, a.category, a.image_url,
        a.current_bid_usd as final_price_usd, a.highest_bidder_nation_name as winner_nation_name,
        a.status, a.expires_at
      FROM auctions a
      WHERE a.status IN ('SOLD', 'EXPIRED')
      ORDER BY a.expires_at DESC
      LIMIT 25
    `);

    res.json({ history });
  } catch (err) {
    console.error('Fetch auction history error:', err);
    res.status(500).json({ error: 'Failed to fetch auction history' });
  }
});

// 4. POST /api/auction/create - Create a new custom auction listing
router.post('/create', authenticateNation, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      imageUrl,
      startingBidUsd,
      buyoutPriceUsd,
      durationMinutes
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Item name is required' });
    }

    const startBid = Number(startingBidUsd);
    if (isNaN(startBid) || startBid <= 0) {
      return res.status(400).json({ error: 'Starting bid must be greater than $0' });
    }

    let buyout = null;
    if (buyoutPriceUsd !== undefined && buyoutPriceUsd !== null && buyoutPriceUsd !== '') {
      buyout = Number(buyoutPriceUsd);
      if (isNaN(buyout) || buyout <= startBid) {
        return res.status(400).json({ error: 'Buyout price must be higher than starting bid' });
      }
    }

    const mins = Math.max(1, Number(durationMinutes) || 60);
    const now = Date.now();
    const expiresAt = now + (mins * 60 * 1000);

    // Validate safe URL without server storage
    let safeImageUrl = null;
    if (imageUrl) {
      safeImageUrl = validateSafeImageUrl(imageUrl);
    }

    const auctionId = `auc_${uuidv4().slice(0, 8)}`;
    const cat = category && category.trim() ? category.trim() : 'Relics & Antiques';
    const desc = description && description.trim() ? description.trim() : '';

    await db.run(`
      INSERT INTO auctions (
        id, seller_nation_id, seller_nation_name, title, category,
        description, image_url, starting_bid_usd, current_bid_usd,
        highest_bidder_nation_id, highest_bidder_nation_name, buyout_price_usd,
        collectible_id, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `, [
      auctionId,
      req.nation.id,
      req.nation.name,
      title.trim(),
      cat,
      desc,
      safeImageUrl,
      startBid,
      startBid,
      null,
      null,
      buyout,
      null,
      now,
      expiresAt
    ]);

    const created = await db.get('SELECT * FROM auctions WHERE id = ?', [auctionId]);

    res.json({
      message: `Auction for '${title.trim()}' is now live!`,
      auction: created
    });
  } catch (err) {
    console.error('Create auction error:', err);
    res.status(400).json({ error: err.message || 'Failed to create auction' });
  }
});

// 5. POST /api/auction/bid - Place a bid on an active auction
router.post('/bid', authenticateNation, async (req, res) => {
  try {
    const { auctionId, bidAmountUsd } = req.body;
    const nation = req.nation;

    if (!auctionId) {
      return res.status(400).json({ error: 'Auction ID is required' });
    }

    const amount = Number(bidAmountUsd);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid bid amount' });
    }

    const auction = await db.get('SELECT * FROM auctions WHERE id = ?', [auctionId]);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'ACTIVE' || auction.expires_at <= Date.now()) {
      return res.status(400).json({ error: 'This auction has ended' });
    }

    if (auction.seller_nation_id === nation.id) {
      return res.status(400).json({ error: 'You cannot bid on your own auction' });
    }

    if (auction.highest_bidder_nation_id === nation.id) {
      return res.status(400).json({ error: 'You are already the highest bidder' });
    }

    const hasBids = Boolean(auction.highest_bidder_nation_id);
    const minRequiredBid = hasBids
      ? +(auction.current_bid_usd + Math.max(1, auction.current_bid_usd * 0.05)).toFixed(2)
      : auction.starting_bid_usd;

    if (amount < minRequiredBid) {
      return res.status(400).json({
        error: `Bid must be at least $${minRequiredBid.toLocaleString()} USD`
      });
    }

    // Check bidder cash
    const bidderNation = await db.get('SELECT cash_balance_usd FROM nations WHERE id = ?', [nation.id]);
    if (bidderNation.cash_balance_usd < amount) {
      return res.status(400).json({
        error: `Insufficient cash ($${Number(bidderNation.cash_balance_usd).toLocaleString()} available)`
      });
    }

    const now = Date.now();
    const batchStatements = [];

    // 1. If there's a previous highest bidder, refund their escrow cash immediately
    if (auction.highest_bidder_nation_id && auction.current_bid_usd > 0) {
      batchStatements.push({
        sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
        args: [auction.current_bid_usd, auction.highest_bidder_nation_id]
      });
    }

    // 2. Deduct new bid from current bidder
    batchStatements.push({
      sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd - ? WHERE id = ?',
      args: [amount, nation.id]
    });

    // 3. Update auction record
    batchStatements.push({
      sql: `UPDATE auctions SET 
              current_bid_usd = ?, 
              highest_bidder_nation_id = ?, 
              highest_bidder_nation_name = ? 
            WHERE id = ?`,
      args: [amount, nation.id, nation.name, auctionId]
    });

    // 4. Record bid in log
    batchStatements.push({
      sql: `INSERT INTO auction_bids (id, auction_id, bidder_nation_id, bidder_nation_name, amount_usd, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [uuidv4(), auctionId, nation.id, nation.name, amount, now]
    });

    await db.batch(batchStatements);

    const updatedAuction = await db.get('SELECT * FROM auctions WHERE id = ?', [auctionId]);
    const updatedBidder = await db.get('SELECT cash_balance_usd FROM nations WHERE id = ?', [nation.id]);

    res.json({
      message: `Bid of $${amount.toLocaleString()} USD placed successfully!`,
      auction: updatedAuction,
      newCashBalanceUsd: updatedBidder.cash_balance_usd
    });
  } catch (err) {
    console.error('Bid error:', err);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// 6. POST /api/auction/buyout - Instant purchase at buyout price
router.post('/buyout', authenticateNation, async (req, res) => {
  try {
    const { auctionId } = req.body;
    const buyer = req.nation;

    if (!auctionId) {
      return res.status(400).json({ error: 'Auction ID is required' });
    }

    const auction = await db.get('SELECT * FROM auctions WHERE id = ?', [auctionId]);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    if (auction.status !== 'ACTIVE' || auction.expires_at <= Date.now()) {
      return res.status(400).json({ error: 'This auction has ended' });
    }

    if (auction.seller_nation_id === buyer.id) {
      return res.status(400).json({ error: 'You cannot buy your own auction item' });
    }

    if (!auction.buyout_price_usd) {
      return res.status(400).json({ error: 'This auction does not have an instant buyout price' });
    }

    const buyoutPrice = auction.buyout_price_usd;
    const buyerNation = await db.get('SELECT cash_balance_usd FROM nations WHERE id = ?', [buyer.id]);

    if (buyerNation.cash_balance_usd < buyoutPrice) {
      return res.status(400).json({
        error: `Insufficient cash ($${Number(buyerNation.cash_balance_usd).toLocaleString()} available)`
      });
    }

    const now = Date.now();
    const batchStatements = [];

    // 1. Refund previous bidder if any
    if (auction.highest_bidder_nation_id && auction.current_bid_usd > 0) {
      batchStatements.push({
        sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
        args: [auction.current_bid_usd, auction.highest_bidder_nation_id]
      });
    }

    // 2. Deduct buyout price from buyer
    batchStatements.push({
      sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd - ? WHERE id = ?',
      args: [buyoutPrice, buyer.id]
    });

    // 3. Credit buyout price to seller
    batchStatements.push({
      sql: 'UPDATE nations SET cash_balance_usd = cash_balance_usd + ? WHERE id = ?',
      args: [buyoutPrice, auction.seller_nation_id]
    });

    // 4. Mark auction SOLD
    batchStatements.push({
      sql: `UPDATE auctions SET 
              status = 'SOLD', 
              current_bid_usd = ?, 
              highest_bidder_nation_id = ?, 
              highest_bidder_nation_name = ? 
            WHERE id = ?`,
      args: [buyoutPrice, buyer.id, buyer.name, auctionId]
    });

    // 5. Transfer item into buyer's Collectibles Vault
    if (auction.collectible_id) {
      // Re-assigned existing collectible
      batchStatements.push({
        sql: `UPDATE collectibles SET 
                owner_nation_id = ?, 
                acquisition_price_usd = ?, 
                estimated_value_usd = ?,
                is_listed_for_auction = 0,
                acquired_at = ?
              WHERE id = ?`,
        args: [buyer.id, buyoutPrice, buyoutPrice, now, auction.collectible_id]
      });
    } else {
      // Brand new item won
      const newCollectibleId = `col_${uuidv4().slice(0, 8)}`;
      batchStatements.push({
        sql: `INSERT INTO collectibles (
                id, owner_nation_id, original_creator_nation_id, original_creator_nation_name,
                title, category, description, image_url, acquisition_price_usd,
                estimated_value_usd, is_listed_for_auction, acquired_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [
          newCollectibleId,
          buyer.id,
          auction.seller_nation_id,
          auction.seller_nation_name,
          auction.title,
          auction.category,
          auction.description,
          auction.image_url,
          buyoutPrice,
          buyoutPrice,
          now
        ]
      });
    }

    await db.batch(batchStatements);

    res.json({
      message: `You bought '${auction.title}' for $${buyoutPrice.toLocaleString()} USD! It is now stored in your Vault.`,
      buyoutPrice
    });
  } catch (err) {
    console.error('Buyout error:', err);
    res.status(500).json({ error: 'Failed to process buyout' });
  }
});

// 7. POST /api/auction/relist - Relist an owned collectible from Vault
router.post('/relist', authenticateNation, async (req, res) => {
  try {
    const { collectibleId, startingBidUsd, buyoutPriceUsd, durationMinutes } = req.body;
    const nation = req.nation;

    if (!collectibleId) {
      return res.status(400).json({ error: 'Collectible item ID is required' });
    }

    const item = await db.get('SELECT * FROM collectibles WHERE id = ? AND owner_nation_id = ?', [collectibleId, nation.id]);
    if (!item) {
      return res.status(404).json({ error: 'Item not found in your vault' });
    }

    if (item.is_listed_for_auction) {
      return res.status(400).json({ error: 'This item is already listed in an active auction' });
    }

    const startBid = Number(startingBidUsd);
    if (isNaN(startBid) || startBid <= 0) {
      return res.status(400).json({ error: 'Starting bid must be greater than $0' });
    }

    let buyout = null;
    if (buyoutPriceUsd !== undefined && buyoutPriceUsd !== null && buyoutPriceUsd !== '') {
      buyout = Number(buyoutPriceUsd);
      if (isNaN(buyout) || buyout <= startBid) {
        return res.status(400).json({ error: 'Buyout price must be higher than starting bid' });
      }
    }

    const mins = Math.max(1, Number(durationMinutes) || 60);
    const now = Date.now();
    const expiresAt = now + (mins * 60 * 1000);
    const auctionId = `auc_${uuidv4().slice(0, 8)}`;

    await db.batch([
      {
        sql: `INSERT INTO auctions (
                id, seller_nation_id, seller_nation_name, title, category,
                description, image_url, starting_bid_usd, current_bid_usd,
                highest_bidder_nation_id, highest_bidder_nation_name, buyout_price_usd,
                collectible_id, status, created_at, expires_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, ?, ?, 'ACTIVE', ?, ?)`,
        args: [
          auctionId, nation.id, nation.name, item.title, item.category,
          item.description, item.image_url, startBid, startBid, buyout,
          collectibleId, now, expiresAt
        ]
      },
      {
        sql: 'UPDATE collectibles SET is_listed_for_auction = 1 WHERE id = ?',
        args: [collectibleId]
      }
    ]);

    res.json({
      message: `'${item.title}' has been listed on the Auction House!`,
      auctionId
    });
  } catch (err) {
    console.error('Relist error:', err);
    res.status(500).json({ error: 'Failed to relist collectible' });
  }
});

module.exports = router;
