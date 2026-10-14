'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), os = require('os');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dcp-'));
process.env.HOME = home;
const AGENT = '0x' + 'ab'.repeat(20);
fs.mkdirSync(path.join(home, '.automaton'), { recursive: true });
fs.writeFileSync(path.join(home, '.automaton', 'automaton.json'), JSON.stringify({ walletAddress: AGENT }));
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const T = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const pad = (a) => '0x' + a.slice(2).padStart(64, '0');
const receipts = {
  ['0x' + '1'.repeat(64)]: { status: '0x1', logs: [{ address: USDC, topics: [T, pad('0x' + 'cd'.repeat(20)), pad(AGENT)], data: '0x' + (350000).toString(16) }] }, // 0.35 USDC
  ['0x' + '2'.repeat(64)]: { status: '0x1', logs: [{ address: USDC, topics: [T, pad('0x' + 'cd'.repeat(20)), pad('0x' + 'ee'.repeat(20))], data: '0x' + (900000).toString(16) }] }, // to someone else
  ['0x' + '3'.repeat(64)]: { status: '0x0', logs: [] },
};
const ARC_USDC = '0x3600000000000000000000000000000000000000';
receipts['0x' + '5'.repeat(64)] = { status: '0x1', logs: [{ address: ARC_USDC, topics: [T, pad('0x' + 'cd'.repeat(20)), pad(AGENT)], data: '0x' + (200000).toString(16) }] };
global.fetch = async (url, opts) => {
  const { params } = JSON.parse(opts.body);
  const r = receipts[params[0]] || null;
  // Base RPC knows Base txs, Arc RPC knows Arc txs
  const isArcTx = r && r.logs[0]?.address === ARC_USDC;
  const onArc = String(url).includes('arc');
  return { json: async () => ({ result: r && isArcTx === onArc ? r : null }) };
};
const pay = require('../lib/payments');

test('valid payment gives floor(amount/0.10) requests, then 402', async () => {
  const tx = '0x' + '1'.repeat(64);
  for (let i = 3; i >= 1; i--) {
    const a = await pay.authorize({ ip: '1.1.1.1', txHash: tx });
    assert.ok(a.allowed); assert.strictEqual(a.headers['x-credits-remaining'], String(i - 1));
  }
  const a = await pay.authorize({ ip: '1.1.1.1', txHash: tx });
  assert.strictEqual(a.allowed, false); assert.strictEqual(a.status, 402);
  assert.strictEqual(pay.getStats().revenueUnits, '350000');
});
test('Arc payment is accepted', async () => {
  const a = await pay.authorize({ ip: '1.1.1.1', txHash: '0x' + '5'.repeat(64) });
  assert.ok(a.allowed); assert.strictEqual(a.headers['x-credits-remaining'], '1');
});
test('payment to another address, failed tx, unknown tx are rejected', async () => {
  for (const tx of ['0x' + '2'.repeat(64), '0x' + '3'.repeat(64), '0x' + '4'.repeat(64), 'junk']) {
    const a = await pay.authorize({ ip: '1.1.1.1', txHash: tx });
    assert.strictEqual(a.allowed, false, tx);
  }
});
test('free tier: 20 per day per ip', async () => {
  for (let i = 0; i < 20; i++) assert.ok((await pay.authorize({ ip: '9.9.9.9' })).allowed);
  assert.strictEqual((await pay.authorize({ ip: '9.9.9.9' })).allowed, false);
  assert.ok((await pay.authorize({ ip: '8.8.8.8' })).allowed);
});
