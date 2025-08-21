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
// Константи, патерни, шаблони
// ============================
const CONTACT_ANI = 'Анна Ільєнко — a.ilyenko@vidzone.com';

const TEMPLATES = {
  META_CAPS:
    'Я допомагаю з усім, що стосується Vidzone: тарифи/CPM, пакети та аудиторії, OTT/CTV, технічні вимоги й документи. Також підкажу з плануванням кампаній.',
  OFFTOPIC_POLITE:
    'Вибачте, але я можу надавати інформацію лише про рекламні послуги та продукти компанії Vidzone. Якщо у вас є питання щодо реклами — із радістю допоможу.',
  ESCALATE_ANI:
    `Це краще уточнити з комерційним директором. Контакт: ${CONTACT_ANI}.`,
};

// ключові слова, які роблять запит “очевидно дотичним” (обхід gate)
const VIDZONE_HINT_RX = /\b(vidzone|відзон\w*|видзон\w*|ott|ctv|smart ?tv|dsp|ssp|programmatic|программатік|tv|телебач\w*|реклама|ролик|пакет|аудиторі\w*|таргет\w*|гео-?таргет\w*|cpm|cpt|vtr|спонсорств\w*|звіти|охопленн\w*|частот\w*)\b/i;

// AVB/A-B
const AVB_RX = /\b(avb|audio\s*video\s*bridging|a\/?b|а\/?б|авб)\b/i;

// бренд-специфічні запити типу “для клієнта Nestle”
const BRAND_SPECIFIC_RX = /\b(клієнт\w*|бренд\w*|для)\s+[A-Za-zА-Яа-яІЇЄҐієї0-9][\w&\-.]{1,}\b/i;

