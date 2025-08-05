// /api/webhook.mjs
import { retrieveRelevantChunks } from '../lib/rag.mjs'; // шлях перевірено
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Шаблони документів
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// Анекдоти
const jokes = [
  'Чому реклама на Vidzone ніколи не спить? Бо вона в ефірі навіть уночі! 😄',
  'Що каже Vidzone перед стартом кампанії? «Тримайся, ефір зараз вибухне!» 📺',
  'На Vidzone рекламу бачать навіть ті, хто не дивиться телевізор! 😎',
];

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);
  const userMessage = text?.toLowerCase().trim() || '';

  // === Пріоритет шаблонних відповідей ===
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      'Привіт! Я — віртуальний помічник Vidzone. Допоможу знайти інформацію про компанію, послуги, документи, чи розповісти щось цікаве. Просто напиши питання, яке тебе цікавить 🙂'
    );
    return res.status(200).send('Welcome Sent');
  }

  if (
    userMessage.includes('керівник') ||
    userMessage.includes('ceo') ||
    userMessage.includes('директор') ||
    userMessage.includes('сео') ||
    userMessage.includes('шеф') ||
    userMessage.includes('головний')
  ) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.');
    return res.status(200).send('CEO Answer Sent');
  }

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

  if (userMessage.includes('гарантійний лист') || userMessage.includes('шаблон гарантійного листа')) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee Letter Sent');
  }

  if (
    userMessage.includes('анекдот') ||
    userMessage.includes('жарт') ||
    userMessage.includes('смішне') ||
    userMessage.includes('веселе')
  ) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke);
    return res.status(200).send('Joke Sent');
  }

  // === RAG: релевантні фрагменти для GPT ===
  let rag = { blocks: [], debug: [] };
  try {
    rag = await retrieveRelevantChunks(text, process.env.OPENAI_API_KEY);
    // для діагностики у верцел-логах:
    console.log('RAG top:', rag.debug.map(x => ({ file: x.filename, score: Number(x.score?.toFixed?.(3) ?? x.score) })));
  } catch (e) {
    console.error('RAG error:', e);
  }

  const knowledgeBlock =
    Array.isArray(rag.blocks) && rag.blocks.length
      ? rag.blocks.join('\n\n---\n\n')
      : '⚠️ Релевантні фрагменти у базі знань не знайдено. Якщо питання критичне — порадь звернутися до менеджера.';

  // Один-єдиний system prompt (без дублювань)
  const systemPrompt = `
Ти — офіційний AI‑помічник Vidzone. Відповідай стисло, професійно та дружньо.
Використовуй ТІЛЬКИ наведені нижче фрагменти знань. Якщо відповіді немає у фрагментах — скажи, що краще звернутися до менеджера.
У відповідях вказуй контакти лише комерційного директора: Анна Ільєнко (a.ilyenko@vidzone.com).

# База знань (релевантні фрагменти):
${knowledgeBlock}
`.trim();

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // можна залишити 'gpt-3.5-turbo', але цей точніший/стабільніший
        temperature: 0.2,     // менше креативу → менше «вигадок»
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    console.log('OpenAI full response:', JSON.stringify(data, null, 2));

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (reply && !reply.toLowerCase().includes('немає інформації')) {
      await bot.sendMessage(id, reply);
    } else {
      await bot.sendMessage(
        id,
        'Я ще вчуся, тому не на всі питання можу відповісти. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.'
      );
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    return res.status(500).send('OpenAI error');
  }
}
