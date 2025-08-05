// /lib/rag.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Абсолютний шлях до JSON з ембеддингами
const EMB_PATH = path.join(__dirname, '..', 'data', 'vidzone_embeddings.json');

// Косинусна схожість
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Отримати ембеддинг запиту
async function embedQuery(query, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // дешево і досить точно
      input: query
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`OpenAI Embeddings error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.data[0].embedding;
}

/**
 * Повертає topK релевантних фрагментів (рядки) з JSON.
 * @param {string} query — запит користувача
 * @param {string} apiKey — ключ OpenAI
 * @param {number} topK — скільки фрагментів брати
 * @param {number} minScore — мінімальна схожість (0..1), щоб відсікати сміття
 */
export async function retrieveRelevantChunks(query, apiKey, topK = 6, minScore = 0.12) {
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  // 1) ембеддинг запиту
  const qEmb = await embedQuery(query, apiKey);

  // 2) читаємо базу ембеддингів
  const raw = fs.readFileSync(EMB_PATH, 'utf-8');
  const items = JSON.parse(raw); // формат: [{filename, content, embedding:[...]}]

  // 3) ранжуємо
  const scored = items.map(it => ({
    filename: it.filename,
    content: it.content,
    score: cosineSim(qEmb, it.embedding || [])
  }))
  .filter(x => x.score >= minScore)
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);

  // 4) повертаємо як структуровані блоки + сукупний контекст
  const contextBlocks = scored.map(
    (x, i) => `### ${i+1}. ${x.filename} (score: ${x.score.toFixed(3)})\n${x.content}`
  );

  return {
    blocks: contextBlocks,
    debug: scored  // корисно для логів
  };
}
