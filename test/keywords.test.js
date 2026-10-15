const test = require('node:test');
const assert = require('node:assert/strict');
const { fn } = require('../lib/keywords');
test('extracts ranked keywords', () => { const r=fn({text:'Cats chase cats. Dogs chase cats.'}); assert.deepEqual(r.result.keywords.slice(0,2), [{term:'cats',count:3},{term:'chase',count:2}]); });
test('rejects missing text', () => assert.throws(() => fn({}), /non-empty/));
