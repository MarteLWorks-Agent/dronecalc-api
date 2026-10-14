'use strict';
// Pay-per-request with USDC on Base, verified on-chain. No custody, no accounts:
// the customer sends USDC to the agent wallet and passes the tx hash; each 0.10 USDC = 1 request.
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/root';
const DATA_DIR = path.join(HOME, 'service', 'data');
const CREDITS_FILE = path.join(DATA_DIR, 'credits.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
// Accepted chains: USDC on Base and on Arc (same wallet address on both).
const CHAINS = [
  { name: 'Base', chainId: 8453, rpc: process.env.BASE_RPC || 'https://mainnet.base.org', usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { name: 'Arc', chainId: 5042, rpc: process.env.ARC_RPC || 'https://rpc.mainnet.arc.io', usdc: '0x3600000000000000000000000000000000000000' },
];
const USDC = CHAINS[0].usdc;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const PRICE_UNITS = 100000n; // 0.10 USDC (6 decimals)
const FREE_PER_DAY = Number(process.env.FREE_PER_DAY || 20);

fs.mkdirSync(DATA_DIR, { recursive: true });
const load = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const save = (f, v) => { fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };

let credits = load(CREDITS_FILE, {});
let stats = load(STATS_FILE, { freeRequests: 0, paidRequests: 0, revenueUnits: '0', payments: 0, days: {} });
const freeUsage = new Map(); // `${day}|${ip}` -> count

// Current agent wallet (changes when a new generation is born) and all ancestor wallets — re-read every minute.
let agentAddress = null, lineage = new Set(), addressReadAt = 0;
function refreshAddresses() {
  if (agentAddress && Date.now() - addressReadAt < 60_000) return;
  const read = (f) => { try { return String(JSON.parse(fs.readFileSync(f, 'utf8')).walletAddress).toLowerCase(); } catch { return null; } };
  const cur = read(path.join(HOME, '.automaton', 'automaton.json'));
  if (cur) agentAddress = cur;
  const set = new Set(agentAddress ? [agentAddress] : []);
  const genDir = path.join(HOME, 'generations');
  try {
    for (const g of fs.readdirSync(genDir)) {
      const a = read(path.join(genDir, g, 'automaton', 'automaton.json'));
      if (a) set.add(a);
    }
  } catch { /* no generations yet */ }
  lineage = set;
  addressReadAt = Date.now();
}
function getAgentAddress() { refreshAddresses(); return agentAddress; }

async function rpc(method, params, url) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'rpc error');
  return j.result;
}

/** Verify a USDC payment tx to any wallet this agent lineage has used; register its credits once. */
async function registerTx(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, error: 'invalid tx hash' };
  const key = txHash.toLowerCase();
  if (credits[key]) return { ok: true, entry: credits[key] };
  let receipt = null, chain = null;
  for (const c of CHAINS) {
    try { receipt = await rpc('eth_getTransactionReceipt', [key], c.rpc); } catch { receipt = null; }
    if (receipt) { chain = c; break; }
  }
  if (!receipt) return { ok: false, error: 'transaction not found on Base or Arc (or not yet mined) — retry in a few seconds' };
  if (receipt.status !== '0x1') return { ok: false, error: 'transaction failed on-chain' };
  refreshAddresses();
  const topics = new Set([...lineage].map((a) => '0x' + a.slice(2).padStart(64, '0')));
  const to = agentAddress;
  let units = 0n;
  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() === chain.usdc && log.topics[0] === TRANSFER_TOPIC && topics.has(log.topics[2]?.toLowerCase())) {
      units += BigInt(log.data);
    }
  }
  if (units < PRICE_UNITS) return { ok: false, error: `no USDC transfer of at least 0.10 to ${to} in this transaction` };
  const entry = { total: Number(units / PRICE_UNITS), used: 0, units: units.toString(), to, chain: chain.name, at: new Date().toISOString() };
  credits[key] = entry;
  stats.payments += 1;
  stats.revenueUnits = (BigInt(stats.revenueUnits) + units).toString();
  save(CREDITS_FILE, credits); save(STATS_FILE, stats);
  return { ok: true, entry };
}

const today = () => new Date().toISOString().slice(0, 10);
function bumpDay(kind) {
  const d = today();
  stats.days[d] = stats.days[d] || { free: 0, paid: 0 };
  stats.days[d][kind] += 1;
}

/** Decide whether a request may run. Returns {allowed, headers, error, status}. */
async function authorize({ ip, txHash }) {
  if (txHash) {
    const reg = await registerTx(txHash).catch((e) => ({ ok: false, error: 'payment check failed: ' + e.message }));
    if (!reg.ok) return { allowed: false, status: 402, error: reg.error };
    const e = reg.entry;
    if (e.used >= e.total) return { allowed: false, status: 402, error: 'all requests paid by this transaction are used up' };
    e.used += 1; stats.paidRequests += 1; bumpDay('paid');
    save(CREDITS_FILE, credits); save(STATS_FILE, stats);
    return { allowed: true, headers: { 'x-credits-remaining': String(e.total - e.used) } };
  }
  const k = `${today()}|${ip}`;
  const used = freeUsage.get(k) || 0;
  if (used >= FREE_PER_DAY) {
    return { allowed: false, status: 402, error: `free limit of ${FREE_PER_DAY} requests/day reached — see /v1/pricing` };
  }
  freeUsage.set(k, used + 1); stats.freeRequests += 1; bumpDay('free');
  if (stats.freeRequests % 10 === 0) save(STATS_FILE, stats);
  return { allowed: true, headers: { 'x-free-remaining': String(FREE_PER_DAY - used - 1) } };
}

function pricing() {
  return {
    price: '0.10 USDC per request',
    networks: CHAINS.map((c) => ({ name: c.name, chainId: c.chainId, usdc: c.usdc })),
    payTo: getAgentAddress(), freePerDay: FREE_PER_DAY,
    howTo: [
      'Send N × 0.10 USDC on Base or Arc to payTo (one transaction can prepay many requests).',
      'Pass the transaction hash in header "X-Payment-Tx: 0x…" (or query ?tx=0x…) on every paid request.',
      'Remaining paid requests are returned in header X-Credits-Remaining.',
    ],
  };
}

module.exports = { authorize, pricing, registerTx, getStats: () => stats, getAgentAddress };
