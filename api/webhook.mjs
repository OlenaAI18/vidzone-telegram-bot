import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

import { logToGoogleSheet } from '../googleSheetsLogger.js'; // або відкоригуй шлях
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Текстові шаблони
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// Шляхи до .docx файлів (потрібно попередньо створити і покласти сюди)
const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

// Анекдоти
const jokes = [
  'Чому реклама на Vidzone ніколи не спить? Бо вона в ефірі навіть уночі! 😄',
  'Що каже Vidzone перед стартом кампанії? «Тримайся, ефір зараз вибухне!» 📺',
  'На Vidzone рекламу бачать навіть ті, хто не дивиться телевізор! 😎',
];

// Кнопки вибору формату документа
const documentOptionsKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Текстом 📄', callback_data: 'doc_text' },
        { text: 'Файлом Word 📝', callback_data: 'doc_word' },
      ],
    ],
  },
};

// Збережемо в тимчасовому обʼєкті, який документ зараз пропонуємо (щоб callback міг знати контекст)
const userDocumentRequests = new Map();

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text && !body?.callback_query) return res.status(200).send('Non-message update skipped');

  // Обробка callback_query (натискання кнопок)
  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Дізнаємось, який документ цей користувач вибрав раніше
    const docKey = userDocumentRequests.get(userId);

    if (!docKey) {
      await bot.sendMessage(chatId, 'Вибачте, не зміг визначити, який документ ви запитували. Будь ласка, спробуйте ще раз.');
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'doc_text') {
      // Відправка текстового варіанту
      if (docKey === 'guaranteeLetter') {
        await bot.sendMessage(chatId, guaranteeLetter);
      } else if (docKey === 'techRequirements') {
        await bot.sendMessage(chatId, techRequirements);
      } else if (docKey === 'musicCertificate') {
        await bot.sendMessage(chatId, musicCertificate);
      }
    } else if (data === 'doc_word') {
      // Відправка Word-файлу
      let filePath = null;
      if (docKey === 'guaranteeLetter') filePath = guaranteeLetterDocx;
      else if (docKey === 'techRequirements') filePath = techRequirementsDocx;
      else if (docKey === 'musicCertificate') filePath = musicCertificateDocx;

      if (filePath) {
        await bot.sendDocument(chatId, filePath);
      } else {
        await bot.sendMessage(chatId, 'Файл наразі недоступний.');
      }
    }

    userDocumentRequests.delete(userId); // чистимо запис після відповіді
    await bot.answerCallbackQuery(callbackQuery.id);
    return res.status(200).send('ok');
  }

  // Звичайний текстовий запит (message.text)
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
    // Зберігаємо, що користувач хоче цей документ
    userDocumentRequests.set(userId, 'musicCertificate');
    await bot.sendMessage(id, 'Оберіть формат документа:', documentOptionsKeyboard);
    return res.status(200).send('Music Certificate options sent');
  }

  if (
    userMessage.includes('технічні вимоги') ||
    userMessage.includes('шаблон технічних вимог') ||
    userMessage.includes('тех вимоги') ||
    userMessage.includes('вимоги до роликів')
  ) {
    userDocumentRequests.set(userId, 'techRequirements');
    await bot.sendMessage(id, 'Оберіть формат документа:', documentOptionsKeyboard);
    return res.status(200).send('Technical Requirements options sent');
  }

  if (userMessage.includes('гарантійний лист') || userMessage.includes('шаблон гарантійного листа')) {
    userDocumentRequests.set(userId, 'guaranteeLetter');
    await bot.sendMessage(id, 'Оберіть формат документа:', documentOptionsKeyboard);
    return res.status(200).send('Guarantee Letter options sent');
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
  let relevantChunks = [];
  try {
    relevantChunks = await retrieveRelevantChunks(text, process.env.OPENAI_API_KEY);
    console.log('RAG top:', relevantChunks.slice(0, 2).map(t => t.slice(0, 80)));
  } catch (e) {
    console.error('RAG error:', e);
  }

  const knowledgeBlock =
    Array.isArray(relevantChunks) && relevantChunks.length
      ? relevantChunks.join('\n\n---\n\n')
      : '';

  const systemPrompt = `
Ти — офіційний AI‑помічник Vidzone. Відповідай стисло, професійно і дружньо.
Використовуй ТІЛЬКИ наведені нижче фрагменти знань. Якщо відповіді немає у фрагментах — скажи, що краще звернутися до менеджера.
Не вигадуй, не додавай інформацію, якої немає у знаннях.
У відповідях вказуй контакти лише комерційного директора: Анна Ільєнко (a.ilyenko@vidzone.com).
Не відповідай на питання, які виходять за межі бази знань.

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
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    console.log('OpenAI full response:', JSON.stringify(data, null, 2));

    const reply = data?.choices?.[0]?.message?.content?.trim() || '';

    const suspiciousPhrases = [
      'я можу',
      'уявіть',
      'в теорії',
      'гіпотетично',
      'на мою думку',
      'можливо',
      'не впевнений',
      'не знаю',
      'немає інформації',
      'не можу відповісти',
      'я думаю',
      'передбачаю',
    ];

    const containsSuspicious = suspiciousPhrases.some((phrase) =>
      reply.toLowerCase().includes(phrase)
    );

    if (!reply || containsSuspicious) {
      await bot.sendMessage(
        id,
        'Я ще вчуся, тому не на всі питання можу відповісти. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.'
      );
    } else {
      await bot.sendMessage(id, reply);
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    return res.status(500).send('OpenAI error');
  }
}
