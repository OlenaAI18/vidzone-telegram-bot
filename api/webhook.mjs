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

// Дефолтні канали — загальний розважально-пізнавальний контент
// Підбираються за темою запиту, не за охопленням
const OFFTOPIC_DEFAULT_CHANNELS_BY_MOOD = [
  { hint: /жінк|дівч|краса|мода|стил|парфум|серіал|романтик|коханн/i,    channel: '[M] Орел і решка' },
  { hint: /гумор|смішн|розваг|шоу|квартал|стенд|весел/i,                  channel: '[M] Комедія' },
  { hint: /кіно|фільм|дивит|актор|режисер/i,                              channel: 'Viasat Explorer EU' },
  { hint: /чолові|хлопц|мужськ|сила|брутал/i,                             channel: '[M] Речдок' },
  { hint: /родин|сім|діт|дитин/i,                                          channel: '[M] Сімейний' },
  { hint: /наук|техн|штучн|програм|ai|ай|цифров/i,                        channel: 'HISTORY' },
  { hint: /пізнавал|цікав|факт|дізнат/i,                                   channel: '[M] Блог Мандри 1 HD' },
];
// Справжній дефолт — коли взагалі нічого не зрозуміло
const OFFTOPIC_DEFAULT_CHANNELS = ['[M] Орел і решка', 'TET', '[M] Комедія'];
const OFFTOPIC_KIDS_CHANNELS = ['ПЛЮСПЛЮС', 'PIXEL', 'Cine+ Kids', '[M] МУЛЬТПРЕМЬЕРА HD'];

const THEMATIC_FALLBACK_POOLS = [
  // Діти / мультики
  {
    keywords: ['дит', 'діт', 'мульт', 'lego', 'казк', 'школ', 'іграшк', 'дошкіл', 'мама', 'дитинств'],
    channels: OFFTOPIC_KIDS_CHANNELS,
  },
  // Кулінарія
  {
    keywords: ['вареник', 'рецепт', 'кулінар', 'їжа', 'страва', 'кухн', 'готув', 'салат', 'борщ', 'суп', 'печив', 'торт'],
    channels: ['[M] Блог Кухня UA HD', '[M] Блог Подорожі'],
  },
  // Спорт / футбол
  {
    keywords: ['спорт', 'футбол', 'матч', 'чемпіонат', 'бокс', 'єдинобор', 'тренуван', 'волейбол', 'баскетбол', 'теніс', 'плаван', 'гол', 'ліга'],
    channels: ['Setanta Sports', 'Setanta Sports+', '[M] Огляд футболу HD', '[M] Блог Спорт UA HD'],
  },
  // Авто / мото
  {
    keywords: ['авто', 'мото', 'машин', 'автомобіл', 'двигун', 'tesla', 'bmw', 'toyota', 'ford', 'пдд', 'водій', 'заправк'],
    channels: ['[M] Блог Авто/Мото UA HD', '[M] Блог Авто/Мото HD'],
  },
  // Природа / тварини
  {
    keywords: ['погод', 'клімат', 'природ', 'тварин', 'зоо', 'рослин', 'ліс', 'море', 'риб', 'собак', 'кіт', 'пес', 'птах', 'дельфін'],
    channels: ['Viasat Nature EU', '[M] Zoosvit', 'Фауна'],
  },
  // Музика
  {
    keywords: ['музик', 'пісн', 'концерт', 'виконавець', 'альбом', 'трек', 'хіт', 'поп', 'рок', 'реп', 'джаз'],
    channels: ['[M] Блог музичний HD', 'MusicBox', 'М1', 'М2'],
  },
  // Подорожі
  {
    keywords: ['подорож', 'мандр', 'відпуст', 'туризм', 'країн', 'місто', 'готел', 'літак', 'відвідат', 'пляж', 'море', 'гори'],
    channels: ['[M] Блог Мандри 1 HD', '[M] Блог Подорожі', '[M] Орел і решка'],
  },
  // Новини / політика
  {
    keywords: ['політик', 'новин', 'війн', 'збройн', 'трамп', 'зеленськ', 'вибор', 'кабмін', 'рада', 'корупц', 'путін', 'байден', 'нато', 'зсу'],
    channels: ['24 Канал', 'EspresoTV', 'Київ'],
  },
  // Кіно / серіали
  {
    keywords: ['фільм', 'кіно', 'серіал', 'дивит', 'актор', 'режисер', 'прем\'єр', 'нетфлікс', 'netflix', 'кінотеатр'],
    channels: ['[M] Орел і решка', '[M] Комедія', 'TET', 'Viasat Explorer EU'],
  },
  // Детектив / кримінал
  {
    keywords: ['детектив', 'злочин', 'вбивств', 'слідств', 'поліц', 'кримінал', 'суд', 'тюрм'],
    channels: ['[M] Речдок', '[М] БОЙОВИК HD', '[M] Телесеріал HD'],
  },
  // Будівництво / ремонт
  {
    keywords: ['ремонт', 'будівництв', 'інтерьєр', 'дача', 'сад', 'город', 'квартир', 'будинок', 'плитк', 'шпалер'],
    channels: ['[M] Блог Будівництво та ремонт HD', '[M] Блог Подорожі'],
  },
  // Здоров'я / медицина
  {
    keywords: ['здоров', 'медицин', 'лікар', 'хвороб', 'дієт', 'вітамін', 'лікуван', 'симптом', 'таблетк', 'аптек', 'болить'],
    channels: ['Vidzone МЕДИЧНІ СЕРІАЛИ', '[М] Доктор Комаровський'],
  },
  // Гумор / розваги
  {
    keywords: ['гумор', 'комедія', 'смішн', 'розваг', 'шоу', 'квартал', 'стенд'],
    channels: ['[M] Комедія', 'TET', 'KVARTAL TV'],
  },
  // Історія / документалка
  {
    keywords: ['історі', 'документал', 'воєнн', 'минул', 'архів', 'дослідж', 'наук'],
    channels: ['HISTORY', '[M] Речдок', '[М] БОЙОВИК HD'],
  },
];

