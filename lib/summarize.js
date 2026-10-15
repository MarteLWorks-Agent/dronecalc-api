'use strict';
// Extractive text summarizer (no external APIs): scores sentences by the frequency of their
// content words, adds a small bonus for leading sentences, returns the top N in original order.
// Works for English and Russian (and most languages that separate words with spaces).
const { InputError } = require('./formulas');

const STOP = new Set((
  'a an the and or but if then of to in on at for with by from as is are was were be been being it its this that these those ' +
  'i you he she we they me him her us them my your our their not no do does did have has had will would can could should ' +
  'и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет ' +
  'о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ' +
  'ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот ' +
  'это эти этого этой того том при над об про между также который которые которая'
).split(/\s+/));

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[A-ZА-ЯЁ0-9"«(])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w));

function summarize(params) {
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text) throw new InputError('text is required');
  if (text.length > 50000) throw new InputError('text must be at most 50 000 characters');
  const n = params.sentences === undefined || params.sentences === '' ? 3 : Number(params.sentences);
  if (!Number.isInteger(n) || n < 1 || n > 20) throw new InputError('sentences must be an integer in [1, 20]');

  const sentences = splitSentences(text);
  const freq = new Map();
  for (const s of sentences) for (const w of words(s)) freq.set(w, (freq.get(w) || 0) + 1);
  const max = Math.max(1, ...freq.values());

  const scored = sentences.map((s, i) => {
    const ws = words(s);
    const base = ws.length ? ws.reduce((a, w) => a + freq.get(w) / max, 0) / Math.sqrt(ws.length) : 0;
    const position = i === 0 ? 0.25 : i < 3 ? 0.1 : 0;
    return { i, s, score: base + position };
  });
  const picked = scored
    .slice()
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, Math.min(n, sentences.length))
    .sort((a, b) => a.i - b.i);

  return {
    result: {
      summary: picked.map((p) => p.s).join(' '),
      sentences: picked.map((p) => p.s),
      originalSentences: sentences.length,
      compressionRatio: Math.round((picked.reduce((a, p) => a + p.s.length, 0) / text.length) * 100) / 100,
    },
    formulas: ['score(sentence) = Σ freq(word)/max_freq / √(content words) + position bonus'],
    assumptions: ['extractive: returns the most representative original sentences, nothing is rewritten', 'stop-words removed for English and Russian'],
  };
}

module.exports = { summarize, splitSentences };
