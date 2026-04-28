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
const channelsCatalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/ad_channels.json'), 'utf-8')
);

const guaranteeLetterDocx = path.join(__dirname, '../data/guarantee_letter.docx');
const offtopicChannels = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/offtopic_channels.json'), 'utf-8')
);
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

/* =========================
 * 2) Жарти — зовнішній файл
 * ========================= */
function loadJokes() {
  try {
    const p = path.join(__dirname, '../data/jokes.json');
    if (fs.existsSync(p)) {
      const { items } = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(items) && items.length) return items.map(s => String(s).trim()).filter(Boolean);
    }
  } catch {}
  try {
    const p = path.join(__dirname, '../data/jokes.txt');
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8');
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length) return lines;
    }
  } catch {}

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
    "У Vidzone навіть реклама знає твоє ім\u2019я… і улюблений серіал.",
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
  const i = [...Array(jokes.length).keys()].find(k => !used.has(k)) ?? 0;
  used.add(i);
  return jokes[i];
}

/* =========================
 * 3) Тексти/шаблони
 * ========================= */
const CONTACT_ANI = 'Анна Ільєнко — a.ilyenko@vidzone.com';
const CHANNELS = Array.isArray(channelsCatalog?.items) ? channelsCatalog.items : [];
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS ? process.env.ALLOWED_USER_IDS.split(',').map(s => s.trim()) : [];
const MAX_TOKENS = 600;
const TEMPERATURE = 0.2;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const OFFTOPIC_DEFAULT_CHANNELS = ['[M] Орел і решка', 'TET', '[M] Комедія'];
const OFFTOPIC_KIDS_CHANNELS = ['ПЛЮСПЛЮС', 'PIXEL', 'Cine+ Kids', '[M] МУЛЬТПРЕМЬЕРА HD'];
const THEMATIC_FALLBACK_POOLS = [
  {
    keywords: ['дит', 'діт', 'мульт', 'lego', 'казк', 'школ', 'іграшк', 'дошкіл'],
    channels: OFFTOPIC_KIDS_CHANNELS,
  },
  {
    keywords: ['вареник', 'рецепт', 'кулінар', 'їжа', 'страва', 'кухн', 'готув', 'салат', 'борщ'],
    channels: ['[M] Блог Кухня UA HD', '[M] Кулінарія', 'Vidzone Кулінарний мікс HD'],
  },
  {
    keywords: ['спорт', 'футбол', 'матч', 'чемпіонат', 'бокс', 'єдинобор', 'тренування'],
    channels: ['[М] ТОП HD', '[M] CEO Club', 'Setanta Sports'],
  },
  {
    keywords: ['бізнес', 'маркетинг', 'стартап', 'керівник', 'ceo', 'технолог', 'it'],
    channels: ['[M] IT. Бізнес. Креатив.', '[M] CEO Club'],
  },
  {
    keywords: ['погод', 'клімат', 'природ', 'тварин', 'зоо', 'рослин'],
    channels: ['Vidzone ONE PLANET+', 'Viasat Nature EU', '[M] Zoosvit'],
  },
  {
    keywords: ['музик', 'пісн', 'концерт', 'виконавець'],
    channels: ['MusicBox', 'М1', 'М2', '4ever Music'],
  },
  {
    keywords: ['подорож', 'мандр', 'відпуст', 'туризм', 'країн'],
    channels: ['[M] Блог Мандри 1 HD', '[M] Блог Подорожі', 'Vidzone Орел і Решка'],
  },
  {
    keywords: ['політик', 'новин', 'війн', 'збройн', 'трамп', 'зеленськ', 'вибор'],
    channels: ['24 Канал', 'EspresoTV', '5 канал'],
  },
  {
    keywords: ['авто', 'мото', 'машин', 'автомобіл'],
    channels: ['[M] Блог Авто/Мото UA HD', 'MGG Світ авто-мото техніки HD'],
  },
  {
    keywords: ['ремонт', 'будівництв', 'інтерьєр', 'дача', 'сад', 'город'],
    channels: ['[M] Блог Будівництво та ремонт HD', 'MGG Будівництво та ремонт HD', 'Дача'],
  },
  {
    keywords: ['здоров', 'медицин', 'лікар', 'хвороб', 'дієт', 'вітамін'],
    channels: ['Vidzone МЕДИЧНІ СЕРІАЛИ', '[М] Доктор Комаровський', '36.6'],
  },
];

