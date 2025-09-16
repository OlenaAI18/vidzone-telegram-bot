// /api/webhook.mjs — повністю переписаний хендлер (ESM)

import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';
import { logToGoogleSheet } from '../googleSheetsLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =========================
 * 1) Статичні джерела (IST)
 * ========================= */
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');

const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

/* =========================
 * 2) Жарти — зовнішній файл
 * ========================= */
function loadJokes() {
  // Пробуємо JSON: { "items": ["...", "..."] }
  try {
    const p = path.join(__dirname, '../data/jokes.json');
    if (fs.existsSync(p)) {
      const { items } = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(items) && items.length) return items.map(s => String(s).trim()).filter(Boolean);
    }
  } catch {}
  // Пробуємо TXT/MD — один жарт на рядок
  try {
    const p = path.join(__dirname, '../data/jokes.txt');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length) return lines;
    }
  } catch {}

  // Фолбек — твій попередній список (урізаний прикладом не обмежується; встав свої ~50 жартів)
  return [
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
}
const jokes = loadJokes();

const JOKE_COOLDOWN_MS = 30_000;                 // 30с кулдаун на користувача
const lastJokeByUser = new Map();                // userId → ts
const servedJokesByChat = new Map();             // chatId → Set<index>
function getFreshJoke(chatId) {
  if (!Array.isArray(jokes) || jokes.length === 0) return null;
  let used = servedJokesByChat.get(chatId);
  if (!used) { used = new Set(); servedJokesByChat.set(chatId, used); }
  if (used.size >= jokes.length) used.clear();
  for (let guard = 0; guard < 24; guard++) {
    const i = Math.floor(Math.random() * jokes.length);
    if (!used.has(i)) { used.add(i); return jokes[i]; }
  }
  const i = [...Array(jokes.length).keys()].find(k => !used.has(k)) ?? 0;
  used.add(i);
  return jokes[i];
}

/* =========================
 * 3) Тексти/шаблони
 * ========================= */
const CONTACT_ANI = 'Анна Ільєнко — a.ilyenko@vidzone.com';
const TEMPLATES = {
  OFFTOPIC_POLITE:
    'Вибачте, але я можу надавати інформацію лише про рекламні послуги та продукти компанії Vidzone. Якщо у вас є питання щодо реклами — із радістю допоможу.',
  ESCALATE_ANI: `Це краще уточнити з комерційним директором. Контакт: ${CONTACT_ANI}.`,
  TECH_REQS_HEADER: '🛠 Технічні вимоги до рекламних роликів на Vidzone',
};

/* =========================
 * 4) Клавіатури
 * ========================= */
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
const userDocumentRequests = new Map();

/* =========================
 * 5) Нормалізація та хелпери
 * ========================= */
