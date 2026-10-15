'use strict';
const { InputError } = require('./formulas');
const STOP = new Set(('a an and are as at be by for from has have he her his i in is it its of on or that the their them they this to was were will with you your').split(' '));
function fn(params = {}) {
  const text = params.text;
  if (typeof text !== 'string' || !text.trim()) throw new InputError('text must be a non-empty string');
  if (text.length > 100000) throw new InputError('text must be at most 100000 characters');
  const words = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
  const counts = new Map();
  for (const word of words) if (word.length > 2 && !STOP.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  const keywords = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([term,count]) => ({term,count}));
  return { result: { keywords, wordCount: words.length }, formulas: ['case-fold, tokenize, remove short/common words, rank by frequency'], assumptions: ['Keywords are extracted locally; no external corpus or API is used.'] };
}
module.exports = { fn };