// швидка санітизація внутр. посилань
function sanitizeInternalRefs(text) {
  if (!text) return text;
  let out = text;
  out = out.replace(/#\s*[^#"“”\n]+\.(txt|md|docx|doc|xlsx|xls|pptx|pdf)/gi, 'внутрішні матеріали команди Vidzone');
  out = out.replace(/(?:документ(у|а|ом)?|файл(у|а|ом)?|document)\s+["“][^"”]+["”]/gi, 'внутрішні матеріали команди Vidzone');
  out = out.replace(/зверну[тт]ися\s+до\s+документ[ауі][^.,;]*[, ]*/gi, 'звернутися до внутрішніх матеріалів команди Vidzone, ');
  out = out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ', ').trim();
  return out;
}

// Нормалізація запиту: «відзон/видзон» -> "vidzone", прибираємо зайве
function normalizeQuery(s = '') {
  let t = (s || '').toLowerCase();
  t = t.replace(/\bвідзон\w*\b/gi, 'vidzone')
       .replace(/\bвидзон\w*\b/gi, 'vidzone')
       .replace(/\s{2,}/g, ' ')
       .trim();
  return t;
}

// Розширення запиту для ретрівера (додаємо корисні синоніми/контекст)
function expandForRetriever(s = '') {
  const base = normalizeQuery(s);
  const booster = ' | синоніми: Vidzone, платформа Vidzone, DSP Vidzone, OTT/CTV, Smart TV, programmatic, що таке Vidzone, опис Vidzone';
  return base.length < 20 ? (base + booster) : (base + ' ' + booster);
}

// коректна оцінка релевантності KB до запиту (Unicode)
function overlapScore(userText, kb) {
  if (!kb) return 0;
  const stop = new Set(['та','і','й','або','на','в','у','до','про','за','що','як','чи','це','ми','ви','є','з','по','для','від','без']);
  const tokens = (userText || '').toLowerCase().match(/\p{L}{3,}/gu) || []; // лише слова (будь-яка літера)
  const keys = tokens.filter(t => !stop.has(t) && t.length >= 4);
  if (!keys.length) return 0;
  const text = kb.toLowerCase();
  let hits = 0;
  for (const k of keys) if (text.includes(k)) hits++;
  return hits / keys.length;
}

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

/** === LLM gate (fallback) === */
async function isRelevantToVidzone(userText) {
  try {
    const system = `
Ти класифікатор. Визнач, чи запит тематично стосується реклами на ТБ/CTV/OTT/adtech або конкретно платформи Vidzone (послуги, пакети, CPM/CPT, аудиторії, технічні вимоги/документи, планування/звіти, інтеграції/спонсорство).
Відповідай рівно одним словом: "relevant" або "offtopic".
Не вважай релевантними погоду, курси валют, кулінарію, спорт, загальні біографії тощо.
    `.trim();

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
      }),
    });

    const data = await resp.json();
    const answer = (data?.choices?.[0]?.message?.content || '').trim().toLowerCase();
    return answer.startsWith('relevant');
  } catch (e) {
    console.error('Relevance gate error:', e);
    return false; // на збої — краще суворо (оффтоп)
  }
}

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

  // ---- Пріоритетні відповіді (перед гейтами)

  // (1) CEO / Євген Левченко — ширший матч
  const CEO_RX = /\b((є|е)вген(ий)?|yevhen|evhen|evgen|yevgen)\s+левченко\b/i;
  const CEO_ALT_RX = /\b(ceo|сео|керівник|директор)\s+(vidzone|відзон\w*|видзон\w*)\b/i;

  if (CEO_RX.test(userMessage) || CEO_ALT_RX.test(userMessage) || /levchenko\b/i.test(userMessage)) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.', mainMenuKeyboard);
    return res.status(200).send('CEO Answer Sent');
  }

  // (2) Жарти
  if (userMessage.includes('анекдот') || userMessage.includes('жарт') || userMessage.includes('смішне') || userMessage.includes('веселе')) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke, mainMenuKeyboard);
    return res.status(200).send('Joke Sent');
  }

  // (3) Старт
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

  // (4) Жорсткі тригери ескалації: AVB/A-B та бренд-запити
  if (AVB_RX.test(userMessage) || BRAND_SPECIFIC_RX.test(userMessage)) {
    const botResponse = TEMPLATES.ESCALATE_ANI;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse, note: 'Hard escalate (AVB/brand)' });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('HardEscalate');
  }

  // === КРОК 1. РЕЛЕВАНТНІСТЬ ===
  let relevant = VIDZONE_HINT_RX.test(userMessage); // обхід gate, якщо є явні ключові
  if (!relevant) relevant = await isRelevantToVidzone(text);

  if (!relevant) {
    const botResponse = TEMPLATES.OFFTOPIC_POLITE;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('OfftopicByGate');
  }

  // === КРОК 2. RAG ===
  let relevantChunks = [];
  const vidzoneHint = VIDZONE_HINT_RX.test(userMessage);

  try {
    // 1-а спроба: підсилений запит для ретрівера
    const expandedQuery = expandForRetriever(text);
    relevantChunks = await retrieveRelevantChunks(expandedQuery, process.env.OPENAI_API_KEY);

    // 2-а спроба: якщо явно про Vidzone і релевантність слабка — додатковий запит-уточнення
    const kbJoined1 = Array.isArray(relevantChunks) ? relevantChunks.join('\n\n---\n\n') : '';
    const score1 = overlapScore(normalizeQuery(userMessage), kbJoined1);

    if (vidzoneHint && (!kbJoined1 || score1 < 0.08)) {
      const secondChanceQuery = 'що таке Vidzone? опис платформи Vidzone. Vidzone — DSP для реклами на Smart TV (OTT/CTV).';
      const sc = await retrieveRelevantChunks(secondChanceQuery, process.env.OPENAI_API_KEY);
      if (Array.isArray(sc) && sc.length) {
        const seen = new Set(relevantChunks);
        for (const c of sc) if (!seen.has(c)) relevantChunks.push(c);
      }
    }
  } catch (e) {
    console.error('RAG error:', e);
  }

  const knowledgeBlock = Array.isArray(relevantChunks) && relevantChunks.length ? relevantChunks.join('\n\n---\n\n') : '';

  // Якщо KB порожній або “не про це” — ескалація (поріг м’якший для явних запитів про Vidzone)
  const kbRelevance = overlapScore(normalizeQuery(userMessage), knowledgeBlock);
  const MIN_SCORE = vidzoneHint ? 0.0 : 0.12;

  if (!knowledgeBlock || kbRelevance < MIN_SCORE) {
    const botResponse = TEMPLATES.ESCALATE_ANI;
    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage: text,
      botResponse,
      note: `Escalate: KB=${!!knowledgeBlock}, score=${kbRelevance.toFixed(2)}, vidzoneHint=${vidzoneHint}`
    });
    await bot.sendMessage(id, botResponse, mainMenuKeyboard);
    return res.status(200).send('NoOrLowKB_Escalated');
  }

  // === КРОК 3. Відповідь LLM лише з RAG-контекстом ===
  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone. Відповідай стисло, професійно і дружньо.
Використовуй ТІЛЬКИ наведені нижче фрагменти знань. Не вигадуй.
Не згадуй у відповідях назви або шляхи внутрішніх документів/файлів (типу "внутрішні кейси") — пиши просто "внутрішні матеріали команди Vidzone".
Якщо у фрагментах немає чіткої відповіді — порадь ескалувати питання до ${CONTACT_ANI}.

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
    let reply = data?.choices?.[0]?.message?.content?.trim() || '';

    const suspiciousPhrases = ['не впевнений', 'не знаю', 'немає інформації', 'не можу відповісти', 'передбачаю', 'гіпотетично', 'уявіть', 'в теорії'];
    const containsSuspicious = reply && suspiciousPhrases.some((phrase) => reply.toLowerCase().includes(phrase));

    reply = sanitizeInternalRefs(reply);

    if (!reply || containsSuspicious) {
      const botResponse = TEMPLATES.ESCALATE_ANI;
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: text, botResponse, note: 'LLM uncertain -> escalate' });
      await bot.sendMessage(id, botResponse, mainMenuKeyboard);
      return res.status(200).send('LLM_FallbackEscalated');
    }

    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: userMessage, botResponse: reply });
    await bot.sendMessage(id, reply, mainMenuKeyboard);
    return res.status(200).send('ok');

  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.', mainMenuKeyboard);
    return res.status(500).send('OpenAI error');
  }
}
