// webhook.mjs
import { retrieveRelevantChunks } from '../data/rag.mjs'; // ← або '../lib/rag.mjs' якщо в тебе інша структура
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантаження шаблонів документів (залишаємо як є)
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// Анекдоти про Vidzone
const jokes = [
  "Чому реклама на Vidzone ніколи не спить? Бо вона в ефірі навіть уночі! 😄",
  "Що каже Vidzone перед стартом кампанії? «Тримайся, ефір зараз вибухне!» 📺",
  "На Vidzone рекламу бачать навіть ті, хто не дивиться телевізор! 😎",
];

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);

  const userMessage = text?.toLowerCase().trim() || '';

  // === Пріоритет шаблонних відповідей ===
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      'Привіт! Я — віртуальний помічник Vidzone. Допоможу знайти інформацію про компанію, послуги, документи, чи розповісти щось цікаве. Просто напиши питання, яке тебе цікавить 🙂'
    );
    return res.status(200).send('Welcome Sent');
  }

  // Керівник компанії (усі ключі в lower-case)
  if (
    userMessage.includes('керівник') ||
    userMessage.includes('ceo') ||
    userMessage.includes('директор') ||
    userMessage.includes('сео') ||
    userMessage.includes('шеф') ||
    userMessage.includes('головний')
  ) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.');
    return res.status(200).send('CEO Answer Sent');
  }

  // Документи
  if (
    userMessage.includes('музична довідка') ||
    userMessage.includes('шаблон музичної довідки') ||
    userMessage.includes('музичну довідку')
  ) {
    await bot.sendMessage(id, `🎼 Шаблон музичної довідки:\n\n${musicCertificate}`);
    return res.status(200).send('Music Certificate Sent');
  }

  if (
    userMessage.includes('технічні вимоги') ||
    userMessage.includes('шаблон технічних вимог') ||
    userMessage.includes('тех вимоги') ||
    userMessage.includes('вимоги до роликів')
  ) {
    await bot.sendMessage(id, `📄 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical Requirements Sent');
  }

  if (
    userMessage.includes('гарантійний лист') ||
    userMessage.includes('шаблон гарантійного листа')
  ) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee Letter Sent');
  }

  // Анекдот
  if (
    userMessage.includes('анекдот') ||
    userMessage.includes('жарт') ||
    userMessage.includes('смішне') ||
    userMessage.includes('веселе')
  ) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke);
    return res.status(200).send('Joke Sent');
  }

  // === RAG: релевантні фрагменти для GPT ===
  let relevantChunks = [];
  try {
    relevantChunks = await retrieveRelevantChunks(text, process.env.OPENAI_API_KEY);
  } catch (e) {

