/// lib/rag.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const embeddingsPath = path.resolve(process.cwd(), 'data', 'vidzone_embeddings.json');

// Косинусна схожість
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}

// Виклик Embeddings API
async function embed(text, model, apiKey) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Embeddings API error ${res.status}: ${JSON.stringify(data)}`);
  return data.data[0].embedding;
}

// Спроба підібрати модель під індекс
function detectModelByDim(dim) {
  // 3072 → text-embedding-3-large
  // 1536 → text-embedding-3-small або старий ada-002 (обидва 1536)
  if (dim === 3072) return 'text-embedding-3-large';
  if (dim === 1536) return 'text-embedding-3-small'; // стартово беремо small, але зробимо фолбек
  return 'text-embedding-3-small';
}

export async function retrieveRelevantChunks(query, apiKey, opts = {}) {
  const TOP_K   = opts.topK ?? 6;
  const MIN_SIM = opts.minSim ?? 0.15; // м'якше, щоб щось повертати

  if (!fs.existsSync(embeddingsPath)) {
    console.error('❌ embeddings file not found:', embeddingsPath);
    return [];
  }

  // Підтримка форматів: [{text, embedding}] або [{filename, content, embedding, model}]
  let raw = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
  let modelFromFile = raw.model; // якщо файл збережений з ключем model на верхньому рівні
  let items = Array.isArray(raw) ? raw : (raw.items || raw.data || []);
  if (!Array.isArray(items)) {
    console.error('❌ invalid embeddings JSON shape');
    return [];
  }

  items = items.map(x => ({
    text: x.text || x.content || '',
    embedding: x.embedding,
    model: x.model
  })).filter(x => x.text && Array.isArray(x.embedding) && x.embedding.length > 0);

  if (items.length === 0) {
    console.error('❌ empty embeddings index');
    return [];
  }

  const dim = items[0].embedding.length;
  let candidateModel = modelFromFile || items[0].model || detectModelByDim(dim);

  console.log(`RAG index size=${items.length}, dim=${dim}, candidateModel=${candidateModel}`);

  const q = (query || '').trim();
  if (!q) return [];

  // Спробуємо 1–2 моделі і виберемо кращу (на випадок 1536 = small/ada-002)
  const modelsToTry = new Set([candidateModel]);
  if (dim === 1536) {
    modelsToTry.add('text-embedding-3-small');
    modelsToTry.add('text-embedding-ada-002');
  }
  if (dim === 3072) {
    modelsToTry.add('text-embedding-3-large');
  }

  let best = { topScore: -Infinity, model: candidateModel, scored: [] };

  for (const model of modelsToTry) {
    try {
      const qEmb = await embed(q, model, apiKey);
      const scored = items.map(it => ({
        text: it.text,
        score: cosineSim(qEmb, it.embedding)
      })).sort((a, b) => b.score - a.score);

      const topScore = scored[0]?.score ?? -Infinity;
      console.log(`• Try model=${model} → topScore=${topScore?.toFixed(4)}`);

      if (topScore > best.topScore) best = { topScore, model, scored };
    } catch (e) {
      console.error(`embed failed for model=${model}:`, e.message);
    }
  }

  // Діагностичний лог
  const peek = best.scored.slice(0, 5).map((s, i) => ({
    rank: i + 1,
    score: +s.score.toFixed(4),
    preview: s.text.slice(0, 120) + (s.text.length > 120 ? '…' : '')
  }));
  console.log(`RAG model chosen: ${best.model}`);
  console.log('RAG candidates:', peek);

  // Фільтр + гарантія, що щось повернемо
  let picked = best.scored.filter(s => s.score >= MIN_SIM).slice(0, TOP_K);
  if (picked.length === 0) picked = best.scored.slice(0, Math.min(3, best.scored.length)); // дати хоч 1–3 фрагменти

  return picked.map(s => s.text);
}