/* =========================
 * Нативні fallback-шаблони
 * Логіка: пом'якшене "не моя тема" → канал → реклама Vidzone
 * ========================= */

// Вступні фрази — чому бот не відповідає на це
const FALLBACK_INTRO_TEMPLATES = [
  'Це не моя спеціалізація — я про Digital TV рекламу.',
  'З цього питання я вам не помічник, але дещо підкажу.',
  'Реклама і медіа — моя тема, а от {topic} — ні.',
  'Про {topic} я не консультую, але є корисна підказка.',
  'Моя експертиза — Digital TV реклама, а не {topic}.',
  'Із цим не допоможу, проте маю до вас одну пропозицію.',
  'Не моя тема — але знаю, куди звернути увагу.',
  'Тут я не фахівець, однак є що запропонувати.',
];

// Перехід до каналу
const FALLBACK_BRIDGE_TEMPLATES = [
  'Натомість є канал «{channel}» — там саме такий контент.',
  'Зверніть увагу на «{channel}» — тематика якраз відповідає.',
  'Для цієї теми підійде канал «{channel}» — там схожий контент.',
  'Є чудовий варіант — канал «{channel}», де це у фокусі.',
  'Канал «{channel}» якраз спеціалізується на подібному контенті.',
  'На «{channel}» знайдете саме те, що шукаєте.',
  'Рекомендую «{channel}» — там це питання точно в темі.',
];

// Хвіст про рекламу Vidzone
const FALLBACK_AD_TAIL_TEMPLATES = [
  'До речі, «{channel}» входить до мережі Vidzone. Питання щодо розміщення реклами — {contact}.',
  'Цей канал розміщується через Vidzone. Деталі щодо реклами — {contact}.',
  'На «{channel}» виходить реклама Vidzone — умови розміщення уточніть у {contact}.',
  '«{channel}» є частиною інвентарю Vidzone. Для рекламодавців — {contact}.',
];

// Контекстні підказки залежно від теми запиту (щоб intro звучав природніше)
const TOPIC_HINTS = [
  { rx: /(трамп|зеленськ|байден|путін|політик|вибор|президент)/i, topic: 'політику' },
  { rx: /(погод|дощ|сніг|спека|мороз|клімат)/i, topic: 'погоду' },
  { rx: /(рецепт|борщ|вареник|тістечк|готував|їжа|страва)/i, topic: 'кулінарію' },
  { rx: /(астролог|гороскоп|зодіак|козеріг|скорпіон)/i, topic: 'астрологію' },
  { rx: /(анекдот|жарт|смішн|гумор)/i, topic: 'жарти' },
  { rx: /(фільм|кіно|серіал)/i, topic: 'кіно' },
  { rx: /(музик|пісн|виконавець)/i, topic: 'музику' },
  { rx: /(спорт|футбол|баскетбол|теніс)/i, topic: 'спорт' },
  { rx: /(кіт|собак|тварин|кот|пес)/i, topic: 'тварин' },
  { rx: /(гра|ігор|steam|playstation)/i, topic: 'ігри' },
];

