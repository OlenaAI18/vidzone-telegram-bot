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

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`); // Логування запиту

  const allowedIds = process.env.ALLOWED_USER_IDS?.split(',') || [];

  if (!allowedIds.includes(userId.toString())) {
    await bot.sendMessage(id, '⛔️ Цей бот є приватним.');
    return res.status(200).send('Unauthorized user');
  }

  const userMessage = text?.toLowerCase().trim() || '';

  // === ЛОГІКА: спочатку перевіряємо відомі запити

  // Керівник компанії
  if (userMessage.includes('керівник') || userMessage.includes('директор') || userMessage.includes('сео') || userMessage.includes('головний')) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.');
    return res.status(200).send('CEO Answer Sent');
  }

  // Документи
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

  // === GPT
  const systemPrompt = `
Ти — офіційний AI-помічник компанії Vidzone.

Відповідай коротко, дружньо і професійно. Не використовуй складні терміни або важкі формулювання — говори так, ніби пояснюєш клієнту.

Якщо запит стосується Vidzone (послуги, історія, конкурентні переваги) — використовуй базу знань нижче, навіть якщо відповідь загальна або коротка.

Якщо точної інформації немає — надай загальну відповідь на основі наявних даних і запропонуй звернутися до Анни Ільєнко (a.ilyenko@vidzone.com).

Не вигадуй дані. Якщо запит не стосується Vidzone або OTT-реклами — поясни, що можеш допомогти тільки з інформацією про Vidzone.

Важливо: надавай приклади, якщо вони є в базі знань. Використовуй факти.

# База знань Vidzone:
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
    console.log('OpenAI full response:', JSON.stringify(data, null, 2)); // Лог відповіді

    const reply = data.choices?.[0]?.message?.content;

    if (reply && !reply.toLowerCase().includes('немає інформації')) {
      await bot.sendMessage(id, reply);
    } else {
      // Fallback якщо GPT нічого не знайшов
      await bot.sendMessage(id, `Я ще вчуся, тому не на всі питання можу відповісти. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.`);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
