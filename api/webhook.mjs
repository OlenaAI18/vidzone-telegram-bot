// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Правильні шляхи до файлів
const musicReference = fs.readFileSync(path.join(__dirname, '../data/music_reference.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');

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
• отримати актуальну інформацію про Vidzone та ринок DigitalTV;
• надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
• спланувати кампанію Digital TV;
• отримати трохи DigitalTV-шного гумору. 😄

📝 Просто напишіть запитання або тему, яка вас цікавить.`
    );
    return res.status(200).send('Welcome sent');
  }

  // Довідки
  if (userMessage.includes('музична довідка')) {
    await bot.sendMessage(id, musicReference);
    return res.status(200).send('Music reference sent');
  }

  if (userMessage.includes('технічні вимоги')) {
    await bot.sendMessage(id, techRequirements);
    return res.status(200).send('Tech requirements sent');
  }

  if (userMessage.includes('гарантійний лист')) {
    await bot.sendMessage(id, guaranteeLetter);
    return res.status(200).send('Guarantee letter sent');
  }

  // System prompt (покорочений)
  const systemPrompt = `
Ти — офіційний помічник Vidzone. Відповідай коротко і професійно.

CEO Vidzone — Євген Левченко.
Якщо питають про планування кампаній, скажи:
"Реклама на DigitalTV допомагає формувати довготривалий контакт бренду з аудиторією. Vidzone допомагає будувати довіру та підвищувати впізнаваність серед якісної аудиторії."

Якщо не знаєш відповіді:
"А ще вчусь, тому не на всі питання можу дати відповіді. Але вони точно є у нашого комерційного директора Анни Ільєнко: a.ilyenko@vidzone.com"

Факти:
${credentials}
${benchmark}
${news}
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
        temperature: 0.7,
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
    console.error('OpenAI error', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}

