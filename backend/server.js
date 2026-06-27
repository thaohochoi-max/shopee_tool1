require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const { extractShopeeUrl, buildAffiliateLink } = require('./services/shopeeAffiliate');
const { handleWebhook } = require('./services/telegramBot');

// Health check
app.get('/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Telegram Webhook (dùng trên Vercel/cloud)
app.post('/webhook/telegram', async (req, res) => {
  res.json({ ok: true });
  if (req.body) await handleWebhook(req.body).catch(console.error);
});

// Facebook Messenger webhook
app.use('/webhook/facebook', require('./routes/facebook'));

// Convert link Shopee → affiliate
app.post('/api/convert', (req, res) => {
  const { content, subId } = req.body || {};
  if (!content) return res.status(400).json({ success:false, message:'Thiếu link Shopee.' });
  const originUrl = extractShopeeUrl(content);
  if (!originUrl) return res.status(400).json({ success:false, message:'Link không hợp lệ.' });
  res.json({ success:true, data: buildAffiliateLink(originUrl, subId||null) });
});

// Admin API
app.post('/admin/order', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET) return res.status(401).json({ error:'Unauthorized' });
  const { zalo_user_id, order_code, amount, cashback_pct=5, order_date } = req.body||{};
  if (!zalo_user_id||!order_code||!amount) return res.status(400).json({ error:'Missing fields' });
  const db = require('./services/database');
  const userId = db.upsertUser(zalo_user_id, '', '');
  const cashback = Math.floor(amount * cashback_pct / 100);
  db.insertOrder(userId, order_code, amount, cashback, order_date||new Date().toISOString().split('T')[0]);
  res.json({ ok:true, order_code, cashback });
});

app.get('/admin/withdrawals', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET) return res.status(401).json({ error:'Unauthorized' });
  res.json(require('./services/database').getPendingWithdrawals());
});

app.patch('/admin/withdrawals/:id/complete', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_SECRET) return res.status(401).json({ error:'Unauthorized' });
  require('./services/database').completeWithdrawal(Number(req.params.id));
  res.json({ ok:true });
});

// Chạy local: dùng polling
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Server: http://localhost:${PORT}`);
  });
  require('./services/telegramBot').startPolling();
}

// Vercel cần export app
module.exports = app;
