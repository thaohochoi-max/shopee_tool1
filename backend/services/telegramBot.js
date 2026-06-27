'use strict';

const axios = require('axios');
const { processCommand }   = require('./commandProcessor');
const { containsShopeeLink, extractShopeeUrl, buildAffiliateLink } = require('./shopeeAffiliate');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API   = `https://api.telegram.org/bot${TOKEN}`;
let lastUpdateId = 0;

async function sendMessage(chatId, text) {
  await axios.post(`${API}/sendMessage`, { chat_id: chatId, text, parse_mode: 'HTML' });
}

async function handleUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const chatId      = msg.chat.id;
  const userId      = String(msg.from.id);
  const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');
  const text        = msg.text.trim();
  try {
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, '👋 Chào <b>' + displayName + '</b>!\n\n🛒 Gửi link Shopee → nhận link có cashback\n\n<b>Lệnh:</b>\n• <code>#donhang</code> — đơn hàng hôm qua\n• <code>#vitien</code> — số dư cashback\n• <code>#thongtin_mbbank0123456789</code> — lưu ngân hàng\n• <code>#thongtin</code> — xem ngân hàng\n• <code>#ruttien_50000</code> — rút tiền');
      return;
    }
    if (text.startsWith('#')) { await sendMessage(chatId, await processCommand(userId, displayName, '', text)); return; }
    if (containsShopeeLink(text)) {
      const link = buildAffiliateLink(extractShopeeUrl(text), userId);
      await sendMessage(chatId, `🛍️ <b>Link affiliate:</b>\n\n${link}\n\n✅ Mua qua link này nhận cashback!\n💰 Dùng <code>#vitien</code> để xem số dư.`);
      return;
    }
    await sendMessage(chatId, '💡 Gửi link Shopee hoặc gõ <code>/help</code> để xem hướng dẫn.');
  } catch (err) {
    console.error('[Telegram]', err.message);
    try { await sendMessage(chatId, '⚠️ Lỗi. Thử lại sau.'); } catch {}
  }
}

async function startPolling() {
  if (!TOKEN) { console.warn('[Telegram] Chưa có TELEGRAM_BOT_TOKEN'); return; }
  try {
    const { data } = await axios.get(`${API}/getMe`);
    console.log(`[Telegram] @${data.result.username} đã kết nối ✅`);
  } catch (err) { console.error('[Telegram] Token lỗi:', err.message); return; }
  console.log('[Telegram] Đang lắng nghe...');
  while (true) {
    try {
      const { data } = await axios.get(`${API}/getUpdates`, { params: { offset: lastUpdateId+1, timeout:30 }, timeout: 35000 });
      for (const u of data.result||[]) { lastUpdateId = u.update_id; handleUpdate(u).catch(console.error); }
    } catch (err) {
      if (err.code !== 'ECONNABORTED' && err.code !== 'ETIMEDOUT') { console.error('[Telegram] Poll:', err.message); await new Promise(r=>setTimeout(r,5000)); }
    }
  }
}

module.exports = { startPolling };
