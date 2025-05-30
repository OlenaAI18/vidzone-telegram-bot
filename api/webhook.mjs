import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантаження файлів
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

// Базові відповіді
const fallbackText = `Я ще вчуся, тому не на всі питання можу відповісти. Поки моїх знань недостатньо для твого запиту. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.`;

const brandText = `Реклама на DigitalTV допомагає формувати довготривалий контакт бренду з аудиторією. Vidzone допомагає IT-компаніям будувати довіру та підвищувати впізнаваність серед якісної аудиторії.`;

const campaignPlanningText = `Під час планування кампанії рекомендується обирати цільову аудиторію, визначати мету кампанії, обирати канали просування (включаючи DigitalTV), встановлювати метрики успіху, створювати цікавий та залучений контент, регулярно аналізувати результати для внесення коректив. Важливо також встановлювати бюджет та чіткий графік виконання завдань.`;

// Вітальне повідомлення
const welcomeMessage = `Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
• отримати актуальну інформацію про Vidzone та ринок DigitalTV;
• надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
• спланувати кампанію Digital TV;
• отримати трохи DigitalTV-шного гумору.

📝 Просто напишіть запитання або тему, яка вас цікавить.
Наприклад:
«Скільки контактів потрібно для кампанії?»
«Що таке Vidzone?»
«Які технічні вимоги до роликів?»`;

// Документи
const documentsMenu = `Окей! Які документи вам потрібні? Виберіть один із варіантів:
1. Музична довідка
2. Технічні вимоги
3. Гарантійний лист`;

// Жарти
const jokes = [
  '— Ти де свою рекламу бачив? — На Vidzone! — А я ще на пульт не натиснув, а вона вже в ефірі 😄',
  'Vidzone — це коли відео каже "Привіт!" швидше, ніж ти клікаєш Play.',
  'Якщо ти бачиш рекламу 5 разів на день — ти на Vidzone!'
];

// --- Основна функція ---
export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) {
    return res.status(200).send('Non-message update skipped');
  }

  const {
    chat: { id },
    text,
  } = body.message;

  const userMessage = text?.toLowerCase().trim() || '';

  // Вітання
  if (userMessage === '/start' || /привіт|вітаю|хай/.test(userMessage)) {
    await bot.sendMessage(id, welcomeMessage);
    return res.status(200).send('Welcome sent');
  }

  // Меню документів
  if (/довідка|документ|технічні вимоги|гарантійний лист/.test(userMessage)) {
    await bot.sendMessage(id, documentsMenu);
    return res.status(200).send('Document menu sent');
  }

  // Конкретні документи
  if (/музична довідка/.test(userMessage) || userMessage === '1') {
    await bot.sendMessage(id, `🎼 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music certificate sent');
  }

  if (/технічні вимоги/.test(userMessage) || userMessage === '2') {
    await bot.sendMessage(id, `📄 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical requirements sent');
  }

  if (/гарантійний лист/.test(userMessage) || userMessage === '3') {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // CEO
  if (/керівник|сео|шеф|директор|головний/.test(userMessage)) {
    await bot.sendMessage(id, `CEO Vidzone — Євген Левченко.`);
    return res.status(200).send('CEO answer sent');
  }

  // Бренди/реклама
  if (/бренд|реклама|побудова бренду/.test(userMessage)) {
    await bot.sendMessage(id, brandText);
    return res.status(200).send('Brand answer sent');
  }

  // Планування кампаній
  if (/планування|кампанія|контактів|скільки контактів/.test(userMessage)) {
    await bot.sendMessage(id, campaignPlanningText);
    return res.status(200).send('Planning answer sent');
  }

  // Анекдоти
  if (/анекдот|жарт/.test(userMessage)) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, `😄 Ось вам жарт:\n${randomJoke}`);
    return res.status(200).send('Joke sent');
  }

  // Якщо нічого не знайшов
  await bot.sendMessage(id, fallbackText);
  return res.status(200).send('Fallback sent');
}
