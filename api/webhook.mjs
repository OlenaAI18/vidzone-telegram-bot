// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Шляхи до файлів
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

// Довідки
const musicReference = fs.readFileSync(path.join(__dirname, '../data/music_reference.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');

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
      `Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
• отримати актуальну інформацію про Vidzone та ринок DigitalTV;
• надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
• спланувати кампанію Digital TV;
• отримати трохи DigitalTV-шного гумору. 😄

📝 Просто напишіть запитання або тему, яка вас цікавить.
Наприклад:
«Скільки контактів потрібно для кампанії?»
«Що таке Vidzone?»
«Які технічні вимоги до роликів?»`
    );
    return res.status(200).send('Welcome sent');
  }

  // Відповідь по довідках
  if (userMessage.includes('довідка') || userMessage.includes('документ') || userMessage.includes('шаблон')) {
    await bot.sendMessage(id, `
Окей! Які документи вам потрібні? Виберіть один із варіантів:
1. Музична довідка
2. Технічні вимоги
3. Гарантійний лист
`);
    return res.status(200).send('Doc list sent');
  }

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

  // System Prompt
  const systemPrompt = `
Ти — офіційний помічник Vidzone.
Використовуй знання тільки з текстів нижче:

${credentials}
${benchmark}
${news}

✅ Якщо тебе запитають про директора або керівника, відповідай:
"CEO Vidzone — Євген Левченко."

✅ Якщо запитання про планування чи кількість контактів — відповідай так:
"Реклама на DigitalTV допомагає формувати довготривалий контакт бренду з аудиторією. Vidzone допомагає будувати довіру та підвищувати впізнаваність серед якісної аудиторії."

✅ Якщо запитання не має точної відповіді — відповідай:
"А ще вчусь, тому не на всі питання можу дати відповіді. Поки моїх знань недостатньо для твого питання, але вони точно є у нашого комерційного директора Анни Ільєнко: a.ilyenko@vidzone.com"

✅ І не забувай: можеш також розповісти анекдот чи жарт на тему DigitalTV. 🎯
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
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
