const { InputError } = require('./formulas');
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const groups = (w.match(/[aeiouy]+/g) || []).length;
  return Math.max(1, groups - (/(e)$/.test(w) ? 1 : 0));
}
function fn(params) {
  const text = typeof params?.text === 'string' ? params.text.trim() : '';
  if (!text || text.length > 100000) throw new InputError('text must be 1-100000 characters');
  const words = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || [];
  const sentences = text.match(/[.!?]+(?=\s|$)/g) || [];
  if (!words.length) throw new InputError('text must contain words');
  const sentenceCount = Math.max(1, sentences.length);
  const syllableCount = words.reduce((n, w) => n + syllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentenceCount) - 84.6 * (syllableCount / words.length);
  return { result: { words: words.length, sentences: sentenceCount, syllables: syllableCount, fleschReadingEase: Math.round(score * 100) / 100 }, formulas: ['206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)'], assumptions: ['English-like syllable estimation; punctuation defines sentences'] };
}
module.exports = { fn };
