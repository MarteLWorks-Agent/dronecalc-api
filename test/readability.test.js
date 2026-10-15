const test = require('node:test');
const assert = require('node:assert/strict');
const { fn } = require('../lib/readability');
test('readability computes metrics', () => { const x=fn({text:'This is a short sentence.'}); assert.equal(x.result.words,5); assert.ok(Number.isFinite(x.result.fleschReadingEase)); });
test('readability rejects missing text', () => { assert.throws(()=>fn({}), /text/); });
