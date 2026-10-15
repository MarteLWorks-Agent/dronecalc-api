'use strict';
// DroneCalc API server — no dependencies (Node >= 18).
const http = require('http');
const fs = require('fs');
const path = require('path');
const f = require('./lib/formulas');
const pay = require('./lib/payments');

const PORT = Number(process.env.PORT || 8787);
const ROUTES = {
  '/v1/readability': require('./lib/readability').fn,
  '/v1/summarize': require('./lib/summarize').summarize,
  '/v1/flight-time': f.flightTime,
  '/v1/thrust-to-weight': f.thrustToWeight,
  '/v1/battery-sizing': f.batterySizing,
  '/v1/prop-sizing': f.propSizing,
};
const STATIC = path.join(__dirname, 'public');
const openapi = require('./openapi.json');

function send(res, status, body, headers = {}) {
  const isStr = typeof body === 'string';
  res.writeHead(status, {
    'content-type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-payment-tx',
    'access-control-expose-headers': 'x-free-remaining, x-credits-remaining',
    ...headers,
  });
  res.end(isStr ? body : JSON.stringify(body, null, 2));
}

async function readBody(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 1e5) throw new f.InputError('body too large'); }
  if (!data) return {};
  try { return JSON.parse(data); } catch { throw new f.InputError('body must be JSON'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, fs.readFileSync(path.join(STATIC, 'index.html'), 'utf8'));
    if (url.pathname === '/health') return send(res, 200, { ok: true, uptimeS: Math.round(process.uptime()) });
    if (url.pathname === '/openapi.json') return send(res, 200, openapi);
    if (url.pathname === '/pricing' || (url.pathname === '/v1/pricing' && /text\/html/.test(req.headers.accept || ''))) {
      return send(res, 200, fs.readFileSync(path.join(STATIC, 'pricing.html'), 'utf8'));
    }
    if (url.pathname === '/v1/pricing') return send(res, 200, pay.pricing());
    const fn = ROUTES[url.pathname];
    if (!fn) return send(res, 404, { error: 'not found', endpoints: Object.keys(ROUTES), docs: '/openapi.json' });
    const params = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams);
    const txHash = req.headers['x-payment-tx'] || params.tx;
    delete params.tx;
    const out = fn(params); // validate before charging
    const auth = await pay.authorize({ ip, txHash });
    if (!auth.allowed) return send(res, auth.status, { error: auth.error, pricing: pay.pricing() });
    return send(res, 200, { endpoint: url.pathname, inputs: params, ...out }, auth.headers);
  } catch (e) {
    if (e instanceof f.InputError) return send(res, 400, { error: e.message, docs: '/openapi.json' });
    console.error(new Date().toISOString(), e);
    return send(res, 500, { error: 'internal error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`DroneCalc listening on :${PORT}`));
}
module.exports = server;
