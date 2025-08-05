// lib/rag.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// === налаштування ===
const EMB_MODEL = 'text-embedding-3-small'; // дешево і достатньо
const TOP_K = 6;                             // скільки фрагментів віддавати
const MIN_SIM = 0.62;                        // поріг схожості (раніше міг бути зависоким)

// допоміжне
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const embeddingsPath = path.resolve(process.cwd(), 'data', 'vidzone_embeddings.json');

// косинусна схожість
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

// ембеддинг запиту через REST (без SDK)
async function embedQuery(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMB_MODEL, input: text })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Embeddings API error: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.data[0].embedding;
}

// основна функція
export async function retrieveRelevantChunks(query, apiKey) {
  // 1) читаємо індекс
  if (!fs.existsSync(embeddingsPath)) {
    console.error('❌ embeddings file not found at:', embeddingsPath);
    return [];
  }

  let index = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
  // Підтримуємо два формати:
  // [{text, embedding}]  або  [{filename, content, embedding}]
  index = index.map(item => ({
    text: item.text || item.content || '',
    embedding: item.embedding
  })).filter(it => Array.isArray(it.embedding) && it.embedding.length > 0 && it.text);

  if (!index.length) {
    console.error('❌ embeddings index is empty or invalid');
    return [];
  }

  // 2) ембеддинг запиту
  const q = (query || '').trim();
  if (!q) return [];
  const qEmb = await embedQuery(q, apiKey);

  // 3) ранжуємо
  const scored = index.map(it => ({
    text: it.text,
    score: cosineSim(qEmb, it.embedding)
  })).sort((a, b) => b.score - a.score);

  // 4) лог топів (щоб бачити, що знаходить)
  const debugTop = scored.slice(0, 5).map((s, i) => ({
    rank: i + 1,
    score: +s.score.toFixed(4),
    preview: s.text.slice(0, 120) + (s.text.length > 120 ? '…' : '')
  }));
  console.log('RAG candidates:', debugTop);

  // 5) фільтруємо по порогу
  const filtered = scored.filter(s => s.score >= MIN_SIM).slice(0, TOP_K);

  // 6) повертаємо тексти фрагментів
  return filtered.map(s => s.text);
}
