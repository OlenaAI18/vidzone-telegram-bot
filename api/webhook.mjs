// api/webhook.mjs — фінальна версія

import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';
import { logToGoogleSheet } from '../googleSheetsLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =========================
 * 1) Статичні файли
 * ========================= */
const guaranteeLetter    = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements   = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate   = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const channelsCatalog    = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/ad_channels.json'), 'utf-8'));

const guaranteeLetterDocx  = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

// offtopic_channels.json — якщо є, використовуємо
let offtopicChannelsMap = {};
try {
  const p = path.join(__dirname, '../data/offtopic_channels.json');
  if (fs.existsSync(p)) {
    offtopicChannelsMap = JSON.parse(fs.readFileSync(p, 'utf-8')).topics || {};
  }
} catch {}

/* =========================
 * 2) Жарти
 * ========================= */
function loadJokes() {
  try {
    const p = path.join(__dirname, '../data/jokes.json');
    if (fs.existsSync(p)) {
      const { items } = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(items) && items.length) return items.map(s => String(s).trim()).filter(Boolean);
    }
  } catch {}
  return [
    'Vidzone — єдине місце, де «Skip Ad» не кнопка, а життєва позиція.',
    'У нас 99% VTR. Той 1% — це кіт, що випадково наступив на пульт.',
    'Наш таргетинг знає, який у вас серіал, ще до того, як ви його ввімкнете.',
    'Vidzone — коли реклама потрапляє в ціль без жодного промаху.',
    'Vidzone: де рекламу чекають, а не терплять.',
  ];
}
const jokes = loadJokes();
const JOKE_COOLDOWN_MS = 30_000;
const lastJokeByUser = new Map();
const servedJokesByChat = new Map();
function getFreshJoke(chatId) {
  if (!Array.isArray(jokes) || jokes.length === 0) return null;
  let used = servedJokesByChat.get(chatId);
  if (!used) { used = new Set(); servedJokesByChat.set(chatId, used); }
  if (used.size >= jokes.length) used.clear();
  for (let guard = 0; guard < 24; guard++) {
    const i = Math.floor(Math.random() * jokes.length);
    if (!used.has(i)) { used.add(i); return jokes[i]; }
  }
  return jokes[0];
}

/* =========================
 * 3) Константи
 * ========================= */
const CONTACT_ANI    = 'Анна Ільєнко — a.ilyenko@vidzone.com';
const CHANNELS       = Array.isArray(channelsCatalog?.items) ? channelsCatalog.items : [];
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS
  ? process.env.ALLOWED_USER_IDS.split(',').map(s => s.trim()).filter(Boolean)
  : [];
const OPENAI_MODEL     = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const TEMPERATURE      = 0.2;
const MAX_TOKENS       = 600;
const DEFAULT_CHANNELS = ['[M] Орел і решка', 'TET', '[M] Комедія'];

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
 * 5) Fallback-шаблони (офтоп)
 * ========================= */
const FALLBACK_INTRO = [
  'Це не моя спеціалізація — я про Digital TV рекламу.',
  'З цього питання я вам не помічник, але дещо підкажу.',
  'Моя експертиза — Digital TV реклама, а не {topic}.',
  'Із цим не допоможу, проте маю до вас одну пропозицію.',
  'Не моя тема — але знаю, куди звернути увагу.',
];
const FALLBACK_BRIDGE = [
  'Натомість є канал «{channel}» — там саме такий контент.',
  'Зверніть увагу на «{channel}» — тематика якраз відповідає.',
  'Для цієї теми підійде канал «{channel}» — там схожий контент.',
  'Канал «{channel}» якраз спеціалізується на подібному контенті.',
  'На «{channel}» знайдете саме те, що шукаєте.',
];
const FALLBACK_TAIL = [
  'До речі, «{channel}» входить до мережі Vidzone. Питання щодо розміщення реклами — {contact}.',
  'Цей канал розміщується через Vidzone. Деталі щодо реклами — {contact}.',
  'На «{channel}» виходить реклама Vidzone — умови розміщення уточніть у {contact}.',
];

