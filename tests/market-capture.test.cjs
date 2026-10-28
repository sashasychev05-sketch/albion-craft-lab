'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseMarketMessages, createOrderStore, createReceiver } = require('../desktop/market-capture.cjs');

test('reads only upstream market order websocket messages, including batched frames', () => {
  const order = { ItemTypeId: 'T4_BAG', LocationId: '3005', QualityLevel: 1, UnitPriceSilver: 10000, AuctionType: 'offer' };
  const frame = [JSON.stringify({ topic: 'goldprices.ingest', data: {} }), JSON.stringify({ topic: 'marketorders.ingest', data: { Orders: [order] } })].join('\n');
  assert.deepEqual(parseMarketMessages(frame), [[order]]);
  assert.throws(() => parseMarketMessages('{invalid'));
  assert.throws(() => parseMarketMessages(JSON.stringify({ topic: 'marketorders.ingest', data: { Orders: {} } })));
});

test('accepts market orders on the private receiver path only', async () => {
  const token = 'a'.repeat(32), batches = [];
  const server = createReceiver({ token, onOrders: batch => batches.push(batch) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/wrong/marketorders.ingest`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/${token}/marketorders.ingest`, { method: 'POST', body: JSON.stringify({ Orders: [{ Id: 1 }] }) })).status, 200);
    assert.equal(batches.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('converts upstream silver units and keeps separately observed orders until expiry', () => {
  let time = 10000000;
  const store = createOrderStore(() => time, 1000);
  const order = { Id: 1, ItemTypeId: 'T4_BAG', LocationId: '3005', QualityLevel: 1, UnitPriceSilver: 2500000, AuctionType: 'offer', Amount: 3 };
  assert.equal(store.ingest('europe', [order, { ...order, Id: 2, UnitPriceSilver: 3000000 }, { ...order, Id: 3, Amount: 0 }]), 2);
  assert.deepEqual(store.list().map(x => x.price), [250, 300]);
  time += 500;
  store.ingest('europe', [{ ...order, UnitPriceSilver: 2000000 }]);
  time += 500;
  assert.deepEqual(store.list().map(x => x.price), [200]);
  assert.throws(() => store.ingest('unknown', []));
  const restored = createOrderStore(() => time, 1000, store.list());
  assert.deepEqual(restored.list(), store.list());
  assert.throws(() => createOrderStore(() => time, 1000, [{ server: 'europe' }]));
});
