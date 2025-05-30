// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load documents
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const technicalRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicReference = fs.readFileSync(path.join(__dirname, '../data/music_reference.md'), 'utf-8');

// Load knowledge base
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const digitalNews = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');
const clutterBenchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');

const fallbackText = `📝 Я також можу допомогти вам із базовою інформацією про Vidzone, плануванням кампанії чи надати шаблони документів!`;
const contactInfo = `🔔 На жаль, я не знайшов точної інформації.\nРекомендую звернутись до нашого комерційного директора Анни Ільєнко: a.ilyenko@vidzone.com`;

const systemPrompt = `Поводься як офіційний помічник Vidzone.
Відповідай чітко, лаконічно, від імені Vidzone. Не ділися чутками, дивись лише на базу знань.\n
# Знання:

${credentials}

${digitalNews}`;

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

  const userMessage = text?.toLowerCase().trim() || '';

  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(id, `Привіт! Я — віртуальний помічник Vidzone.\nДопоможу вам:\n- отримати актуальну інформацію про Vidzone та ринок DigitalTV;\n- надати корисні шаблони документів;\n- спланувати кампанію DigitalTV;\n📝 Просто напишіть запитання!`);
    return res.status(200).send('Welcome sent');
  }

  // Document request handling
  if (userMessage.includes('музична довідка')) {
    await bot.sendMessage(id, `📝 Музична довідка:\n\n${musicReference}`);
    return res.status(200).send('Music reference sent');
  }

  if (userMessage.includes('технічні вимоги')) {
    await bot.sendMessage(id, `📝 Технічні вимоги:\n\n${technicalRequirements}`);
    return res.status(200).send('Technical requirements sent');
  }

  if (userMessage.includes('гарантійний лист')) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // Planning / contacts requests
  if (userMessage.includes('контакт') || userMessage.includes('планування')) {
    const planningText = clutterBenchmark;
    await bot.sendMessage(id, planningText);
    return res.status(200).send('Planning help sent');
  }

  // CEO request
  if (userMessage.includes('керівник') || userMessage.includes('директор') || userMessage.includes('сео')) {
    await bot.sendMessage(id, `CEO Vidzone — Євген Левченко.`);
    return res.status(200).send('CEO info sent');
  }

  // General OpenAI fallback
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
    const reply = data.choices?.[0]?.message?.content || `${contactInfo}\n\n${fallbackText}`;
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Сталася помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
