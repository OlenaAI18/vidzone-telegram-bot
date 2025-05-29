// webhook.mjs
import type { VercelRequest, VercelResponse } from '@vercel/node';
import bot, { jokes } from '../bot.mjs';

const systemPrompt = `
Ти — офіційний помічник Vidzone. Твій стиль спілкування максимально дружній, але не виходить за межі, пам'ятай, що ти обличчя компанії, яка продає супер передову технологію.
Не ділись конфіденційною інформацією.
▪ Якщо користувач просить SOV або місячну активність певної категорії — скажи, що це трохи складніше, і зараз я працюю в текстовому режимі. Попроси зв'язатись з Анною Ільєнко або уточнити запит для текстової відповіді.
▪ Для інших питань використовуй знання з файлів Markdown та сайту Vidzone.
▪ Якщо інформації немає — запропонуй e-mail акаунт-менеджера. Напиши текст, що ця інформація достатньо складна, тому краще щоб її розказав наш комерційний директор Анна Ільєнко (anna.ilyenko@vidzone.com).
▪ Якщо людину цікавлять документи - приклад музичної довідки, технічних вимог до роликів, або гарантійного листа — можеш сказати, що надішлеш і коротко описати, що це.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { body } = req;

  if (!body.message) {
    return res.status(200).send('Non-message update skipped');
  }

  const { chat: { id }, text, from: { id: userId } } = body.message;
  const allowedIds = process.env.ALLOWED_USER_IDS?.split(',') || [];

  if (!allowedIds.includes(userId.toString())) {
    await bot.sendMessage(id, '⛔️ Цей бот є приватним.');
    return res.status(200).send('Unauthorized user');
  }

  const userMessage = text.toLowerCase();

  if (userMessage.includes('старт') || userMessage.includes('почати') || userMessage.includes('привіт')) {
    await bot.sendMessage(id, 'Привіт! Я перший віртуальний AI помічник Vidzone. Допоможу швидко розібратись з усіма тонкощами DigitalTV. Напиши, чим можу допомогти 😊');
    return res.status(200).send('Greeting sent');
  }

  if (userMessage.includes('анекдот')) {
    const random = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, random);
    return res.status(200).send('Joke sent');
  }

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
          { role: 'user', content: text }
        ],
      }),
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}
