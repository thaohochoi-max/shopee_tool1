'use strict';

const db = require('./database');

const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const fmtDate = d => { const x=new Date(d); return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`; };

function parseCommand(text) {
  const raw = (text||'').trim();
  if (/^#donhang$/i.test(raw)) return { cmd:'donhang' };
  if (/^#vitien$/i.test(raw))  return { cmd:'vitien' };
  if (/^#thongtin$/i.test(raw)) return { cmd:'thongtin_get' };
  const save = raw.match(/^#thongtin_([a-zA-Z]+)(\d{6,20})$/i);
  if (save) return { cmd:'thongtin_save', bankAlias:save[1], accountNumber:save[2] };
  const rut = raw.match(/^#ruttien_(\d+)$/i);
  if (rut) return { cmd:'ruttien', amount:parseInt(rut[1],10) };
  return { cmd:'unknown', original:raw };
}

function handleDonHang(userId) {
  const orders = db.getYesterdayOrders(userId);
  const d = new Date(); d.setDate(d.getDate()-1);
  if (!orders.length) return `Bạn chưa có đơn hàng ngày ${fmtDate(d)} 😊\n\nHãy mua qua link của chúng mình để tích cashback nhé!`;
  return `🛍️ Đơn hàng ngày ${fmtDate(d)}:\n` + orders.map(o=>`• ${o.order_code} – ${fmt(o.amount)}`).join('\n') + '\n\n💰 Cashback đã được cộng vào ví!';
}

function handleViTien(userId) {
  const w = db.getWallet(userId);
  const can = w.balance >= db.MIN_WITHDRAWAL;
  return `💚 Số tiền tiết kiệm của bạn:\n\n💰 ${fmt(w.balance)}\n\n` + (can ? `✅ Có thể rút ngay!\nDùng: #ruttien_[số tiền]` : `⚠️ Cần tối thiểu ${fmt(db.MIN_WITHDRAWAL)} để rút.\nCòn thiếu ${fmt(db.MIN_WITHDRAWAL - w.balance)}`);
}

function handleThongTinSave(userId, bankAlias, accountNumber) {
  const bankName = db.normalizeBankName(bankAlias);
  db.saveBankAccount(userId, bankName, accountNumber);
  return `✅ Đã lưu thành công!\n\n🏦 Ngân hàng: ${bankName}\n📋 Số TK: ${accountNumber}\n\nDùng #thongtin để kiểm tra.`;
}

function handleThongTinGet(userId) {
  const bank = db.getBankAccount(userId);
  if (!bank) return `❌ Chưa lưu thông tin ngân hàng.\n\nDùng lệnh:\n#thongtin_[ngânhàng][stk]\n\nVí dụ: #thongtin_mbbank0660999999`;
  return `🏦 Thông tin tài khoản:\n\n• Ngân hàng: ${bank.bank_name}\n• Số TK: ${bank.account_number}\n• Trạng thái: ✅ Đã lưu`;
}

function handleRutTien(userId, amount) {
  if (!amount || isNaN(amount) || amount <= 0) return `❌ Số tiền không hợp lệ.\nVí dụ: #ruttien_50000`;
  const r = db.createWithdrawal(userId, amount);
  if (!r.ok) {
    if (r.reason === 'insufficient_balance') return `❌ Số dư không đủ.\n\nSố dư: ${fmt(r.balance)}\nYêu cầu: ${fmt(amount)}\n\nDùng #vitien để kiểm tra.`;
    if (r.reason === 'below_minimum') return `❌ Tối thiểu ${fmt(r.minimum)}. Bạn yêu cầu ${fmt(amount)}.`;
    if (r.reason === 'no_bank_account') return `❌ Chưa lưu ngân hàng.\n\nDùng: #thongtin_mbbank0660999999`;
  }
  return `✅ Yêu cầu rút ${fmt(r.amount)} đã tiếp nhận!\n\n🏦 ${r.bank_name} – ${r.account_number}\n\n⏱ Tiền về trong 5–15 phút.`;
}

async function processCommand(userId, displayName, avatarUrl, text) {
  const internalId = db.upsertUser(userId, displayName, avatarUrl);
  const parsed = parseCommand(text);
  switch (parsed.cmd) {
    case 'donhang':      return handleDonHang(internalId);
    case 'vitien':       return handleViTien(internalId);
    case 'thongtin_save': return handleThongTinSave(internalId, parsed.bankAlias, parsed.accountNumber);
    case 'thongtin_get': return handleThongTinGet(internalId);
    case 'ruttien':      return handleRutTien(internalId, parsed.amount);
    default: return `❓ Không hiểu lệnh "${parsed.original}".\n\n#donhang | #vitien | #thongtin | #ruttien_[số]`;
  }
}

module.exports = { processCommand, parseCommand };
