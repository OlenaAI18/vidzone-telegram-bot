import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';
import { logToGoogleSheet } from '../googleSheetsLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===== Текстові шаблони
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

// ===== Шляхи до .docx
const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

// ===== Жарти
const jokes = [
  'Vidzone — єдине місце, де «Skip Ad» не кнопка, а життєва позиція.',
  'У нас 99% VTR. Той 1% — це кіт, що випадково наступив на пульт.',
  'Наш таргетинг знає, який у вас серіал, ще до того, як ви його ввімкнете.',
  'Ми показуємо рекламу навіть тим, хто «ніколи її не бачить». Привіт, YouTube Premium!',
  'Vidzone — єдина реклама, яку дивляться на великому екрані із задоволенням… або принаймні без втечі.',
  'Наша реклама така таргетована, що здається, ніби ми чули вашу розмову… (ні, це не так… чи так?).',
  'Vidzone — місце, де «рекламний шум» звучить як музика для медіапланера.',
  'Ми показуємо рекламу навіть тим, хто ховається за диваном.',
  'Vidzone: коли хочеться купити, ще до того, як зрозумів, що хочеться.',
  'Vidzone — це коли «рекламу дивляться всі», і навіть собака.',
  'У Vidzone навіть реклама знає твоє ім’я… і улюблений серіал.',
  'Vidzone: «Ми бачимо, що ти любиш риболовлю». — «Я ж просто один раз глянув!»',
  'У Vidzone реклама таргетована так, що навіть холодильник починає сумніватися, чи він не людина.',
  'Vidzone — там, де твій телевізор знає більше про тебе, ніж твій найкращий друг.',
  'Vidzone — єдине місце, где 15 секунд реклами пролітають як 5.',
  'Vidzone — коли реклама підлаштовується під тебе швидше, ніж Spotify під настрій.',
  'Кажуть, що немає ідеалу. А ми бачили Vidzone на Smart TV.',
  'Vidzone — це як чарівник, тільки замість кролика з капелюха — ролик із твоїм улюбленим шоколадом.',
  'Vidzone не просто таргетує — він читає між рядків твоїх думок.',
  'У Vidzone реклама настільки влучна, що навіть кіт підходить ближче до екрану.',
  'Vidzone — там, де рекламу не перемотуєш, бо шкода пропустити.',
  'Vidzone: ми знаємо, що ти дивився вчора ввечері (і маємо для тебе рекламу).',
  'Vidzone — це як друзі, які завжди знають, що тобі порадити.',
  'Vidzone — коли реклама стає другою серією твого фільму.',
  'Vidzone — коли навіть холодильник зацікавився твоїм Smart TV.',
  'Vidzone: місце, де реклама ідеальна, як свіжий круасан.',
  'Vidzone — коли реклама закінчується, а ти такий: «Ще одну, будь ласка!»',
  'Vidzone знає, що ти вмикаєш телевізор не тільки заради фільму.',
  'Vidzone робить так, щоб реклама не заважала життю, а прикрашала його.',
  'Vidzone — коли тобі здається, що реклама стала розумнішою за тебе.',
  'Vidzone: ми не просто показуємо рекламу, ми робимо її твоєю.',
  'Vidzone — коли «Skip» навіть не приходить в голову.',
  'Vidzone — це як гуглити без гуглу: він уже знає, що тобі треба.',
  'Vidzone — коли реклама співпадає з твоїм списком покупок.',
  'Vidzone — це як чарівне дзеркало, але воно показує твої бажання у форматі HD.',
  'Vidzone: де рекламу чекають, а не терплять.',
  'Vidzone — це коли твої друзі питають: «Де ти таку рекламу бачив?»',
  'Vidzone — коли реклама потрапляє в ціль без жодного промаху.',
  'Vidzone — коли навіть Wi-Fi готовий працювати швидше заради цієї реклами.',
  'Vidzone: там, де кожен ролик наче створений особисто для тебе.',
];

// ============================
// Намір-класифікація
// ============================
const CONTACT_ANI = 'Анна Ільєнко — a.ilyenko@vidzone.com';

const INTENT = {
  VIDZONE: 'vidzone',
  ESCALATE: 'escalate',
  OFFTOPIC: 'offtopic',
  META: 'meta',
};