/* =========================
 * Нативні fallback-шаблони
 * Логіка: пом'якшене "не моя тема" → канал → реклама Vidzone
 * ========================= */

// Вступні фрази — чому бот не відповідає на це
const FALLBACK_INTRO_TEMPLATES = [
  'Це поза моєю зоною компетенції — я більше про рекламу на digital TV.',
  'На це питання я чесно не маю відповіді — не моя територія.',
  'Я спеціаліст з реклами, а не з цієї теми — тут не підкажу.',
  'Я не маю думки з цього приводу — моя справа реклама, а не {topic}.',
  'Точної відповіді немає — але є кое-що краще.',
  'Тут я пасую — але є канал, який може зацікавити.',
  'Не моя тема, але зате я знаю, де глянути.',
  'Відповіді у мене немає, але є підказка.',
];

// Перехід до каналу
const FALLBACK_BRIDGE_TEMPLATES = [
  'Зате для любителів такого контенту є канал «{channel}» — там якраз близька тематика.',
  'Але якщо тебе цікавить щось у цьому напрямку, зверни увагу на канал «{channel}».',
  'Натомість є канал «{channel}» — там схожий контент для твоєї аудиторії.',
  'Схожі теми знайдеш на каналі «{channel}» — якраз для такої аудиторії.',
  'Зате є «{channel}» — там саме цей тип контенту.',
  'Але «{channel}» — канал, де це питання явно у темі.',
  'Якщо тема близька твоїй аудиторії, «{channel}» — хороший варіант.',
  'Пошукай на «{channel}» — там і близько, і в тему.',
];

// Хвіст про рекламу Vidzone
const FALLBACK_AD_TAIL_TEMPLATES = [
  'До речі, на цьому каналі виходить реклама Vidzone. Якщо цікавить розміщення — {contact}.',
  'І так, на «{channel}» є реклама Vidzone. Деталі у {contact}.',
  'На цьому каналі розміщується реклама Vidzone — усі умови підкаже {contact}.',
  'Канал входить у мережу Vidzone — щодо розміщення пиши {contact}.',
  'А ще «{channel}» — це частина інвентарю Vidzone. Питання по рекламі — до {contact}.',
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
function pickRelevantChannel(userText = '', rawText = '') {
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

    // Шукаємо дефолт по настрою/темі запиту
    for (const { hint, channel: chName } of OFFTOPIC_DEFAULT_CHANNELS_BY_MOOD) {
      if (hint.test(rawText || userText)) {
        const found = CHANNELS.find(c => c.name === chName);
        if (found) return found;
      }
    }
    return defaultChannel;
  }

  return best || defaultChannel;
}

