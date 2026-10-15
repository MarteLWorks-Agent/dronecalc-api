// Simple extractive summarizer
// Exports: summarize(text, options)
// options: {maxSentences: number} (default 3)

function splitSentences(text) {
  // naive sentence splitter on .!?\n
  return text
    .replace(/\n+/g, ' ') // collapse newlines
    .split(/(?<=[\.\!\?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function tokenizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

function scoreSentences(sentences) {
  const freq = Object.create(null);
  for (const s of sentences) {
    for (const w of tokenizeWords(s)) {
      if (w.length <= 2) continue; // skip short words
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const scores = sentences.map(s => {
    let score = 0;
    for (const w of tokenizeWords(s)) {
      if (w.length <= 2) continue;
      score += (freq[w] || 0);
    }
    return score;
  });
  return scores;
}

function summarize(text, options = {}) {
  const maxSentences = options.maxSentences || 3;
  if (!text || typeof text !== 'string') return '';
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return sentences.join(' ');
  const scores = scoreSentences(sentences);
  // get top N sentence indices by score, preserving original order
  const idxs = sentences.map((_, i) => i);
  idxs.sort((a, b) => scores[b] - scores[a]);
  const top = idxs.slice(0, maxSentences).sort((a, b) => a - b);
  const summary = top.map(i => sentences[i]).join(' ');
  return summary;
}

module.exports = { summarize };
