// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантаження бази знань
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');

// Завантаження шаблонів документів
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

  if (!body.message) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);

  // Коментар або видалення перевірки ID
// console.log(`User ${userId} is accessing the bot`);

  const userMessage = text?.toLowerCase().trim() || '';

  // === ЛОГІКА: пріоритет шаблонних відповідей
  // Вітання
if (userMessage === '/start' || userMessage.includes('привіт')) {
  await bot.sendMessage(id, `Привіт! Я — віртуальний помічник Vidzone. Допоможу знайти інформацію про компанію, послуги, документи, чи розповісти щось цікаве. Просто напиши питання, яке тебе цікавить 🙂`);
  return res.status(200).send('Welcome Sent');
}

  // Керівник компанії
  if (userMessage.includes('керівник') || userMessage.includes('CEO') || userMessage.includes('директор') || userMessage.includes('сео') || userMessage.includes('шеф') || userMessage.includes('CEO') || userMessage.includes('головний')) {
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
  if (userMessage.includes('анекдот') || userMessage.includes('жарт') || userMessage.includes('смішне')|| userMessage.includes('веселе')) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke);
    return res.status(200).send('Joke Sent');
  }

 

  // Інші питання → GPT
  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone. Відповідай професійно, стисло, але дружелюбно тільки на основі знань компанії.
Не вигадуй інформацію. Якщо не впевнений — скажи, що краще звернутися до менеджера.
У відповіді вказуй контакти лише комерційного директора: Анна Ільєнко (a.ilyenko@vidzone.com). Не згадуй інших контактних осіб, навіть якщо вони є в базі знань.


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

    if (reply && !reply.includes('немає інформації')) {
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
