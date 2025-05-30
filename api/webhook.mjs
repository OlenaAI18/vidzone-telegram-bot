// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Шлях до файлів
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) {
    return res.status(200).send('Non-message update skipped');
  }

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  const allowedIds = process.env.ALLOWED_USER_IDS?.split(',') || [];

  if (!allowedIds.includes(userId.toString())) {
    await bot.sendMessage(id, '⛔️ Цей бот є приватним.');
    return res.status(200).send('Unauthorized user');
  }

  const userMessage = text?.toLowerCase().trim() || '';

  // Вітання
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      `Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
- отримати актуальну інформацію про Vidzone та ринок DigitalTV;
- надати корисні шаблони документів;
- спланувати кампанію DigitalTV;
📝 Просто напишіть запитання!`
    );
    return res.status(200).send('Welcome sent');
  }

  // Відповіді на шаблонні документи
  const musicKeywords = ['музична довідка', 'довідка музична', 'музика довідка'];
  const techKeywords = ['технічні вимоги', 'тех вимоги'];
  const guaranteeKeywords = ['гарантійний лист', 'лист гарантія'];

  if (musicKeywords.some(keyword => userMessage.includes(keyword))) {
    await bot.sendMessage(id, `📝 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music certificate sent');
  }

  if (techKeywords.some(keyword => userMessage.includes(keyword))) {
    await bot.sendMessage(id, `📝 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical requirements sent');
  }

  if (guaranteeKeywords.some(keyword => userMessage.includes(keyword))) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // Загальна відповідь по контексту
  const systemPrompt = `
Ти — віртуальний помічник Vidzone. 
Використовуй тільки ці документи та знання:

${credentials}

${news}

${benchmark}

Відповідай стисло, ввічливо і тільки по темі.
`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
