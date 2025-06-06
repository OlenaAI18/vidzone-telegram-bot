// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// База знань
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');

// Додаткові документи
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// Клаттер-бенчмарк для питань про контакти
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');

// Гумор
const jokes = [
  "Чому реклама ніколи не втомлюється? Бо вона завжди в ефірі! 📺",
  "Що сказав рекламний ролик телевізору? «Дякую за ефір!» 😄",
  "На DigitalTV реклама така таргетована, що встигаєш подумати «це ж про мене!» 🎯",
];

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);

  const allowedIds = process.env.ALLOWED_USER_IDS?.split(',') || [];

  if (!allowedIds.includes(userId.toString())) {
    await bot.sendMessage(id, '⛔️ Цей бот є приватним.');
    return res.status(200).send('Unauthorized user');
  }

  const userMessage = text?.toLowerCase().trim() || '';

  // === ЛОГІКА ПРЯМИХ ВІДПОВІДЕЙ ===

  // Про керівника
  if (userMessage.includes('керівник') || userMessage.includes('директор') || userMessage.includes('сео') || userMessage.includes('головний') || userMessage.includes('шеф')) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.');
    return res.status(200).send('CEO Answer Sent');
  }

  // Запити на документи
  if (userMessage.includes('музична довідка') || userMessage.includes('шаблон музичної довідки')) {
    await bot.sendMessage(id, `🎼 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music Certificate Sent');
  }
  if (userMessage.includes('технічні вимоги') || userMessage.includes('шаблон технічних вимог')) {
    await bot.sendMessage(id, `📄 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical Requirements Sent');
  }
  if (userMessage.includes('гарантійний лист') || userMessage.includes('шаблон гарантійного листа')) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee Letter Sent');
  }

  // Питання про контакти або планування кампанії
  if (
    userMessage.includes('контактів') ||
    userMessage.includes('скільки контактів') ||
    userMessage.includes('планування кампанії') ||
    userMessage.includes('купити контакти')
  ) {
    await bot.sendMessage(id, `📊 Ось інформація щодо планування та контактів:\n\n${benchmark}`);
    return res.status(200).send('Benchmark Info Sent');
  }

  // Гумор
  if (userMessage.includes('анекдот') || userMessage.includes('жарт')) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, `🎉 Ось тобі жарт:\n${randomJoke}`);
    return res.status(200).send('Joke Sent');
  }

  // === GPT-Підключення ===
  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone. Відповідай професійно і стисло, на основі знань компанії.
Не вигадуй інформацію. Якщо не впевнений — скажи, що не знаєш.

${credentials}
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
    console.log('OpenAI full response:', JSON.stringify(data, null, 2));

    const reply = data.choices?.[0]?.message?.content;

    if (reply && !reply.toLowerCase().includes('немає інформації')) {
      await bot.sendMessage(id, reply);
    } else {
      await bot.sendMessage(id, `Я ще вчуся, тому не на всі питання можу відповісти. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.`);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
