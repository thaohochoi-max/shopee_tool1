'use strict';

const fs   = require('fs');
const path = require('path');

// Vercel filesystem is read-only except /tmp
const DB_FILE = process.env.VERCEL
  ? '/tmp/db.json'
  : path.join(__dirname, '../data/db.json');

const BANK_ALIASES = {
  mbbank:'MB Bank', mb:'MB Bank', vcb:'Vietcombank', vietcombank:'Vietcombank',
  tcb:'Techcombank', techcombank:'Techcombank', acb:'ACB', bidv:'BIDV',
  agribank:'Agribank', tpbank:'TPBank', vpbank:'VPBank', sacombank:'Sacombank',
  vib:'VIB', msb:'MSB', ocb:'OCB', shb:'SHB', hdbank:'HDBank',
  seabank:'SeABank', vietinbank:'VietinBank', icb:'VietinBank', cake:'Cake by VPBank',
};

const MIN_WITHDRAWAL = 50_000;

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return initDB();
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return initDB(); }
}
function initDB() { return { users:[], wallets:[], orders:[], bank_accounts:[], withdrawals:[] }; }
function saveDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function nextId(arr) { return arr.length === 0 ? 1 : Math.max(...arr.map(r => r.id)) + 1; }
function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().split('T')[0]; }

function upsertUser(userId, displayName, avatarUrl) {
  const db = loadDB();
  let user = db.users.find(u => u.zalo_user_id === userId);
  if (user) {
    user.display_name = displayName || user.display_name;
  } else {
    user = { id: nextId(db.users), zalo_user_id: userId, display_name: displayName||'', avatar_url: avatarUrl||'', created_at: now() };
    db.users.push(user);
    db.wallets.push({ id: nextId(db.wallets), user_id: user.id, balance:0, total_earned:0, total_withdrawn:0 });
  }
  saveDB(db);
  return user.id;
}

function getYesterdayOrders(userId) {
  const db = loadDB();
  const d = new Date(); d.setDate(d.getDate()-1);
  const dateStr = d.toISOString().split('T')[0];
  return db.orders.filter(o => o.user_id === userId && o.order_date === dateStr);
}

function insertOrder(userId, orderCode, amount, cashback, orderDate) {
  const db = loadDB();
  if (db.orders.find(o => o.order_code === orderCode)) return;
  db.orders.push({ id: nextId(db.orders), user_id: userId, order_code: orderCode, amount, cashback, status:'confirmed', order_date: orderDate||today(), created_at: now() });
  const w = db.wallets.find(w => w.user_id === userId);
  if (w) { w.balance += cashback; w.total_earned += cashback; }
  saveDB(db);
}

function getWallet(userId) {
  const db = loadDB();
  return db.wallets.find(w => w.user_id === userId) || { balance:0, total_earned:0, total_withdrawn:0 };
}

function saveBankAccount(userId, bankName, accountNumber) {
  const db = loadDB();
  const ex = db.bank_accounts.find(b => b.user_id === userId);
  if (ex) { ex.bank_name = bankName; ex.account_number = accountNumber; ex.saved_at = now(); }
  else db.bank_accounts.push({ id: nextId(db.bank_accounts), user_id: userId, bank_name: bankName, account_number: accountNumber, saved_at: now() });
  saveDB(db);
}

function getBankAccount(userId) {
  return loadDB().bank_accounts.find(b => b.user_id === userId) || null;
}

function normalizeBankName(alias) {
  return BANK_ALIASES[alias.toLowerCase().replace(/\s+/g,'')] || alias.toUpperCase();
}

function createWithdrawal(userId, amount) {
  const wallet = getWallet(userId);
  if (wallet.balance < amount) return { ok:false, reason:'insufficient_balance', balance:wallet.balance };
  if (amount < MIN_WITHDRAWAL) return { ok:false, reason:'below_minimum', minimum:MIN_WITHDRAWAL };
  const bank = getBankAccount(userId);
  if (!bank) return { ok:false, reason:'no_bank_account' };
  const db = loadDB();
  db.withdrawals.push({ id: nextId(db.withdrawals), user_id: userId, amount, bank_name: bank.bank_name, account_number: bank.account_number, status:'pending', requested_at: now(), processed_at: null });
  const w = db.wallets.find(w => w.user_id === userId);
  if (w) { w.balance -= amount; w.total_withdrawn += amount; }
  saveDB(db);
  return { ok:true, bank_name: bank.bank_name, account_number: bank.account_number, amount };
}

function getPendingWithdrawals() {
  const db = loadDB();
  return db.withdrawals.filter(w => w.status==='pending').map(w => {
    const user = db.users.find(u => u.id === w.user_id);
    return { ...w, zalo_user_id: user?.zalo_user_id };
  });
}

function completeWithdrawal(id) {
  const db = loadDB();
  const w = db.withdrawals.find(w => w.id === id);
  if (w) { w.status = 'completed'; w.processed_at = now(); }
  saveDB(db);
}

module.exports = { upsertUser, getYesterdayOrders, insertOrder, getWallet, saveBankAccount, getBankAccount, normalizeBankName, createWithdrawal, getPendingWithdrawals, completeWithdrawal, MIN_WITHDRAWAL };