function detectTopic(text) {
  for (const { rx, topic } of TOPIC_HINTS) {
    if (rx.test(text)) return topic;
  }
  return null;
}

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
    .replace(/['\u2018\u2019`\u00B4]/g, '\u2019')
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
  out = out.replace(/#\s*[^#"""\n]+\.(txt|md|docx|doc|xlsx|xls|pptx|pdf)/gi, 'внутрішні матеріали команди Vidzone');
  out = out.replace(/(?:документ(у|а|ом)?|файл(у|а|ом)?|document)\s+[""][^""]+[""]/gi, 'внутрішні матеріали команди Vidzone');
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
function randomItem(arr = []) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] || null;
}
function pickVariantByText(arr = [], seedText = '') {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const text = String(seedText || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return arr[hash % arr.length] || arr[0];
}
function pickRelevantChannel(userText = '') {
  if (!CHANNELS.length) return null;
  const text = normalizeQuery(userText).toLowerCase();

  const byPriority = CHANNELS
    .slice()
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  const getPoolChannels = (names = []) => byPriority.filter((c) => names.includes(c?.name));
  const pickFromPool = (names = [], seed = '') => {
    const pool = getPoolChannels(names);
    if (!pool.length) return null;
    return pickVariantByText(pool, seed) || pool[0];
  };

  const defaultChannel = pickFromPool(OFFTOPIC_DEFAULT_CHANNELS, `${text}:default`) || byPriority[0] || CHANNELS[0];
  const kidsDefault = pickFromPool(OFFTOPIC_KIDS_CHANNELS, `${text}:kids-default`) || defaultChannel;

  for (const pool of THEMATIC_FALLBACK_POOLS) {
    const hasTheme = pool.keywords.some((k) => text.includes(k));
    if (!hasTheme) continue;
    const matched = getPoolChannels(pool.channels);
    if (!matched.length) continue;
    return pickVariantByText(matched, `${text}:${pool.keywords[0]}`) || matched[0];
  }

  let bestScore = -1;
  let best = null;

  for (const item of CHANNELS) {
    const keywords = Array.isArray(item?.keywords) ? item.keywords : [];
    const nameTokens = String(item?.name || '')
      .toLowerCase()
      .split(/[^a-zа-яіїєґ0-9+]+/iu)
      .filter(Boolean);
    const allKeys = [...keywords, ...nameTokens];
    let score = 0;
    for (const key of allKeys) {
      if (!key) continue;
      if (text.includes(String(key).toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
      continue;
    }
    if (score === bestScore && best) {
      const bestPriority = best.priority ?? 999;
      const currentPriority = item.priority ?? 999;
      if (currentPriority < bestPriority) best = item;
    }
  }

  if (bestScore <= 0) {
    const kidsHints = ['дит', 'діт', 'мульт', 'казк', 'іграшк', 'школ', 'родин'];
    if (kidsHints.some((hint) => text.includes(hint))) return kidsDefault;
    return defaultChannel;
  }

  return best || defaultChannel;
}

async function buildGuidedFallback(userText = '') {
  const ruleBasedChannel = pickRelevantChannel(userText) || { name: OFFTOPIC_DEFAULT_CHANNELS[0] };
  const llmChannel = await pickRelevantChannelByLLM(userText);
  const channel = llmChannel || ruleBasedChannel;
  const channelName = channel.name || OFFTOPIC_DEFAULT_CHANNELS[0];

  // Detect topic for more natural intro
  const topic = detectTopic(userText);

  // Pick intro phrase
  let intro = pickVariantByText(FALLBACK_INTRO_TEMPLATES, `${userText}:intro`) || FALLBACK_INTRO_TEMPLATES[0];
  if (topic) {
    intro = intro.replace('{topic}', topic);
  } else {
    intro = intro.replace(' — не моя справа реклама, а {topic}', '');
    intro = intro.replace(' — не моя справа, а {topic}', '');
    intro = intro.replace('{topic}', 'цю тему');
  }

  // Pick bridge to channel
  const bridge = (pickVariantByText(FALLBACK_BRIDGE_TEMPLATES, `${userText}:bridge`) || FALLBACK_BRIDGE_TEMPLATES[0])
    .replace(/{channel}/g, channelName);

  // Pick ad tail
  const tail = (pickVariantByText(FALLBACK_AD_TAIL_TEMPLATES, `${userText}:tail`) || FALLBACK_AD_TAIL_TEMPLATES[0])
    .replace(/{channel}/g, channelName)
    .replace('{contact}', CONTACT_ANI);

  return `${intro} ${bridge} ${tail}`;
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
const ENABLE_GPT_CHANNEL_ROUTER = process.env.ENABLE_GPT_CHANNEL_ROUTER !== 'false';

async function pickRelevantChannelByLLM(userText = '') {
  if (!ENABLE_GPT_CHANNEL_ROUTER) return null;
  if (!process.env.OPENAI_API_KEY) return null;
  if (!CHANNELS.length) return null;

  const catalog = CHANNELS.map((c) => ({
    name: c?.name,
    theme: c?.theme || '',
    keywords: Array.isArray(c?.keywords) ? c.keywords.slice(0, 8) : [],
    priority: c?.priority ?? 999,
  }));

  const routerPrompt = `
Ти маршрутизатор каналу для Vidzone.
Обери ОДИН найбільш релевантний канал зі списку нижче для питання користувача.
Поверни ЛИШЕ JSON без пояснень у форматі: {"channel":"<точна_назва_каналу>"}.
Якщо питання загальне/офтоп — обери найкращий універсальний канал для широкої аудиторії.

Список каналів:
${JSON.stringify(catalog)}
`.trim();

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: routerPrompt },
          { role: 'user', content: userText },
        ],
      }),
    });

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const pickedName = String(parsed?.channel || '').trim();
    if (!pickedName) return null;

    const exact = CHANNELS.find((c) => c?.name === pickedName);
    if (exact) return exact;

    const lowered = pickedName.toLowerCase();
    return CHANNELS.find((c) => String(c?.name || '').toLowerCase() === lowered) || null;
  } catch (e) {
    console.error('Channel router LLM error:', e);
    return null;
  }
}