const TOPIC_HINTS = [
  { rx: /(трамп|зеленськ|путін|політик|вибор|президент)/i, topic: 'політику' },
  { rx: /(погод|дощ|сніг|спека|клімат)/i,                  topic: 'погоду' },
  { rx: /(рецепт|борщ|вареник|готував|їжа)/i,               topic: 'кулінарію' },
  { rx: /(астролог|гороскоп|зодіак)/i,                      topic: 'астрологію' },
  { rx: /(фільм|кіно|серіал)/i,                             topic: 'кіно' },
  { rx: /(музик|пісн|виконавець)/i,                         topic: 'музику' },
  { rx: /(спорт|футбол|матч)/i,                             topic: 'спорт' },
  { rx: /(кіт|собак|тварин)/i,                              topic: 'тварин' },
];

function detectTopic(text) {
  for (const { rx, topic } of TOPIC_HINTS) if (rx.test(text)) return topic;
  return null;
}
function pickVariant(arr, seed = '') {
  if (!arr?.length) return arr?.[0] || '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}


/* =========================
 * 5b) Текстові утиліти
 * ========================= */
function normInput(s = '') {
  return (s || '')
    .normalize('NFKC')
    .replace(/['‘’`´]/g, '’')
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
  return text
    .replace(/kb_[\w]+\.md/gi, 'матеріали команди Vidzone')
    .replace(/vidzone_[\w]+\.md/gi, 'матеріали команди Vidzone')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* =========================
 * 6) GPT Router
 * ========================= */
async function routeMessage(text, apiKey) {
  const prompt = `Ти роутер Telegram-бота Vidzone (Digital TV реклама в Україні).
Визнач яка дія потрібна для повідомлення.

Повідомлення: "${text.slice(0, 400)}"

Дії:
- "chat"     — привітання, подяка, загальна балачка, питання не про рекламу
- "rag"      — питання про Vidzone, Digital TV рекламу, OTT, CPM, ціни, знижки, пакети, таргетинг, аудиторію, технічні вимоги, кейси, ефективність
- "offtopic" — питання про зовнішній світ (новини, погода, рецепти, спорт, кіно, музика, тварини, авто, політика, розваги)
- "docs"     — просить шаблони документів, гарантійний лист, музична довідка, технічні вимоги

Поверни ТІЛЬКИ JSON без пояснень: {"action":"назва_дії"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OPENAI_MODEL, max_completion_tokens: 100, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json();
    if (data.error) console.error('[Router] API error:', data.error.message);
    const raw = (data.choices?.[0]?.message?.content || '').trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    const action = parsed?.action;
    if (['chat', 'rag', 'offtopic', 'docs'].includes(action)) return action;
    return 'rag';
  } catch (e) {
    console.error('[Router] error:', e.message);
    return 'rag';
  }
}

/* =========================
 * 7) Вибір каналу для офтопу
 * ========================= */
async function pickOfftopicChannel(text, apiKey) {
  // Спробуємо знайти тему через GPT і лукапнути в offtopic_channels.json
  if (Object.keys(offtopicChannelsMap).length > 0) {
    try {
      const topics = Object.keys(offtopicChannelsMap).join(', ');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OPENAI_MODEL, max_completion_tokens: 40, temperature: 0,
          messages: [{ role: 'user', content: `Тема повідомлення: "${text.slice(0, 200)}"\nОбери ОДНУ найближчу тему зі списку: ${topics}\nПоверни ТІЛЬКИ JSON: {"topic":"назва"}` }],
        }),
      });
      const data = await res.json();
      const raw = (data.choices?.[0]?.message?.content || '').trim().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      const channels = offtopicChannelsMap[parsed?.topic];
      if (Array.isArray(channels) && channels.length) {
        const name = channels[Math.floor(Math.random() * channels.length)];
        const found = CHANNELS.find(c => c.name === name);
        if (found) return found.name;
      }
    } catch {}
  }
  // Фолбек — дефолтні канали
  return DEFAULT_CHANNELS[Math.floor(Math.random() * DEFAULT_CHANNELS.length)];
}

/* =========================
 * 8) buildChannelsSummary
 * ========================= */
function buildChannelsSummary(userText = '') {
  const text = (userText || '').toLowerCase();
  const THEMES = ['Дитячий', 'Жіночий', 'Чоловічий', 'Унісекс'];
  let filterTheme = null;
  if (/дит(яч)?/.test(text)) filterTheme = 'Дитячий';
  else if (/жіноч/.test(text)) filterTheme = 'Жіночий';
  else if (/чоловіч/.test(text)) filterTheme = 'Чоловічий';
  else if (/унісекс/.test(text)) filterTheme = 'Унісекс';

  const grouped = {};
  for (const theme of THEMES) {
    if (filterTheme && theme !== filterTheme) continue;
    const chs = CHANNELS.filter(c => c.theme === theme)
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .slice(0, 8).map(c => c.name);
    if (chs.length) grouped[theme] = chs;
  }
  const lines = ['Vidzone має понад 300 каналів у 4 тематичних пакетах. Ось приклади:'];
  for (const [theme, names] of Object.entries(grouped)) {
    lines.push(theme + ' пакет: ' + names.join(', '));
  }
  lines.push('Повний каталог і умови розміщення — ' + CONTACT_ANI + '.');
  return lines.join('\n');
}

/* =========================
 * 9) Головний хендлер
 * ========================= */
export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text && !body?.callback_query) return res.status(200).send('skip');

  // ── Callback-кнопки ──
  if (body.callback_query) {
    const cq     = body.callback_query;
    const chatId = cq.message.chat.id;
    const userId = cq.from.id;
    const data   = String(cq.data || '');

    if (!handler._cbDebounce) handler._cbDebounce = new Map();
    const key = `${userId}:${data}`;
    const now = Date.now();
    if (now - (handler._cbDebounce.get(key) || 0) < 1500) {
      await bot.answerCallbackQuery(cq.id);
      return res.status(200).send('debounced');
    }
    handler._cbDebounce.set(key, now);

    if (data === 'menu_about') {
      await bot.sendMessage(chatId, 'Vidzone — технологічна DSP-платформа для автоматизованої реклами на цифровому телебаченні (Smart TV, OTT). Дає змогу запускати програматик-рекламу з гнучким таргетингом і контролем бюджету.', mainMenuKeyboard);
    } else if (data === 'menu_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
    } else if (data === 'menu_jokes') {
      const last = lastJokeByUser.get(userId) || 0;
      if (Date.now() - last < JOKE_COOLDOWN_MS) {
        await bot.sendMessage(chatId, 'Трохи зачекайте перед наступним жартом 😉', mainMenuKeyboard);
      } else {
        const joke = getFreshJoke(chatId) || '😉';
        lastJokeByUser.set(userId, Date.now());
        await bot.sendMessage(chatId, joke, mainMenuKeyboard);
      }
    } else if (data === 'menu_help') {
      await bot.sendMessage(chatId, 'Пишіть будь-яке питання — допоможу знайти інформацію по Vidzone.', mainMenuKeyboard);
    } else if (data.startsWith('doc_')) {
      userDocumentRequests.set(userId, data.replace('doc_', ''));
      await bot.sendMessage(chatId, 'Оберіть формат документа:', documentFormatKeyboard);
    } else if (data === 'format_text' || data === 'format_word') {
      const docKey = userDocumentRequests.get(userId);
      if (!docKey) {
        await bot.sendMessage(chatId, 'Будь ласка, оберіть документ ще раз.', documentMenuKeyboard);
      } else if (data === 'format_text') {
        const map = { guaranteeLetter, techRequirements, musicCertificate };
        const payload = map[docKey];
        if (payload) await bot.sendMessage(chatId, payload, documentMenuKeyboard);
        else await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: `doc:${docKey}:text`, botResponse: 'sent' });
      } else {
        const map = { guaranteeLetter: guaranteeLetterDocx, techRequirements: techRequirementsDocx, musicCertificate: musicCertificateDocx };
        const filePath = map[docKey];
        if (filePath) await bot.sendDocument(chatId, filePath);
        else await bot.sendMessage(chatId, 'Файл наразі недоступний.', documentMenuKeyboard);
        await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: `doc:${docKey}:word`, botResponse: 'file sent' });
      }
      userDocumentRequests.delete(userId);
    } else if (data === 'back_to_menu') {
      await bot.sendMessage(chatId, 'Головне меню:', mainMenuKeyboard);
    } else if (data === 'back_to_documents') {
      await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
    }

    await bot.answerCallbackQuery(cq.id);
    return res.status(200).send('ok');
  }

  // ── Текстові повідомлення ──
  const chatId  = body.message.chat.id;
  const userId  = String(body.message.from?.id || '');
  const rawText = body.message.text.trim();
  const apiKey  = process.env.OPENAI_API_KEY;

  console.log('[MSG]', JSON.stringify({ userId, text: rawText.slice(0, 80) }));
  console.log('[MODEL]', OPENAI_MODEL);

  // Перевірка доступу
  if (ALLOWED_USER_IDS.length && !ALLOWED_USER_IDS.includes(userId)) {
    await bot.sendMessage(chatId, 'Вибачте, у вас немає доступу до цього бота.');
    return res.status(200).send('unauthorized');
  }

  // /start
  if (/^\/start/.test(rawText)) {
    await bot.sendMessage(chatId, 'Привіт! Я AI-помічник Vidzone. Можу розповісти про Digital TV рекламу, ціни, аудиторію та можливості платформи. Запитуйте — відповім.', mainMenuKeyboard);
    await bot.setMyCommands([{ command: 'start', description: 'Почати' }]);
    return res.status(200).send('start');
  }

  // Jailbreak guard
  if (/(ігноруй|ignore)\s+.{0,20}(інструкц|правил)/i.test(rawText)) {
    await bot.sendMessage(chatId, 'Я спеціаліст з реклами — з цим не допоможу.', mainMenuKeyboard);
    return res.status(200).send('jailbreak');
  }

  // ── GPT Router ──
  const action = await routeMessage(rawText, apiKey);
  console.log('[ROUTE]', action, '|', rawText.slice(0, 50));

  // ── DOCS ──
  if (action === 'docs') {
    await bot.sendMessage(chatId, 'Оберіть шаблон документа:', documentMenuKeyboard);
    return res.status(200).send('docs');
  }

  // ── OFFTOPIC ──
  if (action === 'offtopic') {
    const channelName = await pickOfftopicChannel(rawText, apiKey);
    const topic       = detectTopic(rawText);
    let intro  = pickVariant(FALLBACK_INTRO, rawText + ':i');
    intro = topic ? intro.replace('{topic}', topic) : intro.replace(' — не моя справа реклама, а {topic}', '').replace('{topic}', 'цю тему');
    const bridge = pickVariant(FALLBACK_BRIDGE, rawText + ':b').replace(/{channel}/g, channelName);
    const tail   = pickVariant(FALLBACK_TAIL,   rawText + ':t').replace(/{channel}/g, channelName).replace('{contact}', CONTACT_ANI);
    const reply  = intro + ' ' + bridge + ' ' + tail;
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
    await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    return res.status(200).send('offtopic');
  }

  // ── CHAT (смол-ток) ──
  if (action === 'chat') {
    const chatPrompt = `Ти — дружній асистент Vidzone, компанії з Digital TV реклами в Україні.
Спілкуйся природно і тепло, відповідай коротко (1–3 речення).
Якщо це привітання — привітайся у відповідь і запропонуй допомогу з питань реклами.
Якщо дякують — відповідай скромно.
Не вигадуй інформацію про Vidzone якщо не впевнений.
НЕ використовуй markdown: зірочки **, решітки ##. Пиши звичайним текстом.`;
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OPENAI_MODEL, max_completion_tokens: 200, temperature: 0.7,
          messages: [{ role: 'system', content: chatPrompt }, { role: 'user', content: rawText }] }),
      });
      const d = await r.json();
      if (d.error) console.error('[Chat] API error:', d.error.message);
      const reply = d.choices?.[0]?.message?.content?.trim() || 'Привіт! Чим можу допомогти?';
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
      await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    } catch (e) {
      console.error('[Chat] error:', e.message);
      await bot.sendMessage(chatId, 'Привіт! Чим можу допомогти?', mainMenuKeyboard);
    }
    return res.status(200).send('chat');
  }

  // ── RAG (default) ──
  try {
    const userText     = normalizeQuery(rawText);
    const chunks       = await retrieveRelevantChunks(userText, apiKey, { topK: 6, minSim: 0.20 });
    const knowledgeBlock = chunks.join('\n\n---\n\n');

    const ragPrompt = `Ти — офіційний AI-помічник Vidzone, компанії з Digital TV реклами в Україні.

ПРАВИЛА:
- Відповідай ЗАВЖДИ українською, стисло (3–6 речень), професійно та дружньо.
- Використовуй ТІЛЬКИ інформацію з KB нижче. НЕ вигадуй цифри та факти.
- Якщо в KB немає точної відповіді — скажи чесно: "Точних даних з цього питання у мене немає. Зверніться до ${CONTACT_ANI}."
- НЕ використовуй markdown: зірочки **, решітки ##, підкреслення __. Пиши звичайним текстом.
- Заборонено згадувати назви внутрішніх файлів.

ФОРМАТ:
- Ціна/CPM → конкретна цифра + що входить + контакт для деталей
- Канали/пакети → назви пакетів + конкретні приклади каналів
- Технічні вимоги → чіткий список
- Кейси → бренд + результат у цифрах

ПРИКЛАДИ:
П: "Скільки коштує реклама?"
В: "Базова ціна — 150 грн за 1000 показів (ролик 15 сек). Є знижки: пакетні до -15%, бюджетні до -20%. Детальний розрахунок — ${CONTACT_ANI}."

П: "Чому для фарми це ефективно?"
В: "На Vidzone SOV фарми лише 14% проти 46% на ТБ — менший клаттер, більше уваги до кожного ролика. У 1 кв. 2026 категорія зросла на 68%. Кейс Solgar: +52% продажів лише на Digital TV."

П: "Яка аудиторія?"
В: "Vidzone охоплює 2,5 млн домогосподарств та 6 млн людей на місяць. 93% глядачів дивляться через Smart TV. Середній вік 35–54 роки."

П: "Які канали є?"
В: "Понад 300 каналів у 4 пакетах: Унісекс (1+1 Україна, 24 Канал, TET...), Жіночий (Бігуді, НТН...), Чоловічий (2+2, БОЙОВИК HD...), Дитячий (ПЛЮСПЛЮС, PIXEL...). Детальний підбір — ${CONTACT_ANI}."

KB:
${knowledgeBlock || 'Інформація не знайдена.'}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: TEMPERATURE,
        max_completion_tokens: MAX_TOKENS,
        messages: [{ role: 'system', content: ragPrompt }, { role: 'user', content: rawText }],
      }),
    });
    const d = await r.json();
    if (d.error) console.error('[RAG] API error:', d.error.message);

    let reply = d.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.error('[RAG] empty reply. Chunks found:', chunks.length);
      reply = chunks.length > 0
        ? 'На це питання у мене немає точної відповіді. Зверніться до ' + CONTACT_ANI + '.'
        : 'Інформації з цього питання у базі немає. Зверніться до ' + CONTACT_ANI + '.';
    }

    reply = sanitizeInternalRefs(reply);
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
    await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    return res.status(200).send('rag_ok');

  } catch (err) {
    console.error('[RAG] error:', err.message);
    await bot.sendMessage(chatId, 'Виникла технічна помилка. Спробуйте ще раз або напишіть ' + CONTACT_ANI + '.', mainMenuKeyboard);
    return res.status(200).send('rag_error');
  }
}
