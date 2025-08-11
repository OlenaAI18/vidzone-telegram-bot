import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

import { logToGoogleSheet } from '../googleSheetsLogger.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Текстові шаблони
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// Шляхи до .docx файлів
const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

// Веселі жарти про Vidzone
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

// Клавіатура головного меню
const mainMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📺 Про Vidzone', callback_data: 'menu_about' },
        { text: '📄 Шаблони документів', callback_data: 'menu_documents' },
      ],
      [
        { text: '😄 Веселе про Vidzone', callback_data: 'menu_jokes' },
        { text: '❓ Допомога', callback_data: 'menu_help' },
      ],
    ],
  },
};

// Клавіатура вибору документа
const documentMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📝 Гарантійний лист', callback_data: 'doc_guaranteeLetter' },
        { text: '📄 Технічні вимоги', callback_data: 'doc_techRequirements' },
      ],
      [
        { text: '🎼 Музична довідка', callback_data: 'doc_musicCertificate' },
      ],
      [
        { text: '↩️ Повернутися в меню', callback_data: 'back_to_menu' },
      ],
    ],
  },
};

// Клавіатура вибору формату документа
const documentFormatKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📄 Текстом', callback_data: 'format_text' },
        { text: '📝 Файлом Word', callback_data: 'format_word' },
      ],
      [
        { text: '↩️ Повернутися до вибору документів', callback_data: 'back_to_documents' },
      ],
    ],
  },
};

// Тимчасова памʼять вибору документів користувачем
const userDocumentRequests = new Map();

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text && !body?.callback_query) return res.status(200).send('Non-message update skipped');

  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Обробка навігації меню
    if (data === 'menu_about') {
      await bot.sendMessage(chatId, 
        'Vidzone — технологічна DSP-платформа для автоматизованої реклами на цифровому телебаченні (Smart TV, OTT). Платформа дозволяє рекламодавцям запускати программатік-рекламу з гнучким таргетингом і контролем бюджету. Основна мета Vidzone — забезпечити ефективне розміщення реклами з таргетингом на аудиторії цифрового ТВ.',
        mainMenuKeyboard
      );
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_jokes') {
      const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
      await bot.sendMessage(chatId, randomJoke, mainMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_help') {
      await bot.sendMessage(chatId,
        'Пишіть будь-яке питання, я допоможу знайти інформацію. Якщо не знаю — скажу звернутися до менеджера: a.ilyenko@vidzone.com',
        mainMenuKeyboard
      );
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    // Обробка вибору документа
    if (data.startsWith('doc_')) {
      userDocumentRequests.set(userId, data.replace('doc_', ''));
      await bot.sendMessage(chatId, 'Оберіть формат документа:', documentFormatKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    // Обробка вибору формату документа
    if (data === 'format_text' || data === 'format_word') {
      const docKey = userDocumentRequests.get(userId);

      if (!docKey) {
        await bot.sendMessage(chatId, 'Вибачте, не можу визначити, який документ ви обрали. Будь ласка, спробуйте знову.', mainMenuKeyboard);
        await bot.answerCallbackQuery(callbackQuery.id);
        return res.status(200).send('ok');
      }

      if (data === 'format_text') {
        // Відправка текстового варіанту
        if (docKey === 'guaranteeLetter') {
          await bot.sendMessage(chatId, guaranteeLetter, documentMenuKeyboard);
          await logToGoogleSheet({
            timestamp: new Date().toISOString(),
            userId,
            userMessage: `Вибрав документ Гарантійний лист (текст)`,
            botResponse: guaranteeLetter,
          });
        } else if (docKey === 'techRequirements') {
          await bot.sendMessage(chatId, techRequirements, documentMenuKeyboard);
          await logToGoogleSheet({
            timestamp: new Date().toISOString(),
            userId,
            userMessage: `Вибрав документ Технічні вимоги (текст)`,
            botResponse: techRequirements,
          });
        } else if (docKey === 'musicCertificate') {
          await bot.sendMessage(chatId, musicCertificate, documentMenuKeyboard);
          await logToGoogleSheet({
            timestamp: new Date().toISOString(),
            userId,
            userMessage: `Вибрав документ Музична довідка (текст)`,
            botResponse: musicCertificate,
          });
        }
      } else {
        // Відправка Word-файлу
        let filePath = null;
        if (docKey === 'guaranteeLetter') filePath = guaranteeLetterDocx;
        else if (docKey === 'techRequirements') filePath = techRequirementsDocx;
        else if (docKey === 'musicCertificate') filePath = musicCertificateDocx;

        if (filePath) {
          await bot.sendDocument(chatId, filePath);
          await logToGoogleSheet({
            timestamp: new Date().toISOString(),
            userId,
            userMessage: `Вибрав документ ${docKey} (Word-файл)`,
            botResponse: `Відправлено файл ${filePath}`,
          });
        } else {
          await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        }
      }

      userDocumentRequests.delete(userId);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    // Повернення в меню
    if (data === 'back_to_menu') {
      await bot.sendMessage(chatId, 'Головне меню:', mainMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'back_to_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    // Відповідь на callback, якщо немає інших обробок
    await bot.answerCallbackQuery(callbackQuery.id);
    return res.status(200).send('ok');
  }

  // Якщо це звичайний текстовий запит (message.text)
  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);
  const userMessage = text?.toLowerCase().trim() || '';

  // === Пріоритетні відповіді ===
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      `Привіт! Я — віртуальний помічник Vidzone. Ось що я можу:\n\n` +
      `• Розповісти про компанію, послуги, планування все що тебе цікавить з цифрами та фактами\n` +
      `• Надати шаблони документів (технічні вимоги, музична довідка, гарантійний лист)\n` +
      `• Розповісти щось веселе про Vidzone\n` +
      `• Допомогти з інформацією по рекламним кейсам і аудиторії ринку, в якому ми працюємо. Все те, що допоможе зробити розміщення максимально ефективним`,
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
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.', mainMenuKeyboard);
    return res.status(200).send('CEO Answer Sent');
  }

  if (
    userMessage.includes('анекдот') ||
    userMessage.includes('жарт') ||
    userMessage.includes('смішне') ||
    userMessage.includes('веселе')
  ) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke, mainMenuKeyboard);
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

    // Логування у Google Sheets
    const timestamp = new Date().toISOString();

    await logToGoogleSheet({
      timestamp,
      userId,
      userMessage,
      botResponse: reply || 'Відповідь відсутня або замінена на шаблон',
    });

    if (!reply || containsSuspicious) {
      await bot.sendMessage(
        id,
        'Я ще вчуся, тому не на всі питання можу відповісти. Але точно допоможе наша команда! Звертайся до Анни Ільєнко: a.ilyenko@vidzone.com.',
        mainMenuKeyboard
      );
    } else {
      await bot.sendMessage(id, reply, mainMenuKeyboard);
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.', mainMenuKeyboard);
    return res.status(500).send('OpenAI error');
  }
}