function buildChannelsSummary(userText = '') {
  const text = (userText || '').toLowerCase();
  const THEMES = ['Дитячий','Жіночий','Чоловічий','Унісекс'];
  let filterTheme = null;
  if (/дит(яч)?/.test(text)) filterTheme = 'Дитячий';
  else if (/жіноч/.test(text)) filterTheme = 'Жіночий';
  else if (/чоловіч/.test(text)) filterTheme = 'Чоловічий';
  else if (/унісекс/.test(text)) filterTheme = 'Унісекс';
  const items = Array.isArray(CHANNELS) ? CHANNELS : [];
  const grouped = {};
  for (const theme of THEMES) {
    if (filterTheme && theme !== filterTheme) continue;
    const chs = items.filter(c => c.theme === theme)
      .sort((a,b) => (a.priority??999)-(b.priority??999))
      .slice(0,8).map(c => c.name);
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
 * 8) GPT Router + Основний хендлер
 * ========================= */

// ── Таблиця контентних каналів для офтопу ──
const CONTENT_CHANNELS = [
  {name:'24 Канал',                         topic:'новини, політика, Україна, війна'},
  {name:'EspresoTV',                         topic:'новини, аналітика, журналістика'},
  {name:'Setanta Sports',                    topic:'спорт, футбол, матчі, змагання'},
  {name:'[M] Блог Спорт UA HD',             topic:'спорт, тренування, огляди'},
  {name:'[M] Блог Кухня UA HD',             topic:'кулінарія, рецепти, їжа, готування'},
  {name:'[M] Блог Мандри 1 HD',             topic:'мандри, туризм, подорожі, відпустка'},
  {name:'[M] Орел і решка',                 topic:'подорожі, розваги, лайфстайл, широка аудиторія'},
  {name:'[M] Блог Авто/Мото UA HD',         topic:'автомобілі, машини, мото, техніка'},
  {name:'Viasat Nature EU',                  topic:'природа, тварини, дика природа, екологія'},
  {name:'[M] Zoosvit',                       topic:'тварини, домашні улюбленці, собаки, коти'},
  {name:'[M] Блог музичний HD',             topic:'музика, кліпи, виконавці, пісні, концерти'},
  {name:'М1',                                topic:'музика, хіти, поп, рок, українська музика'},
  {name:'Viasat Explorer EU',                topic:'документальне кіно, пригоди, відкриття'},
  {name:'[M] Телесеріал HD',                topic:'серіали, мелодрами, драми, кіно'},
  {name:'[M] Речдок',                       topic:'детективи, кримінал, розслідування'},
  {name:'HISTORY',                           topic:'історія, документалки, таємниці, наука'},
  {name:'[M] Комедія',                      topic:'гумор, комедія, жарти, розваги'},
  {name:'TET',                               topic:'реаліті-шоу, молодіжний контент, розваги'},
  {name:'KVARTAL TV',                        topic:'гумор, квартал 95, шоу, комедія'},
  {name:'[M] Блог Будівництво та ремонт HD', topic:"ремонт, будівництво, інтер'єр, дача"},
  {name:'Vidzone МЕДИЧНІ СЕРІАЛИ',           topic:"медицина, здоров'я, лікарі, серіали"},
  {name:'[М] Доктор Комаровський',          topic:"здоров'я дітей, педіатрія, поради"},
  {name:'ПЛЮСПЛЮС',                          topic:'мультфільми, діти, дитячий контент'},
  {name:'PIXEL',                             topic:'мультфільми, анімація, діти'},
  {name:'1+1 Україна',                       topic:'серіали, жіночий контент, реаліті'},
  {name:'Бігуді',                            topic:'краса, мода, стиль, жіночий контент'},
  {name:'[М] БОЙОВИК HD',                   topic:'бойовики, action, пригоди, чоловічий'},
  {name:'2+2',                               topic:'спорт, розваги, гумор, чоловічий контент'},
];

// ── GPT Router: визначає що робити з повідомленням ──
async function routeMessage(text, apiKey) {
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  const prompt = `Ти роутер Telegram-бота Vidzone (Digital TV реклама в Україні).
Визнач яка дія потрібна для повідомлення користувача.

Повідомлення: "${text.slice(0, 400)}"

Дії:
- "chat"     — привітання, подяка, загальна балачка, питання не про рекламу і не про конкретний бренд/продукт
- "rag"      — питання про Vidzone, Digital TV рекламу, OTT, CPM, ціни, знижки, пакети, таргетинг, аудиторію, технічні вимоги, кейси, ефективність
- "channels" — питання про список каналів, пакети каналів (дитячий, жіночий і т.д.)
- "offtopic" — питання про зовнішній світ (новини, погода, рецепти, спорт, кіно, музика, тварини, авто, політика)
- "docs"     — просить шаблони документів, гарантійний лист, музична довідка
- "joke"     — просить жарт, щось смішне, розсмішити

Поверни ТІЛЬКИ JSON без пояснень: {"action":"назва_дії"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 30, temperature: 0, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    const action = parsed?.action;
    if (['chat','rag','channels','offtopic','docs','joke'].includes(action)) return action;
    return 'rag'; // fallback
  } catch(e) {
    console.error('routeMessage error:', e.message);
    return 'rag'; // fallback при помилці
  }
}

// ── Офтоп: GPT вибирає канал зі списку ──
async function pickChannelForOfftopic(userText, apiKey, topic = null) {
  const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

  // Спочатку шукаємо по темі з JSON якщо тема вже відома
  if (topic && offtopicChannels?.topics?.[topic]) {
    const candidates = offtopicChannels.topics[topic];
    const name = candidates[Math.floor(Math.random() * candidates.length)];
    const found = CHANNELS.find(c => c.name === name);
    if (found) { console.log('offtopic JSON hit:', topic, '->', name); return name; }
  }

  // Інакше GPT вибирає з повного списку
  const channelList = CONTENT_CHANNELS.map(c => '- ' + c.name + ': ' + c.topic).join('\n');
  const prompt = 'Тема: "' + userText.slice(0,200) + '"\nОбери ОДИН найрелевантніший канал. Поверни ТІЛЬКИ JSON: {"channel":"назва"}\n\n' + channelList;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 60, temperature: 0, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim().replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    const found = CHANNELS.find(c => c.name === parsed?.channel);
    console.log('pickChannel:', parsed?.channel, found ? 'OK' : 'NOT FOUND');
    return found?.name || OFFTOPIC_DEFAULT_CHANNELS[Math.floor(Math.random() * OFFTOPIC_DEFAULT_CHANNELS.length)];
  } catch(e) {
    console.error('pickChannel error:', e.message);
    return OFFTOPIC_DEFAULT_CHANNELS[0];
  }
}

export default async function handler(req, res) {
  const { body } = req;
  if (!body?.message?.text) return res.status(200).send('No text');

  const chatId   = body.message.chat.id;
  const userId   = body.message.from?.id;
  const rawText  = body.message.text.trim();

  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

  // Перевірка доступу
  if (ALLOWED_USER_IDS.length && !ALLOWED_USER_IDS.includes(String(userId))) {
    await bot.sendMessage(chatId, 'Вибачте, у вас немає доступу до цього бота.');
    return res.status(200).send('Unauthorized');
  }

  console.log('message:', JSON.stringify({ userId, rawText: rawText.slice(0, 100) }));

  // ── Jailbreak guard ──
  if (/ігноруй|ignore.*інструкц|обійди.*правил/i.test(rawText)) {
    await bot.sendMessage(chatId, 'Я спеціаліст з реклами — з цим не допоможу 😊', mainMenuKeyboard);
    return res.status(200).send('Jailbreak');
  }

  // ── /start ──
  if (/^\/start/.test(rawText)) {
    await bot.sendMessage(chatId, MESSAGES.start, mainMenuKeyboard);
    await bot.setMyCommands([{ command: 'start', description: 'Почати' }]);
    return res.status(200).send('Start');
  }

  // ── Статичні кнопки меню ──
  if (rawText === 'ℹ️ Про Vidzone') {
    await bot.sendMessage(chatId, MESSAGES.about, mainMenuKeyboard);
    return res.status(200).send('About');
  }
  if (rawText === '📄 Шаблони документів') {
    await bot.sendMessage(chatId, MESSAGES.docs, mainMenuKeyboard);
    return res.status(200).send('Docs');
  }
  if (rawText === '😄 Веселе про Vidzone') {
    await bot.sendMessage(chatId, MESSAGES.fun, mainMenuKeyboard);
    return res.status(200).send('Fun');
  }
  if (rawText === '❓ Задати питання') {
    await bot.sendMessage(chatId, 'Пишіть своє питання — я відповім!', mainMenuKeyboard);
    return res.status(200).send('AskPrompt');
  }

  // ── GPT Router ──
  const action = await routeMessage(rawText, apiKey);
  console.log('route:', action, 'for:', rawText.slice(0, 60));

  // ── CHANNELS ──
  if (action === 'channels') {
    const summary = buildChannelsSummary(rawText);
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: '[CHANNELS]' });
    await bot.sendMessage(chatId, summary, mainMenuKeyboard);
    return res.status(200).send('Channels');
  }

  // ── DOCS ──
  if (action === 'docs') {
    await bot.sendMessage(chatId, MESSAGES.docs, mainMenuKeyboard);
    return res.status(200).send('Docs');
  }

  // ── JOKE ──
  if (action === 'joke') {
    const jokePrompt = 'Придумай короткий дотепний жарт або факт про Digital TV рекламу, OTT або медіаринок України. Україномовний, 2-4 речення, легко і по-людськи.';
    try {
      const jr = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 200, temperature: 0.9, messages: [{ role: 'user', content: jokePrompt }] })
      });
      const jd = await jr.json();
      const joke = jd.choices?.[0]?.message?.content?.trim() || MESSAGES.fun;
      await bot.sendMessage(chatId, joke, mainMenuKeyboard);
    } catch(e) {
      await bot.sendMessage(chatId, MESSAGES.fun, mainMenuKeyboard);
    }
    return res.status(200).send('Joke');
  }

  // ── OFFTOPIC ──
  if (action === 'offtopic') {
    const channelName = await pickChannelForOfftopic(rawText, apiKey);
    const reply = 'Про це я не спеціаліст 😊 Але є канал «' + channelName + '» — там саме такий контент. До речі, на цьому каналі виходить реклама Vidzone. Якщо цікавить розміщення — ' + CONTACT_ANI + '.';
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
    await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    return res.status(200).send('Offtopic');
  }

  // ── CHAT (смол-ток, привіт, дякую) ──
  if (action === 'chat') {
    const chatSystemPrompt = `Ти — дружній асистент Vidzone, компанії з Digital TV реклами в Україні.
Спілкуйся природно і тепло, відповідай коротко (1-3 речення).
Якщо це привітання — привітайся у відповідь і запропонуй допомогу з питань реклами.
Якщо дякують — відповідай скромно.
Не вигадуй інформацію про Vidzone якщо не впевнений.`;
    try {
      const cr = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 150, temperature: 0.7,
          messages: [{ role: 'system', content: chatSystemPrompt }, { role: 'user', content: rawText }] })
      });
      const cd = await cr.json();
      const reply = cd.choices?.[0]?.message?.content?.trim() || 'Привіт! Чим можу допомогти? 😊';
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
      await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    } catch(e) {
      await bot.sendMessage(chatId, 'Привіт! Чим можу допомогти? 😊', mainMenuKeyboard);
    }
    return res.status(200).send('Chat');
  }

  // ── RAG (default) ──
  try {
    const chunks = await retrieveRelevantChunks(rawText, apiKey, { topK: 6, minSim: 0.20 });
    const knowledgeBlock = chunks.join('\n\n---\n\n');

    const systemPrompt = `Ти — офіційний AI-помічник Vidzone, компанії з Digital TV реклами в Україні.

ПРАВИЛА:
• Відповідай ЗАВЖДИ українською, стисло (3–6 речень), професійно та дружньо.
• Використовуй ТІЛЬКИ інформацію з KB нижче. НЕ вигадуй цифри та факти.
• Якщо в KB немає точної відповіді — скажи чесно і дай контакт: ${CONTACT_ANI}. НЕ кажи просто "не знаю".
• Заборонено згадувати назви внутрішніх файлів.

ФОРМАТ:
• Ціна/CPM → конкретна цифра + що входить + контакт
• Канали/пакети → назви пакетів + конкретні канали
• Технічні вимоги → чіткий список
• Кейси → назва бренду + результат у цифрах

ПРИКЛАДИ:
П: "Скільки коштує реклама?"
В: "Базова ціна — 150 грн за 1 000 показів (ролик 15 сек). Знижки: пакетні до -15%, бюджетні до -20%. Детальний розрахунок — ${CONTACT_ANI}."

П: "Чому для фарми це ефективно?"
В: "На Vidzone SOV фарми лише 14% проти 46% на ТБ — менший клаттер, більше уваги. У 1 кв. 2026 категорія +68%. Кейс Solgar: +52% продажів лише на Digital TV."

П: "Яка аудиторія?"
В: "Vidzone охоплює 2,5 млн домогосподарств та 6 млн людей на місяць. 93% — Smart TV. Середній вік глядача 35-54 роки."

KB:
${knowledgeBlock || 'Інформація не знайдена.'}
`;

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: rawText }]
      })
    });
    const openaiData = await openaiRes.json();
    let reply = openaiData.choices?.[0]?.message?.content?.trim();

    if (!reply || !knowledgeBlock) {
      reply = `На жаль, точної інформації з цього питання у мене немає. Зверніться до ${CONTACT_ANI} — вона підкаже.`;
    }

    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: reply });
    await bot.sendMessage(chatId, reply, mainMenuKeyboard);
    return res.status(200).send('RAG_OK');

  } catch(err) {
    console.error('RAG error:', err);
    await bot.sendMessage(chatId, `Виникла помилка. Спробуйте ще раз або зверніться до ${CONTACT_ANI}.`, mainMenuKeyboard);
    return res.status(200).send('RAG_Error');
  }
}