async function buildGuidedFallback(userText = '') {
  const ruleBasedChannel = pickRelevantChannel(userText, rawText) || { name: OFFTOPIC_DEFAULT_CHANNELS[0] };
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
  CHANNELS_QUERY: /(яки(й|х|м)\s+канал|список\s+канал|пакет\s+канал|канал\w*\s+(є|маєт|доступ|включ|входит)|які\s+канал|скільки\s+канал|є\s+канал|дит(яч)?ий\s+пакет|жіноч\w+\s+пакет|чоловіч\w+\s+пакет|унісекс\s+пакет)/iu,

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
  if (RX.CHANNELS_QUERY.test(userTextNorm)) return 'CHANNELS_QUERY';
  if (RX.AVB.test(userTextNorm) || RX.BRAND_SPECIFIC.test(userTextNorm)) return 'ESCALATE';
  if (RX.JAILBREAK.test(userTextNorm)) return 'OOS';
  if (RX.COFFEE.test(userTextNorm) && !RX.TECH_REQS.test(userTextNorm)) return 'OOS';
  if (RX.COSMOS.test(userTextNorm)) return 'OOS';
  return 'RAG';
}

/* =========================
 * 6b) Каталог каналів для промпту
 * ========================= */
function buildChannelsSummary(userText = '') {
  const text = normalizeQuery(userText).toLowerCase();
  const PACKAGE_THEMES = ['Дитячий', 'Жіночий', 'Чоловічий', 'Унісекс'];
  let filterTheme = null;
  if (/дит(яч)?/.test(text)) filterTheme = 'Дитячий';
  else if (/жіноч/.test(text)) filterTheme = 'Жіночий';
  else if (/чоловіч/.test(text)) filterTheme = 'Чоловічий';
  else if (/унісекс/.test(text)) filterTheme = 'Унісекс';

  const items = Array.isArray(CHANNELS) ? CHANNELS : [];
  const grouped = {};
  for (const theme of PACKAGE_THEMES) {
    const filtered = items
      .filter(c => c.theme === theme && (!filterTheme || c.theme === filterTheme))
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .slice(0, 10)
      .map(c => c.name);
    if (filtered.length) grouped[theme] = filtered;
  }
  const lines = ['Vidzone має понад 300 каналів у 4 тематичних пакетах. Ось приклади:'];
  for (const [theme, names] of Object.entries(grouped)) {
    lines.push(`${theme} пакет: ${names.join(', ')}`);
  }
  lines.push(`Повний каталог і умови розміщення — ${CONTACT_ANI}.`);
  return lines.join('\n');
}

