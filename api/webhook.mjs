import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантажуємо текстові бази знань
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

// Завантажуємо текст довідок
const musicDoc = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const techReqs = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');
const guarantee = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');

const systemPrompt = `
Ти — віртуальний помічник Vidzone. Допомагай на основі бази знань:
${credentials}
${news}
`;

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) {
    return res.status(200).send('Non-message update skipped');
  }

  const {
    chat: { id },
    text,
    from: { id: userId },
  } = body.message;

  // Вітальне повідомлення
  const welcomeMessage = `Привіт! Я — віртуальний помічник Vidzone.
Допоможу вам:
• отримати актуальну інформацію про Vidzone та ринок DigitalTV;
• надати корисні шаблони документів (технічні вимоги, довідки, гарантійний лист);
• спланувати кампанію DigitalTV;
• отримати трохи DigitalTV-шного гумору.

📝 Просто напишіть запитання або тему, яка вас цікавить.
Наприклад:
«Скільки контактів потрібно для кампанії?»
«Що таке Vidzone?»
«Які технічні вимоги до роликів?»`;

  const userMessage = text?.toLowerCase().trim() || '';

  // /start
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(id, welcomeMessage);
    return res.status(200).send('Welcome sent');
  }

  // Гумор
  if (userMessage.includes('анекдот') || userMessage.includes('жарт')) {
    const jokes = [
      '🎬 Чому реклама Vidzone завжди в ефірі? Бо навіть пульт не встигає натиснути кнопку! 📺',
      '📈 Реклама Vidzone така цільова, що інколи навіть бабусі згадують улюблені бренди!',
    ];
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, randomJoke);
    return res.status(200).send('Joke sent');
  }

  // Якщо питання про директора або CEO
  if (userMessage.includes('директор') || userMessage.includes('сео') || userMessage.includes('керівник') || userMessage.includes('головний')) {
    await bot.sendMessage(id, 'CEO Vidzone — Євген Левченко.');
    return res.status(200).send('CEO info sent');
  }

  // Якщо питання про планування кампанії, контакти
  if (userMessage.includes('контакт') || userMessage.includes('кампанія') || userMessage.includes('планування') || userMessage.includes('охоплення')) {
    await bot.sendMessage(id, `
📝 ${benchmark}

Якщо хочете отримати графіки активностей брендів по вашій категорії — напишіть мені її назву 🛒
`);
    return res.status(200).send('Planning recommendation sent');
  }

  // Довідки
  if (userMessage.includes('довідка') || userMessage.includes('технічні вимоги') || userMessage.includes('гарантійний лист')) {
    if (userMessage.includes('музична')) {
      await bot.sendMessage(id, musicDoc);
      return res.status(200).send('Music certificate sent');
    }
    if (userMessage.includes('технічні')) {
      await bot.sendMessage(id, techReqs);
      return res.status(200).send('Technical requirements sent');
    }
    if (userMessage.includes('гарантійний')) {
      await bot.sendMessage(id, guarantee);
      return res.status(200).send('Guarantee letter sent');
    }

    // Якщо не уточнили яка саме довідка
    await bot.sendMessage(id, `Окей! Які документи вам потрібні? Виберіть один із варіантів:
1. Музична довідка
2. Технічні вимоги
3. Гарантійний лист`);
    return res.status(200).send('Documents list sent');
  }

  // Основний запит через GPT
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content;

    if (reply) {
      await bot.sendMessage(id, reply);
    } else {
      await bot.sendMessage(id, `А ще вчусь, тому не на всі питання можу дати відповіді. Поки моїх знань недостатньо для твого питання, але вони точно є у Анни Ільєнко. Ось її контакт: a.ilyenko@vidzone.com 📩`);
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}






