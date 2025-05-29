// webhook.mjs
import bot from '../bot.mjs';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантажуємо тексти з Markdown і DOCX (тільки текстовий вміст)
const credentials = fs.readFileSync(path.join(__dirname, '../mnt/data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const digitalNews = fs.readFileSync(path.join(__dirname, '../mnt/data/DigitalTVNews_Cleaned_2025 (1).md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../mnt/data/Vidzone_Clutter_Benchmark_Cleaned (1).md'), 'utf-8');

const contextText = `# Знання Vidzone

${credentials}

${digitalNews}

${benchmark}`;

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

  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      'Привіт! Я перший віртуальний AI помічник Vidzone. Допоможу швидко розібратись з усіма тонкощами DigitalTV, документами, SOV та іншим. Напиши, що саме тебе цікавить 📺'
    );
    return res.status(200).send('Welcome sent');
  }

  if (userMessage.startsWith('sov')) {
    await bot.sendMessage(
      id,
      '🔍 Ця команда передбачає побудову графіків. Функція в розробці. Якщо ви можете вказати приклади брендів або уточнити категорію — я підготую потрібні дані!'
    );
    return res.status(200).send('SOV stub sent');
  }

  const systemPrompt = `
Ти — офіційний помічник Vidzone. Відповідай тільки згідно з цими знаннями:

${contextText}

1. Якщо користувач просить SOV або місячну активність певної категорії — скажи, що ця функція ще в розробці. Запропонуй уточнити бренди або виробників у категорії.
2. Якщо запит про підкатегорію — уточни, чи потрібна повна категорія чи лише підкатегорія.
3. Якщо запит стосується документів (довідка, шаблони, гарантія) — запропонуй надіслати їх.
4. Якщо інформації немає — порадь звернутись до акаунт-менеджера: Анна Ільєнко, email: anna@vidzone.ua
5. Загальні запити: поясни, що Vidzone — це платформа для розміщення відеореклами на Sweet.tv, MEGOGO, Vodafone TV, Київстар ТБ та ін.
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

