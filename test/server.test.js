'use strict';
const test = require('node:test');
const assert = require('node:assert');
process.env.HOME = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'dc-'));
const server = require('../server');

test('HTTP API: free tier, validation, 404, pricing', async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let r = await fetch(`${base}/v1/flight-time?cells=4&capacityMah=5000&auwG=1500`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('x-free-remaining'), '19');
  assert.ok((await r.json()).result.flightTimeMin > 0);
  r = await fetch(`${base}/v1/flight-time?cells=x&capacityMah=5000&auwG=1500`);
  assert.strictEqual(r.status, 400);
  r = await fetch(`${base}/v1/thrust-to-weight`, { method: 'POST', body: JSON.stringify({ auwG: 1000, maxThrustPerMotorG: 1000 }) });
  assert.strictEqual((await r.json()).result.thrustToWeight, 4);
  r = await fetch(`${base}/nope`); assert.strictEqual(r.status, 404);
  r = await fetch(`${base}/v1/pricing`); assert.strictEqual(r.status, 200);
  r = await fetch(`${base}/v1/prop-sizing?auwG=1600`, { headers: { 'x-payment-tx': '0x123' } });
  assert.strictEqual(r.status, 402);
  r = await fetch(`${base}/`); assert.ok((await r.text()).includes('DroneCalc'));
  server.close();
});