function normInput(s = '') {
  return (s || '')
    .normalize('NFKC')
    .replace(/[’'`´]/g, '’')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
function normalizeQuery(s = '') {
  let t = normInput((s || '').toLowerCase());
  t = t
    .replace(/(^|[^\p{L}])відзон\p{L}*/gu, '$1vidzone')
    .replace(/(^|[^\p{L}])видзон\p{L}*/gu, '$1vidzone')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t;
}
function sanitizeInternalRefs(text) {
  if (!text) return text;
  let out = text;
  out = out.replace(/#\s*[^#"“”\n]+\.(txt|md|docx|doc|xlsx|xls|pptx|pdf)/gi, 'внутрішні матеріали команди Vidzone');
  out = out.replace(/(?:документ(у|а|ом)?|файл(у|а|ом)?|document)\s+["“][^"”]+["”]/gi, 'внутрішні матеріали команди Vidzone');
  out = out.replace(/зверну[тт]ися\s+до\s+документ[ауі][^.,;]*[, ]*/gi, 'звернутися до внутрішніх матеріалів команди Vidzone, ');
  return out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ', ').trim();
}
function overlapScore(userText, kb) {
  if (!kb) return 0;
  const stop = new Set(['та','і','й','або','на','в','у','до','про','за','що','як','чи','це','ми','ви','є','з','по','для','від','без']);
  const tokens = (userText || '').toLowerCase().match(/\p{L}{3,}/gu) || [];
  const keys = tokens.filter(t => !stop.has(t) && t.length >= 4);
  if (!keys.length) return 0;
  const text = kb.toLowerCase();
  let hits = 0;
  for (const k of keys) if (text.includes(k)) hits++;
  return hits / keys.length;
}

/* =========================
 * 6) Intent detection
 * ========================= */
const RX = {
  START: /^\/start\b|^привіт\b|^добрий\s+день\b|^вітаю\b/i,
  CEO: /(^|[^\p{L}])((?:є|е)вген(?:ий)?|yevhen|evhen|evgen|yevgen)\s+левченко(?!\p{L})/iu,
  CEO_ALT: /(^|[^\p{L}])(ceo|сео|керівник|директор)\s+(vidzone|відзон\p{L}*|видзон\p{L}*)(?!\p{L})/iu,

  TECH_REQS: /(тех(\s*|-)вимог\w*|технічн\w*\s+вимог\w*|техтреб\w*|тех\.?\s*вимог\w*|тех\.?\s*треб\w*|technical\s+requirements|tech\s*reqs?|ssai\s+вимог\w*)/iu,
  DOC_MENU: /(шаблон(и)?\s+документ\w*|документ(и)?|довідк\w*|гарантійн\w*\s+лист|музичн\w*\s+довідк\w*)/iu,
  JOKE: /(жарт|смішн|анекдот|веселе)/iu,

  AVB: /(^|[^\p{L}])(avb|audio\s*video\s*bridging|a\/?b|а\/?б|авб)(?!\p{L})/iu,
  BRAND_SPECIFIC: /(клієнт\p{L}*|бренд\p{L}*|для)\s+[A-Za-zА-Яа-яІЇЄҐієї0-9][\w&\-.]{1,}/u,

  JAILBREAK: /(ігнор|ignore|обійди|обійти)\s+\p{L}*інструкц/i,
  COFFEE: /\bкава|coffee\b/i,
  COSMOS: /(всесвіт|universe|космос)/i,
};
function detectIntent(userTextNorm) {
  if (RX.START.test(userTextNorm)) return 'START';
  if (RX.CEO.test(userTextNorm) || RX.CEO_ALT.test(userTextNorm) || /levchenko/i.test(userTextNorm)) return 'CEO';
  if (RX.TECH_REQS.test(userTextNorm)) return 'TECH_REQS';
  if (RX.DOC_MENU.test(userTextNorm)) return 'DOC_MENU';
  if (RX.JOKE.test(userTextNorm)) return 'JOKE';
  if (RX.AVB.test(userTextNorm) || RX.BRAND_SPECIFIC.test(userTextNorm)) return 'ESCALATE';
  if (RX.JAILBREAK.test(userTextNorm)) return 'OOS';
  if (RX.COFFEE.test(userTextNorm) && !RX.TECH_REQS.test(userTextNorm)) return 'OOS';
  if (RX.COSMOS.test(userTextNorm)) return 'OOS';
  return 'RAG';
}

/* =========================
 * 7) LLM конфіг
 * ========================= */
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TEMPERATURE = 0.1;

/* =========================
 * 8) Основний хендлер
 * ========================= */
export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text && !body?.callback_query) return res.status(200).send('Non-message update skipped');

  /* ---- CALLBACKS ---- */
  if (body.callback_query) {
    const cq = body.callback_query;
    const chatId = cq.message.chat.id;
    const userId = cq.from.id;
    const data = String(cq.data || '');

    // Дебаунс на повторні кліки
    if (!handler._cbDebounce) handler._cbDebounce = new Map();
    const key = `${userId}:${data}`;
    const prev = handler._cbDebounce.get(key) || 0;
    const now = Date.now();
    if (now - prev < 1500) {
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('debounced');
    }
    handler._cbDebounce.set(key, now);

    if (data === 'menu_about') {
      await bot.sendMessage(
        chatId,
        'Vidzone — технологічна DSP-платформа для автоматизованої реклами на цифровому телебаченні (Smart TV, OTT). Дає змогу запускати програматик-рекламу з гнучким таргетингом і контролем бюджету.',
        mainMenuKeyboard
      );
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_jokes') {
      const last = lastJokeByUser.get(userId) || 0;
      if (Date.now() - last < JOKE_COOLDOWN_MS) {
        await bot.sendMessage(chatId, 'Трохи зачекайте перед наступним жартом 😉', mainMenuKeyboard);
        await bot.answerCallbackQuery(cq.id);
        return res.status(200).send('ok');
      }
      const joke = getFreshJoke(chatId) || '😉 (жарти тимчасово недоступні)';
      lastJokeByUser.set(userId, Date.now());
      await bot.sendMessage(chatId, joke, mainMenuKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'menu_help') {
      await bot.sendMessage(chatId, 'Пишіть будь-яке питання — допоможу знайти інформацію по Vidzone. Якщо не знаю, підкажу, до кого звернутися.', mainMenuKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data.startsWith('doc_')) {
      userDocumentRequests.set(userId, data.replace('doc_', ''));
      await bot.sendMessage(chatId, 'Оберіть формат документа:', documentFormatKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'format_text' || data === 'format_word') {
      const docKey = userDocumentRequests.get(userId);
      if (!docKey) {
        await bot.sendMessage(chatId, 'Вибачте, не можу визначити, який документ ви обрали. Будь ласка, спробуйте знову.', documentMenuKeyboard);
        await bot.answerCallbackQuery(cq.id);
        return res.status(200).send('ok');
      }

      if (data === 'format_text') {
        const map = { guaranteeLetter, techRequirements, musicCertificate };
        const payload = map[docKey];
        if (payload) {
          const title = docKey === 'techRequirements' ? TEMPLATES.TECH_REQS_HEADER + '\n\n' : '';
          await bot.sendMessage(chatId, title + payload, documentMenuKeyboard);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: `Вибрав ${docKey} (текст)`, botResponse: `[${docKey}] text sent` });
        } else {
          await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        }
      } else {
        const map = {
          guaranteeLetter: guaranteeLetterDocx,
          techRequirements: techRequirementsDocx,
          musicCertificate: musicCertificateDocx,
        };
        const filePath = map[docKey] || null;
        if (filePath) {
          await bot.sendDocument(chatId, filePath);
          await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: `Вибрав ${docKey} (Word-файл)`, botResponse: `Відправлено файл ${filePath}` });
        } else {
          await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        }
      }

      userDocumentRequests.delete(userId);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'back_to_menu') {
      await bot.sendMessage(chatId, 'Головне меню:', mainMenuKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    if (data === 'back_to_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('ok');
    }

    await bot.answerCallbackQuery(cq.id);
    return res.status(200).send('ok');
  }

  /* ---- TEXT ---- */
  const {
    chat: { id: chatId },
    text,
    from: { id: userId },
  } = body.message;

  const rawText = text || '';
  const userText = normalizeQuery(rawText);
  const intent = detectIntent(userText);

  console.log(`intent=${intent}; text="${rawText}"`);

  // A) Старт
  if (intent === 'START') {
    await bot.sendMessage(
      chatId,
      `Привіт! Я — віртуальний помічник Vidzone. Ось що я можу:\n\n` +
        `• Розповісти про компанію, послуги, планування РК на digital TV\n` +
        `• Надати шаблони документів (технічні вимоги, музична довідка, гарантійний лист)\n` +
        `• Розповісти щось веселе про Vidzone\n` +
        `• Допомогти з пакетами, таргетингом, CPM/CPT, OTT/CTV`,
      mainMenuKeyboard
    );
    return res.status(200).send('Welcome Sent');
  }

  // B) CEO
  if (intent === 'CEO') {
    await bot.sendMessage(chatId, 'CEO Vidzone — Євген Левченко.', mainMenuKeyboard);
    return res.status(200).send('CEO Answer');
  }

  // C) Техвимоги — з pinned джерела (без LLM)
  if (intent === 'TECH_REQS') {
    const answer = `${TEMPLATES.TECH_REQS_HEADER}\n\n${techRequirements}`;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: '[TECH_REQS] text' });
    await bot.sendMessage(chatId, answer, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📝 Завантажити Word', callback_data: 'doc_techRequirements' }],
          [{ text: '↩️ Меню документів', callback_data: 'menu_documents' }],
        ],
      },
    });
    return res.status(200).send('TECH_REQS');
  }

  // D) Меню документів
  if (intent === 'DOC_MENU') {
    await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
    return res.status(200).send('DOC_MENU');
  }

  // E) Жарти
  if (intent === 'JOKE') {
    const last = lastJokeByUser.get(userId) || 0;
    if (Date.now() - last < JOKE_COOLDOWN_MS) {
      await bot.sendMessage(chatId, 'Трохи зачекайте перед наступним жартом 😉', mainMenuKeyboard);
      return res.status(200).send('JOKE_COOLDOWN');
    }
    const joke = getFreshJoke(chatId) || '😉 (жарти тимчасово недоступні)';
    lastJokeByUser.set(userId, Date.now());
    await bot.sendMessage(chatId, joke, mainMenuKeyboard);
    return res.status(200).send('Joke Sent');
  }

  // F) Жорстка ескалація
  if (intent === 'ESCALATE') {
    const botResponse = TEMPLATES.ESCALATE_ANI;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'Hard escalate (AVB/brand)' });
    await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
    return res.status(200).send('HardEscalate');
  }

  // G) Офтоп/анти-джейлбрейк
  if (intent === 'OOS') {
    const botResponse = TEMPLATES.OFFTOPIC_POLITE;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'Off-scope/jailbreak' });
    await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
    return res.status(200).send('OOS');
  }

  // H) RAG-FIRST (строгий “grounded only”)
  let relevantChunks = [];
  try {
    const expandedQuery = userText;
    relevantChunks = await retrieveRelevantChunks(expandedQuery, process.env.OPENAI_API_KEY);
  } catch (e) {
    console.error('RAG error (primary):', e);
  }

  if (!Array.isArray(relevantChunks) || relevantChunks.length === 0) {
    try {
      const tokens = (normalizeQuery(userText).match(/\p{L}{3,}/gu) || []).filter(Boolean);
      const dedup = [...new Set(tokens)];
      const secondQuery = dedup.slice(0, 24).join(' ');
      if (secondQuery) {
        const sc = await retrieveRelevantChunks(secondQuery, process.env.OPENAI_API_KEY);
        if (Array.isArray(sc) && sc.length) relevantChunks = sc;
      }
    } catch (e) {
      console.error('RAG error (second chance):', e);
    }
  }

  const knowledgeBlock = Array.isArray(relevantChunks) && relevantChunks.length
    ? relevantChunks.join('\n\n---\n\n')
    : '';

  if (!knowledgeBlock || overlapScore(userText, knowledgeBlock) < 0.25) {
    const botResponse = TEMPLATES.OFFTOPIC_POLITE;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'Offtopic: KB weak/empty' });
    await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
    return res.status(200).send('Offtopic_NoKB');
  }

  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone.

