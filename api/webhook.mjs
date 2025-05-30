import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантажуємо Markdown файли
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

// Базові тексти
const fallbackText = `
Я ще вчуся, тому не на всі питання можу відповісти. Поки моїх знань недостатньо для твого запиту. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.
`;

const brandText = `
Реклама на DigitalTV допомагає формувати довготривалий контакт бренду з аудиторією. Vidzone допомагає будувати довіру та підвищувати впізнаваність серед якісної аудиторії.
`;

// Вітальне повідомлення
const welcomeMessage = `
Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
• отримати актуальну інформацію про Vidzone та ринок DigitalTV;
• надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
• спланувати кампанію Digital TV;
• отримати трохи DigitalTV-шного гумору.

📝 Просто напишіть запитання або тему, яка вас цікавить.
Наприклад:
«Скільки контактів потрібно для кампанії?»
«Що таке Vidzone?»
«Які технічні вимоги до роликів?»
`;

// Документи
const documentsMenu = `
Окей! Які документи вам потрібні? Виберіть один із варіантів:
1. Музична довідка
2. Технічні вимоги
3. Гарантійний лист
`;

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

  // Вітання
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(id, welcomeMessage);
    return res.status(200).send('Welcome sent');
  }

  // Запит на документи
  if (userMessage.includes('довідка') || userMessage.includes('технічні вимоги') || userMessage.includes('гарантійний лист') || userMessage.includes('документ')) {
    await bot.sendMessage(id, documentsMenu);
    return res.status(200).send('Document menu sent');
  }

  // Відповіді на конкретні запити документів
  if (userMessage.includes('музична довідка') || userMessage === '1') {
    await bot.sendMessage(id, `🎼 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music certificate sent');
  }
  if (userMessage.includes('технічні вимоги') || userMessage === '2') {
    await bot.sendMessage(id, `📄 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical requirements sent');
  }
  if (userMessage.includes('гарантійний лист') || userMessage === '3') {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // Відповідь про керівника/CEO
  if (userMessage.includes('керівник') || userMessage.includes('сео') || userMessage.includes('директор') || userMessage.includes('головний')) {
    await bot.sendMessage(id, `CEO Vidzone — Євген Левченко.`);
    return res.status(200).send('CEO answer sent');
  }

  // Запитання про бренди, рекламу, планування
  if (userMessage.includes('бренд') || userMessage.includes('реклама') || userMessage.includes('побудова бренду') || userMessage.includes('контактів')) {
    await bot.sendMessage(id, brandText);
    return res.status(200).send('Brand answer sent');
  }

  // Системний промпт GPT з базою знань
  const systemPrompt = `
Ти — офіційний помічник Vidzone. Відповідай коротко, професійно і дружньо.
Використовуй інформацію з бази знань нижче:

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
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content;

    if (reply) {
      await bot.sendMessage(id, reply);
    } else {
      await bot.sendMessage(id, fallbackText);
    }
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
