'use strict';

const express = require('express');
const axios   = require('axios');
const { extractShopeeUrl, containsShopeeLink, buildAffiliateLink } = require('../services/shopeeAffiliate');
const { processCommand } = require('../services/commandProcessor');

const router = express.Router();
const PAGE_TOKEN   = process.env.FB_PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'shopee_webhook_2026';
const FB_API       = 'https://graph.facebook.com/v19.0/me/messages';

router.get('/', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    console.log('[Facebook] Webhook xác thực ✅');
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.status(403).send('Forbidden');
});

router.post('/', (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
  if (req.body.object !== 'page') return;
  for (const entry of req.body.entry||[]) {
    for (const event of entry.messaging||[]) {
      if (!event.message || event.message.is_echo) continue;
      handleMessage(event.sender.id, event.message.text||'').catch(console.error);
    }
  }
});

async function handleMessage(senderId, text) {
  const t = text.trim();
  if (!t) return;
  try {
    if (/^(\/start|xin ch[àa]o|hello|hi)$/i.test(t)) {
      await send(senderId, '👋 Chào bạn!\n\n🛒 Gửi link Shopee → nhận link có cashback!\n\nLệnh:\n• #donhang\n• #vitien\n• #thongtin_mbbank0123456789\n• #thongtin\n• #ruttien_50000');
      return;
    }
    if (t.startsWith('#')) { await send(senderId, await processCommand(senderId, '', '', t)); return; }
    if (containsShopeeLink(t)) {
      const link = buildAffiliateLink(extractShopeeUrl(t), senderId);
      await send(senderId, `🛍️ Link mua sắm của bạn:\n\n${link}\n\n✅ Mua qua link này nhận cashback!\n💰 Dùng #vitien xem số dư.`);
      return;
    }
    await send(senderId, '💡 Gửi link Shopee để nhận link cashback, hoặc gõ #vitien để xem số dư.');
  } catch (err) { console.error('[Facebook]', err.message); }
}

async function send(recipientId, text) {
  if (!PAGE_TOKEN) { console.log('[Facebook] (dev)', text.slice(0,60)); return; }
  await axios.post(FB_API, { recipient:{id:recipientId}, message:{text} }, { params:{access_token:PAGE_TOKEN} });
}

module.exports = router;
