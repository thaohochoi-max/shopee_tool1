'use strict';

const URL_RX = /(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/gi;

function extractShopeeUrl(text) {
  const matches = (text || '').match(URL_RX) || [];
  const found   = matches.find(u => /shopee|shp\.ee|shope\.ee/.test(u));
  if (!found) return null;
  return found.startsWith('http') ? found : 'https://' + found;
}

function containsShopeeLink(text) { return extractShopeeUrl(text) !== null; }

function buildAffiliateLink(originUrl, subId) {
  const affiliateId = process.env.SHOPEE_AFFILIATE_ID;
  const sub         = subId || process.env.SHOPEE_SUB_ID || 'default';
  return `https://s.shopee.vn/an_redir?origin_link=${encodeURIComponent(originUrl)}&affiliate_id=${affiliateId}&sub_id=${sub}`;
}

module.exports = { extractShopeeUrl, containsShopeeLink, buildAffiliateLink };
