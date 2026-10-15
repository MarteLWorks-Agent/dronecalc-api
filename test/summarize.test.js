'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { summarize, splitSentences } = require('../lib/summarize');
const { InputError } = require('../lib/formulas');

const EN = 'Drones need batteries. Battery capacity limits drone flight time. The weather was nice. ' +
  'Bigger batteries add weight, which also reduces flight time. Pilots like coffee.';
const RU = 'Дроны летают на аккумуляторах. Ёмкость аккумулятора ограничивает время полёта дрона. ' +
  'Погода была хорошей. Большой аккумулятор добавляет вес, а вес сокращает время полёта.';

test('splits sentences (en/ru)', () => {
  assert.strictEqual(splitSentences(EN).length, 5);
  assert.strictEqual(splitSentences(RU).length, 4);
});
test('keeps the most relevant sentences in original order', () => {
  const r = summarize({ text: EN, sentences: 2 }).result;
  assert.strictEqual(r.sentences.length, 2);
  assert.ok(r.summary.includes('flight time'));
  assert.ok(!r.summary.includes('coffee'));
  assert.ok(EN.indexOf(r.sentences[0]) < EN.indexOf(r.sentences[1]));
});
test('russian works', () => {
  const r = summarize({ text: RU, sentences: 2 }).result;
  assert.ok(r.summary.includes('время полёта'));
  assert.ok(!r.summary.includes('Погода'));
});
test('validation', () => {
  assert.throws(() => summarize({ text: '' }), InputError);
  assert.throws(() => summarize({ text: 'x'.repeat(50001) }), InputError);
  assert.throws(() => summarize({ text: EN, sentences: 0 }), InputError);
  assert.strictEqual(summarize({ text: 'Only one sentence here.' }).result.sentences.length, 1);
});