ПРАВИЛА:
• Відповідай українською стисло, професійно і дружньо.
• Використовуй ТІЛЬКИ надані нижче фрагменти бази знань («KB»). НЕ вигадуй.
• Якщо інформації недостатньо — чемно скажи про це і порадь звернутись до ${CONTACT_ANI}.
• Заборонено згадувати назви/шляхи внутрішніх документів — кажи «внутрішні матеріали команди Vidzone».
• Твої теми: медіа, реклама, OTT/CTV, Vidzone та суміжні питання.
• Поза цими темами — м’який офтоп з поверненням у тематику.

ФОРМАТ:
• Якщо питання про «технічні вимоги» — дай чіткі вимоги, пунктами (якщо є в KB).
• Якщо про планування/пакети/CPM — дай практичні пункти, приклади, застереження.

KB (релевантні фрагменти):
${knowledgeBlock}
`.trim();

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText },
        ],
      }),
    });

    const data = await openaiRes.json();
    let reply = data?.choices?.[0]?.message?.content?.trim() || '';

    reply = sanitizeInternalRefs(reply);

    const suspicious = ['не впевнений', 'не знаю', 'немає інформації', 'не можу відповісти', 'передбачаю', 'гіпотетично', 'уявіть', 'в теорії'];
    const containsSuspicious = reply && suspicious.some((p) => reply.toLowerCase().includes(p));

    if (!reply || containsSuspicious) {
      const botResponse = TEMPLATES.OFFTOPIC_POLITE;
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'LLM uncertain -> polite' });
      await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
      return res.status(200).send('LLM_Polite');
    }

    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
    await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    return res.status(200).send('ok');

  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(chatId, '⚠️ Помилка. Спробуйте ще раз пізніше.', mainMenuKeyboard);
    return res.status(500).send('OpenAI error');
  }
}