// Ключові патерни: усе, що має стосунок до Vidzone/CTV/OTT/таргетингу/пакетів/цін
const VIDZONE_PATTERNS = [
  /\bvidzone\b/i, /\bвідзон\w*\b/i, /\bвидзон\w*\b/i,
  /\bott\b/i, /\bctv\b/i, /\bsmart ?tv\b/i, /\bпрограмматік\b/i,
  /\bсегмент\w*\b/i, /\bтаргет(ин|ін)г\b/i, /\bгео-?таргетинг\b/i,
  /\bпакет\w*\b/i, /\bжіноч(ий|і)\b/i, /\bчоловіч(ий|і)\b/i, /\bунісекс\b/i, /\bмандрівник\w*\b/i,
  /\bціна\b/i, /\bвартіст\w*\b/i, /\bcpm\b/i, /\bcpt\b/i, /\bхронометраж\b/i,
  /\bтехнічн\w+\s+вимог\w*\b/i, /\bролик\w*\b/i, /\bдодивленн\w*\b/i,
  /\bофіс\b/i, /\bадреса\b/i, /\bрік заснуванн\w*\b/i, /\bскільки років працює\b/i,
  /\bводафон\b/i, /\bvodafone tv\b/i, /\bплатформ\w*\b/i, /\bканал\w*\b/i,
  /\bмоніторинг\b/i, /\bохопленн\w*\b/i, /\bчастот\w*\b/i,
  /\bпрогноз\b/i, /\bтренд\w*\b/i,
  /\bшкодкін\b/i, /\bєвген левченко\b/i
];

// Off-topic (все «ліве», включно з чутливим — без ескалації)
const OFFTOPIC_PATTERNS = [
  // історія/війна/політика/енциклопедія
  /\bдруга\s+світов\w*\b/i,
  /\bсвітов\w*\s+війна\b/i,
  /\bколи\s+почал\w*\s+(?:2|ii|друг\w*)\s+світов\w*\s+війна\b/i,
  /\bвійна\b/i,
  /\bполітик\w*\b/i,
  /\bісторі\w*\b/i,
  /\bтелевізор\s+(?:коли|коли було)\s+(?:винайдено|винайшли)\b/i,
  /\bколи\s+винайдено\b/i,
  /\bколи\s+винайшли\b/i,
  // побутове
  /\bрецепт\w*\b/i,
  /\bвареник\w*\b/i,
  /\bборщ\b/i,
  /\bпогода\b/i,
  /\bкурс(и)?\s+(долара|валют)\b/i,
  // чутливе/особисте
  /\bзарплат\w*\b/i,
  /\bсекрет\w*\b/i
];

// Ескалація: A/B, спонсорство, запити по конкретних звітах/інцидентах (всередині Vidzone-домену)
const ESCALATE_PATTERNS = [
  /\b(?:a\/?b|avb)(?:[\s-]?тест\w*)?\b/i,
  /\bспонсорств\w*\b/i,
  /\bу\s+звіті\s+є\b/i, /\bяк\s+так\s+сталося\b/i, /\bнетипов\w*\s+вихід\b/i
];

// Meta (про бота/похвала)
const META_PATTERNS = [
  /\bчим\s+можеш\s+допомогти\b/i, /\bщо\s+ти\s+вмієш\b/i, /\bщо\s+ти\s+можеш\b/i,
  /\bну\s+ти.*розумн\w*\b/i, /\bдякую\b/i
];

// Класифікатор (до RAG)
function classifyByRules(text) {
  if (ESCALATE_PATTERNS.some(p => p.test(text))) return INTENT.ESCALATE;
  if (META_PATTERNS.some(p => p.test(text))) return INTENT.META;
  if (VIDZONE_PATTERNS.some(p => p.test(text))) return INTENT.VIDZONE;
  if (OFFTOPIC_PATTERNS.some(p => p.test(text))) return INTENT.OFFTOPIC;
  return null;
}

// Шаблони відповідей
const TEMPLATES = {
  META_CAPS:
    'Я допомагаю з усім, що стосується Vidzone: тарифи/CPM, пакети та аудиторії, OTT/CTV (загальні тренди з прив’язкою до наших продуктів), технічні вимоги й документи. Також підкажу з плануванням кампаній.',
  OFFTOPIC_POLITE:
    'Вибачте, але я можу надавати інформацію лише про рекламні послуги та продукти компанії Vidzone. Якщо у вас є питання щодо реклами — із радістю допоможу.',
  ESCALATE_ANI:
    `Це краще уточнити з комерційним директором. Контакт: ${CONTACT_ANI}.`,
  FALLBACK_VIDZONE_HINT:
    'Я спеціалізуюся на Vidzone. Сформулюй, будь ласка, питання в рамках OTT/CTV, пакетів, таргетингу, цін або технічних вимог.',
};

