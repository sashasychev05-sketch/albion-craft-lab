'use strict';

// The upstream websocket may combine several JSON messages with newlines.
// Keep the original order payload until its price units and server are verified.
function parseMarketMessages(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 4 * 1024 * 1024) throw Error('Invalid market message');
  const messages = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message?.topic !== 'marketorders.ingest') continue;
    if (!Array.isArray(message.data?.Orders) || message.data.Orders.length > 10000) throw Error('Invalid market orders');
    messages.push(message.data.Orders);
  }
  return messages;
}

// Do not combine separate pages into a single best price: a page may be
// sorted differently. Retain individual orders and expire each observation.
function createOrderStore(now = () => Date.now(), ttl = 2 * 60 * 60 * 1000, initial = []) {
  if (!Number.isSafeInteger(ttl) || ttl <= 0) throw Error('Invalid TTL');
  if (!Array.isArray(initial)) throw Error('Invalid stored orders');
  const orders = new Map();
  for (const order of initial) {
    if (!order || !['europe', 'west', 'east'].includes(order.server) || !Number.isSafeInteger(order.id) || order.id <= 0 || !/^[A-Z0-9_@]+$/.test(order.item || '') || !/^\d+$/.test(order.location || '') || !Number.isInteger(order.quality) || order.quality < 1 || order.quality > 5 || !['offer', 'request'].includes(order.type) || !Number.isSafeInteger(order.price) || order.price <= 0 || !Number.isSafeInteger(order.amount) || order.amount <= 0 || !Number.isFinite(order.observedAt)) throw Error('Invalid stored order');
    orders.set(`${order.server}|${order.id}`, { ...order });
  }
  function ingest(server, batch) {
    if (!['europe', 'west', 'east'].includes(server) || !Array.isArray(batch)) throw Error('Invalid market context');
    const observedAt = now();
    let accepted = 0;
    for (const raw of batch) {
      const type = typeof raw?.AuctionType === 'string' ? raw.AuctionType.toLowerCase() : '';
      if (!Number.isSafeInteger(raw?.Id) || raw.Id <= 0 || !/^[A-Z0-9_@]+$/.test(raw.ItemTypeId || '') || !/^\d+$/.test(raw.LocationId || '') || !Number.isInteger(raw.QualityLevel) || raw.QualityLevel < 1 || raw.QualityLevel > 5 || !['offer', 'request'].includes(type) || !Number.isSafeInteger(raw.UnitPriceSilver) || raw.UnitPriceSilver < 10000 || !Number.isSafeInteger(raw.Amount) || raw.Amount <= 0) continue;
      const price = Math.floor(raw.UnitPriceSilver / 10000);
      const key = `${server}|${raw.Id}`;
      orders.set(key, { server, id: raw.Id, item: raw.ItemTypeId, location: raw.LocationId, quality: raw.QualityLevel, type, price, amount: raw.Amount, observedAt });
      accepted++;
    }
    return accepted;
  }
  function list() {
    const cutoff = now() - ttl;
    return [...orders.values()].filter(x => x.observedAt > cutoff && x.observedAt <= now() + 60000).map(x => ({ ...x }));
  }
  return { ingest, list };
}

// AODP's HTTP uploader posts /marketorders.ingest. Listen only on loopback
// and use an unguessable path; the caller controls the scanner lifecycle.
function createReceiver({ token, onOrders }) {
  const http = require('node:http');
  if (!/^[a-f0-9]{32,}$/.test(token) || typeof onOrders !== 'function') throw Error('Invalid receiver configuration');
  return http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== `/${token}/marketorders.ingest`) { res.writeHead(404).end(); return; }
    let body = '', size = 0, oversized = false;
    req.setEncoding('utf8');
    req.on('data', chunk => { size += Buffer.byteLength(chunk); if (size > 4 * 1024 * 1024) oversized = true; else body += chunk; });
    req.on('end', async () => {
      if (oversized) { res.writeHead(413).end(); return; }
      try {
        const data = JSON.parse(body);
        if (!Array.isArray(data?.Orders) || data.Orders.length > 10000) throw Error('Invalid orders');
        await onOrders(data.Orders);
        res.writeHead(200).end();
      } catch { res.writeHead(400).end(); }
    });
  });
}

module.exports = { parseMarketMessages, createOrderStore, createReceiver };
