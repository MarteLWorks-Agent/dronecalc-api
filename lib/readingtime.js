const { InputError } = require('./formulas');
function fn(params = {}) {
  const text = params.text;
  if (typeof text !== 'string' || !text.trim()) throw new InputError('text must be a non-empty string');
  if (text.length > 200000) throw new InputError('text is too long');
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return { result: { words, minutes, seconds: Math.ceil(words / 200 * 60) }, formulas: ['words = whitespace-separated tokens', 'minutes = ceil(words / 200)'], assumptions: ['average reading speed is 200 words per minute'] };
}
module.exports = { fn };
