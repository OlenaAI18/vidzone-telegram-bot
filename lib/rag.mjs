// lib/rag.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// шлях до embeddings-файлу (з lib -> ../data/...)
const EMB_PATH = path.join(__dirname, '../data/vidzone_embeddings.json');

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function retrieveRelevantChunks(query, openaiKey, topK = 6) {
  // 1) Отримати embedding запиту
  const embRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      // можна замінити на text-embedding-3-large, якщо потрібно ще точніше
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  const embJson = await embRes.json();
  if (!embRes.ok) {
    throw new Error(`Embeddings API error: ${embRes.status} ${JSON.stringify(embJson)}`);
  }
  const queryVec = embJson.data[0].embedding;

  // 2) Прочитати локальні embeddings
  const raw = fs.readFileSync(EMB_PATH, 'utf-8');
  const items = JSON.parse(raw); // [{ text, embedding, file }, ...]

  // 3) Порахувати косинусну схожість і вибрати topK
  const scored = items.map((it) => ({
    ...it,
    score: cosineSimilarity(queryVec, it.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  // 4) Повернути ТЕКСТИ обраних фрагментів
  return scored.slice(0, topK).map((s) => s.text);
}
