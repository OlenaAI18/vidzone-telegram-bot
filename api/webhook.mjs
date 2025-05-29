// webhook.mjs
import api from '../bot.mjs';
const { bot, jokes } = api;
import fetch from 'node-fetch';

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

  const allowedIds = process.env.ALLOWED_USER_IDS?.split(',') || [];

  if (!allowedIds.includes(userId.toString())) {
    await bot.sendMessage(id, '⛔️ Цей бот є приватним.');
    return res.status(200).send('Unauthorized user');
  }

  const userMessage = text?.toLowerCase().trim() || '';

  // 1. Вітальне повідомлення
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      'Привіт! Я перший віртуальний AI помічник Vidzone. Допоможу швидко розібратись з усіма тонкощами DigitalTV, документами, SOV та іншим. Напиши, що саме тебе цікавить 📺'
    );
    return res.status(200).send('Welcome sent');
  }

  // 2. Анекдот
  if (userMessage.includes('анекдот')) {
    const random = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, random);
    return res.status(200).send('Joke sent');
  }

  // 3. SOV-запити
  if (userMessage.startsWith('sov')) {
    await bot.sendMessage(
      id,
      '🔍 Ця команда передбачає побудову графіків. Функція в розробці. Якщо ви можете вказати приклади брендів або уточнити категорію — я підготую потрібні дані!'
    );
    return res.status(200).send('SOV stub sent');
  }

  // 4. Запит до GPT з інструкцією
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
          {
            role: 'system',
            content: `Ти — офіційний помічник Vidzone. Твій стиль спілкування дружній, але професійний. 
Користуйся файлами з бази знань, відповідай як кастомний GPT Vidzone. Якщо запит стосується документів — запропонуй надіслати шаблони.`,
          },
          {
            role: 'user',
            content: text,
          },
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
