// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Шляхи до файлів у /data
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

  // Вітальне повідомлення
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      'Привіт! Я перший віртуальний AI помічник Vidzone. Допоможу швидко розібратись з усіма тонкощами DigitalTV, документами, SOV та іншим. Напиши, що саме тебе цікавить 📺'
    );
    return res.status(200).send('Welcome sent');
  }

  // Заглушка для графіків
  if (userMessage.startsWith('sov')) {
    await bot.sendMessage(
      id,
      '🔍 Ця команда передбачає побудову графіків. Функція в розробці. Якщо ви можете вказати приклади брендів або уточнити категорію — я підготую потрібні дані!'
    );
    return res.status(200).send('SOV stub sent');
  }

  // System Prompt на основі бази знань
  const systemPrompt = `
Ти — офіційний помічник Vidzone. Твій стиль спілкування дружній, але професійний. Не ділись конфіденційною інформацією.
Відповідай на основі наведених нижче матеріалів (база знань):

===== Креденшли =====
${credentials}

===== Бенчмарк =====
${benchmark}

===== Новини DigitalTV =====
${news}

Якщо інформації немає — запропонуй написати нашому акаунт-менеджеру: Анна Ільєнко (a.ilyenko@vidzone.com).
Використовуй приклади з ринку відеореклами і брендів.
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
console.log('OpenAI response:', JSON.stringify(data, null, 2));

const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';

    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}



