// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантаження файлів
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) {
    return res.status(200).send('Non-message update skipped');
  }

  const { chat: { id }, text, from: { id: userId } } = body.message;
  
  // Прибираємо перевірку allowedIds (бо працюємо через пряме посилання)

  const userMessage = text?.toLowerCase().trim() || '';

  // Вітальне повідомлення
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(id, `Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
- отримати актуальну інформацію про Vidzone та ринок DigitalTV;
- надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
- спланувати кампанію Digital TV;
- отримати трохи DigitalTV-шного гумору.

📝 Просто напишіть запитання або тему, яка вас цікавить.
Наприклад:
«Скільки контактів потрібно для кампанії?»
«Що таке Vidzone?»
«Які технічні вимоги до роликів?»`);
    return res.status(200).send('Welcome sent');
  }

  // Відповідь на довідки
  if (userMessage.includes('музична довідка')) {
    await bot.sendMessage(id, `📝 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music certificate sent');
  }
  if (userMessage.includes('технічні вимоги')) {
    await bot.sendMessage(id, `📝 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Tech requirements sent');
  }
  if (userMessage.includes('гарантійний лист')) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // System Prompt для GPT
  const systemPrompt = `
Ти — віртуальний помічник Vidzone. Відповідай професійно, але дружньо.

Відповідай коротко на запитання про:
- Vidzone, DigitalTV, планування кампаній.
- Документи: музична довідка, технічні вимоги, гарантійний лист.
- CEO Vidzone: Євген Левченко.
- Кількість контактів: реклама DigitalTV формує довготривалі контакти, важливо оцінювати активність брендів у категорії.

Якщо відповіді немає — запропонуй звернутись до комерційного директора Анни Ільєнко (a.ilyenko@vidzone.com).

Не вигадуй інформацію.
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