/* =========================
 * 7) LLM конфіг
 * ========================= */
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TEMPERATURE = 0.1;
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

  // B2) Каталог каналів — відповідаємо прямо з даних
  if (intent === 'CHANNELS_QUERY') {
    const summary = buildChannelsSummary(rawText);
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: '[CHANNELS_QUERY]' });
    await bot.sendMessage(chatId, summary, mainMenuKeyboard);
    return res.status(200).send('CHANNELS_QUERY');
  }

  // C) Техвимоги
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
    const botResponse = await buildGuidedFallback(rawText);
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'Off-scope/jailbreak' });
    await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
    return res.status(200).send('OOS');
  }

  // H) RAG-FIRST
  let relevantChunks = [];
  try {
    relevantChunks = await retrieveRelevantChunks(userText, process.env.OPENAI_API_KEY);
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

  // Перевіряємо чи питання взагалі про Vidzone/рекламу
  const VIDZONE_TOPIC_RX = /(vidzone|відзон|видзон|реклам|ott|cpm|cpt|пакет|таргет|охоплен|показ|канал|digital\s*tv|програматик|ролик|бренд|рекламодав|агенц|медіа|ssai|fast|cpv|vtr|грн)/i;
  const isVidzoneTopic = VIDZONE_TOPIC_RX.test(rawText);

  if (!knowledgeBlock || overlapScore(userText, knowledgeBlock) < 0.12) {
    if (isVidzoneTopic) {
      // Питання про Vidzone, але KB не знайшов — чесна відповідь, не offtopic
      const noInfoReply = \`На жаль, точної інформації з цього питання у мене немає. Зверніться до ${CONTACT_ANI} — вона підкаже.\`;
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: noInfoReply, note: 'Vidzone topic: KB weak' });
      await bot.sendMessage(chatId, noInfoReply, mainMenuKeyboard);
      return res.status(200).send('NoKB_VidzoneTopic');
    }
    // Справжній офтоп
    const botResponse = await buildGuidedFallback(rawText);
    await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'Offtopic: KB weak/empty' });
    await bot.sendMessage(chatId, botResponse, mainMenuKeyboard);
    return res.status(200).send('Offtopic_NoKB');
  }

  const channelHint = RX.CHANNELS_QUERY.test(userText) ? '\n\nКАТАЛОГ КАНАЛІВ:\n' + buildChannelsSummary(rawText) : '';

  const systemPrompt = `
Ти — офіційний AI-помічник Vidzone, компанії з розміщення Digital TV реклами в Україні.

ПРАВИЛА:
• Відповідай ЗАВЖДИ українською, стисло (3–6 речень), професійно та дружньо.
• Використовуй ТІЛЬКИ інформацію з KB нижче. НЕ вигадуй цифри та факти.
• Якщо в KB немає точної відповіді — скажи чесно: "Точних даних з цього питання у мене немає. Зверніться до ${CONTACT_ANI}". НЕ кажи "не знаю" без конкретного контакту.
• Заборонено згадувати назви внутрішніх файлів — кажи «матеріали команди Vidzone».
• Твоя спеціалізація: Digital TV реклама, OTT/CTV, Vidzone, медіапланування.

КАНАЛИ — відповідай конкретно:
• Якщо питають про канали або пакети — назви конкретні канали та пакети (Унісекс, Жіночий, Чоловічий, Дитячий).
• Підкажи що для детального підбору — звернутись до ${CONTACT_ANI}.

ФОРМАТ ВІДПОВІДЕЙ:
• Технічні вимоги → чіткий список пунктів
• Ціна/CPM → конкретна цифра + що входить + контакт для деталей
• Пакети/канали → назви пакетів + приклади каналів
• Якщо інформація часткова → дай що є + контакт

ПРИКЛАДИ:
Питання: "Скільки коштує реклама?"
Відповідь: "Базова ціна — 150 грн за 1 000 показів (ролик 15 сек). Є знижки: пакетні (до -15%), бюджетні (до -20%), сезонні. Для точного розрахунку — ${CONTACT_ANI}."

Питання: "Які канали є у Vidzone?"
Відповідь: "Понад 300 каналів у 4 пакетах: Унісекс (1+1 Україна, МЕГАХИТ, 24 Канал...), Жіночий (ЛЮБОВ, ДРАМА, Бігуді...), Чоловічий (БОЙОВИК, 2+2, Речдок...), Дитячий (ПЛЮСПЛЮС, PIXEL, Kids...). Детальний підбір — ${CONTACT_ANI}."

Питання: "Що таке поведінковий таргетинг?"
Відповідь: "Vidzone пропонує 14 поведінкових сегментів, розроблених Gradus Research. Наприклад: Мами, Леді, Джентльмени, Преміум ЦА, Мандрівники — реклама показується лише тим, хто відповідає профілю за патернами перегляду."

KB (релевантні фрагменти):
${knowledgeBlock}${channelHint}
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

    // Перевіряємо чи відповідь містить ознаки невпевненості
    const suspicious = ['передбачаю', 'гіпотетично', 'уявіть', 'в теорії'];
    const containsSuspicious = reply && suspicious.some((p) => reply.toLowerCase().includes(p));

    if (!reply || containsSuspicious) {
      if (isVidzoneTopic) {
        // GPT не впевнений, але питання про Vidzone — не замінюємо на offtopic, просто відправляємо до менеджера
        const fallbackReply = \`На це питання у мене немає повної інформації. Найкраще уточнити у ${CONTACT_ANI}.\`;
        await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse: fallbackReply, note: 'LLM uncertain Vidzone -> contact' });
        await bot.sendMessage(chatId, fallbackReply, mainMenuKeyboard);
        return res.status(200).send('LLM_VidzoneFallback');
      }
      const botResponse = await buildGuidedFallback(rawText);
      await logToGoogleSheet({ timestamp: new Date().toISOString(), userId, userMessage: rawText, botResponse, note: 'LLM uncertain -> offtopic' });
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
 