// ===== Клавіатури
const mainMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📺 Про Vidzone', callback_data: 'menu_about' }, { text: '📄 Шаблони документів', callback_data: 'menu_documents' }],
      [{ text: '😄 Веселе про Vidzone', callback_data: 'menu_jokes' }, { text: '❓ Задати питання', callback_data: 'menu_help' }],
    ],
  },
};
const documentMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📝 Гарантійний лист', callback_data: 'doc_guaranteeLetter' }, { text: '📄 Технічні вимоги', callback_data: 'doc_techRequirements' }],
      [{ text: '🎼 Музична довідка', callback_data: 'doc_musicCertificate' }],
      [{ text: '↩️ Повернутися в меню', callback_data: 'back_to_menu' }],
    ],
  },
};
const documentFormatKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📄 Текстом', callback_data: 'format_text' }, { text: '📝 Файлом Word', callback_data: 'format_word' }],
      [{ text: '↩️ Повернутися до вибору документів', callback_data: 'back_to_documents' }],
    ],
  },
};

// Тимчасова памʼять вибору документів
const userDocumentRequests = new Map();

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text && !body?.callback_query) return res.status(200).send('Non-message update skipped');

  // ===== Callback (кнопки)
  if (body.callback_query) {
    const callbackQuery = body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    if (data === 'menu_about') {
      await bot.sendMessage(
        chatId,
        'Vidzone — технологічна DSP-платформа для автоматизованої реклами на цифровому телебаченні (Smart TV, OTT). Дає змогу запускати программатік-рекламу з гнучким таргетингом і контролем бюджету.',
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
      await bot.sendMessage(chatId, 'Пишіть будь-яке питання — допоможу знайти інформацію по Vidzone. Якщо не знаю, підкажу, до кого звернутися.', mainMenuKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data.startsWith('doc_')) {
      userDocumentRequests.set(userId, data.replace('doc_', ''));
      await bot.sendMessage(chatId, 'Оберіть формат документа:', documentFormatKeyboard);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

    if (data === 'format_text' || data === 'format_word') {
      const docKey = userDocumentRequests.get(userId);
      if (!docKey) {
        await bot.sendMessage(chatId, 'Вибачте, не можу визначити, який документ ви обрали. Будь ласка, спробуйте знову.', documentMenuKeyboard);
        await bot.answerCallbackQuery(callbackQuery.id);
        return res.status(200).send('ok');
      }

      if (data === 'format_text') {
        if (docKey === 'guaranteeLetter') {
          await bot.sendMessage(chatId, guaranteeLetter, documentMenuKeyboard);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: 'Вибрав документ Гарантійний лист (текст)', botResponse: guaranteeLetter });
        } else if (docKey === 'techRequirements') {
          await bot.sendMessage(chatId, techRequirements, documentMenuKeyboard);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: 'Вибрав документ Технічні вимоги (текст)', botResponse: techRequirements });
        } else if (docKey === 'musicCertificate') {
          await bot.sendMessage(chatId, musicCertificate, documentMenuKeyboard);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: 'Вибрав документ Музична довідка (текст)', botResponse: musicCertificate });
        }
      } else {
        let filePath = null;
        if (docKey === 'guaranteeLetter') filePath = guaranteeLetterDocx;
        else if (docKey === 'techRequirements') filePath = techRequirementsDocx;
        else if (docKey === 'musicCertificate') filePath = musicCertificateDocx;

        if (filePath) {
          await bot.sendDocument(chatId, filePath);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: `Вибрав документ ${docKey} (Word-файл)`, botResponse: `Відправлено файл ${filePath}` });
        } else {
          await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        }
      }

      userDocumentRequests.delete(userId);
      await bot.answerCallbackQuery(callbackQuery.id);
      return res.status(200).send('ok');
    }

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

    await bot.answerCallbackQuery(callbackQuery.id);
    return res.status(200).send('ok');
  }

  // ===== Текстовий запит
  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  console.log(`User asked: ${text}`);
  const userMessage = (text || '').toLowerCase().trim();

  // Пріоритетні відповіді
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      `Привіт! Я — віртуальний помічник Vidzone. Ось що я можу:\n\n` +
        `• Розповісти про компанію, послуги, планування РК та рекламу на digital TV\n` +
        `• Надати шаблони документів (технічні вимоги, музична довідка, гарантійний лист)\n` +
        `• Розповісти щось веселе про Vidzone\n` +
        `• Допомогти з інформацією по пакетах, таргетингу, CPM/CPT, OTT/CTV, щоб зробити розміщення максимально ефективним`,
      mainMenuKeyboard
    );
    return res.status(200).send('Welcome Sent');
  }

  if (userMessage.includes('керівник') || userMessage.includes('ceo') || userMessage.includes('директор') || userMessage.includes('сео') || userMessage.includes('шеф') || userMessage.includes('головний')) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.', mainMenuKeyboard);
    return res.status(200).send('CEO Answer Sent');
  }

  if (userMessage.includes('анекдот') || userMessage.includes('жарт') || userMessage.includes('смішне') || userMessage.includes('веселе')) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke, mainMenuKeyboard);
    return res.status(200).send('Joke Sent');
  }

  // Крок 1: класифікація
  let intent = classifyByRules(userMessage); // може бути null

  // Крок 2: RAG
  let relevantChunks = [];
  try {
    relevantChunks = await retrieveRelevantChunks(text, process.env.OPENAI_API_KEY);
    console.log('RAG top:', relevantChunks.slice(0, 2).map(t => t.slice(0, 80)));
  } catch (e) {
    console.error('RAG error:', e);
  }
  const knowledgeBlock = Array.isArray(relevantChunks) && relevantChunks.length ? relevantChunks.join('\n\n---\n\n') : '';

  // Якщо правила не визначили, але RAG знайшов — це Vidzone
  if (!intent && knowledgeBlock) intent = INTENT.VIDZONE;
  // Якщо взагалі нічого — оффтоп
  if (!intent) intent = INTENT.OFFTOPIC;

  // Крок 3: роутинг
  // 3.1 Offtopic — м’яко відсікаємо (без ескалації)
  if (intent === INTENT.OFFTOPIC) {
    const botResponse = TEMPLATES.OFFTOPIC_POLITE;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('Offtopic');
  }

  // 3.2 Ескалація — прямо до А. Ільєнко
  if (intent === INTENT.ESCALATE) {
    const botResponse = TEMPLATES.ESCALATE_ANI;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('Escalated');
  }

  // 3.3 Meta
  if (intent === INTENT.META) {
    const botResponse = TEMPLATES.META_CAPS;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('Meta');
  }

  // 3.4 Vidzone:
  // Якщо знань нема (knowledgeBlock порожній) — ескалюємо до Ільєнко
  if (intent === INTENT.VIDZONE && !knowledgeBlock) {
    const botResponse = TEMPLATES.ESCALATE_ANI;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('VidzoneNoKB_Escalated');
  }

  // Інакше — питаємо LLM тільки з RAG-контекстом
  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone. Відповідай стисло, професійно і дружньо.
Використовуй ТІЛЬКИ наведені нижче фрагменти знань. Не вигадуй.

Якщо в наведених фрагментах НІЧОГО про запит немає — скажи ескалювати питання до ${CONTACT_ANI} (і не відповідай загальними даними поза фрагментами).

# База знань (релевантні фрагменти):
${knowledgeBlock}
`.trim();

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
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

    const suspiciousPhrases = ['не впевнений', 'не знаю', 'немає інформації', 'не можу відповісти', 'передбачаю', 'гіпотетично', 'уявіть', 'в теорії'];
    const containsSuspicious = suspiciousPhrases.some((phrase) => reply.toLowerCase().includes(phrase));

    // Якщо LLM дав порожньо/сумнівно — ескалюємо
    if (!reply || containsSuspicious) {
      const botResponse = TEMPLATES.ESCALATE_ANI;
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
      await bot.sendMessage(id, botResponse, mainMenuKeyboard);
      return res.status(200).send('VidzoneLLM_FallbackEscalated');
    }

    // OK
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: userMessage, botResponse: reply });
    await bot.sendMessage(id, reply, mainMenuKeyboard);
    return res.status(200).send('ok');

  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.', mainMenuKeyboard);
    return res.status(500).send('OpenAI error');
  }
}
