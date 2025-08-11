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

// Шляхи до .docx файлів
const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

// Веселі факти про Vidzone (жарти)
const jokes = [
  'Vidzone — єдине місце, де «Skip Ad» не кнопка, а життєва позиція.',
  'У нас 98% VTR. Ті 2% — це кіт, що випадково наступив на пульт.',
  'Наш таргетинг знає, який у вас серіал, ще до того, як ви його ввімкнете.',
  'Ми показуємо рекламу навіть тим, хто «ніколи її не бачить». Привіт, YouTube Premium!',
  'Vidzone — єдина реклама, яку дивляться на великому екрані із задоволенням… або принаймні без втечі.',
  'Наша реклама така таргетована, що здається, ніби ми чули вашу розмову… (ні, це не так… чи так?).',
  'Vidzone — місце, де «рекламний шум» звучить як музика для медіапланера.',
  'Ми показуємо рекламу навіть тим, хто ховається за диваном.',
  'Vidzone: коли хочеться купити, ще до того, як зрозумів, що хочеться.',
  'Vidzone — це коли «рекламу дивляться всі», і навіть собака.',
];

// Кнопки головного меню
const mainMenuKeyboard = {
  reply_markup: {
    resize_keyboard: true,
    keyboard: [
      [{ text: '📺 Про Vidzone' }, { text: '📃 Шаблони документів' }],
      [{ text: '😄 Веселе про Vidzone' }, { text: '❓ Допомога' }],
    ],
  },
};

// Кнопки вибору документа
const documentsMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📃 Гарантійний лист', callback_data: 'doc_guaranteeLetter' },
        { text: '⚙️ Технічні вимоги', callback_data: 'doc_techRequirements' },
      ],
      [{ text: '🎵 Музична довідка', callback_data: 'doc_musicCertificate' }],
      [{ text: '⬅️ Повернутися в меню', callback_data: 'back_to_menu' }],
    ],
  },
};

// Кнопки вибору формату документа
const documentFormatKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📄 Текстом', callback_data: 'doc_text' },
        { text: '📝 Файлом Word', callback_data: 'doc_word' },
      ],
      [{ text: '⬅️ Повернутися в меню', callback_data: 'back_to_menu' }],
    ],
  },
};

// Збережемо поточний вибір користувача
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

    if (data === 'back_to_menu') {
      userDocumentRequests.delete(userId);
      await bot.sendMessage(chatId, 'Головне меню:', mainMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'show_documents') {
      userDocumentRequests.set(userId, 'menu'); // позначка, що зараз в меню документів
      await bot.sendMessage(chatId, 'Оберіть документ:', documentsMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data.startsWith('doc_') && !data.includes('text') && !data.includes('word')) {
      // Вибір конкретного документа
      const docKey = data.replace('doc_', '');
      userDocumentRequests.set(userId, docKey);
      await bot.sendMessage(chatId, 'Оберіть формат документа:', documentFormatKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'doc_text' || data === 'doc_word') {
      const docKey = userDocumentRequests.get(userId);

      if (!docKey) {
        await bot.sendMessage(chatId, 'Вибачте, не зміг визначити, який документ ви запитували. Будь ласка, спробуйте ще раз.');
        await bot.answerCallbackQuery(callbackQuery.id);
        return res.status(200).send('ok');
      }

      if (data === 'doc_text') {
        let textContent = '';
        if (docKey === 'guaranteeLetter') textContent = guaranteeLetter;
        else if (docKey === 'techRequirements') textContent = techRequirements;
        else if (docKey === 'musicCertificate') textContent = musicCertificate;

        await bot.sendMessage(chatId, textContent || 'Текст наразі недоступний.');
        await logToGoogleSheet({
          timestamp: new Date().toISOString(),
          userId,
          userMessage: `Відправка документа текстом: ${docKey}`,
          botResponse: 'Відправлено текст',
        });
      } else if (data === 'doc_word') {
        let filePath = null;
        if (docKey === 'guaranteeLetter') filePath = guaranteeLetterDocx;
        else if (docKey === 'techRequirements') filePath = techRequirementsDocx;
        else if (docKey === 'musicCertificate') filePath = musicCertificateDocx;

        if (filePath) {
          await bot.sendDocument(chatId, filePath);
          await logToGoogleSheet({
            timestamp: new Date().toISOString(),
            userId,
            userMessage: `Відправка документа Word файлом: ${docKey}`,
            botResponse: 'Відправлено Word файл',
          });
        } else {
          await bot.sendMessage(chatId, 'Файл наразі недоступний.');
        }
      }

      userDocumentRequests.delete(userId); // очищаємо після відповіді
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

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
      `Привіт! Я — віртуальний помічник Vidzone. Ось що я можу:\n\n` +
      `• Розповісти про компанію, послуги, планування все що тебе цікавить з цифрами та фактами\n` +
      `• Надати шаблони документів (технічні вимоги, музична довідка, гарантійний лист)\n` +
      `• Розповісти щось веселе про Vidzone\n` +
      `• Допомогти з інформацією по рекламним кейсам і аудиторії  ринку, в якому ми працюємо. Все те, що допоможе зробити розміщення максимально ефективним`,
      mainMenuKeyboard
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
    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage,
      botResponse: 'CEO Vidzone — Євген Левченко.',
    });
    return res.status(200).send('CEO Answer Sent');
  }

  if (
    userMessage.includes('веселе') ||
    userMessage.includes('жарт') ||
    userMessage.includes('анекдот') ||
    userMessage.includes('смішне')
  ) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke);
    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage,
      botResponse: `Жарт: ${randomJoke}`,
    });
    return res.status(200).send('Joke Sent');
  }

  if (
    userMessage.includes('документ') ||
    userMessage.includes('шаблон') ||
    userMessage.includes('гарантійний лист') ||
    userMessage.includes('технічні вимоги') ||
    userMessage.includes('музична довідка')
  ) {
    // Запропонувати меню документів
    userDocumentRequests.set(userId, 'menu');
    await bot.sendMessage(id, 'Оберіть документ:', documentsMenuKeyboard);
    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage,
      botResponse: 'Запропоновано вибір документа',
    });
    return res.status(200).send('Document menu sent');
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
       'не впевнений',
       'не знаю',
       'немає інформації',
       'не можу відповісти',
       'передбачаю',
       'гіпотетично',
       'уявіть',
       'в теорії',
    ];

    const containsSuspicious = suspiciousPhrases.some((phrase) =>
      reply.toLowerCase().includes(phrase)
    );

    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage,
      botResponse: reply || 'Відповідь відсутня або замінена на шаблон',
    });

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
