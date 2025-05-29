// webhook.mjs
import bot from '../bot.mjs';
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

  // 2. SOV-запити (заглушка)
  if (userMessage.startsWith('sov')) {
    await bot.sendMessage(
      id,
      '🔍 Ця команда передбачає побудову графіків. Функція в розробці. Якщо ви можете вказати приклади брендів або уточнити категорію — я підготую потрібні дані!'
    );
    return res.status(200).send('SOV stub sent');
  }

  // 3. Запит до OpenAI з кастомним system prompt
  const systemPrompt = `
Ти — офіційний помічник Vidzone. Твій стиль спілкування дружній, але професійний. 
Не ділись конфіденційною інформацією.

1. Якщо користувач просить SOV або місячну активність певної категорії:
  - Напиши, що ця команда наразі у розробці.
  - Запропонуй уточнити приклади брендів або виробників у категорії, якщо назва некоректна.

2. Якщо запит стосується підкатегорії — вкажи, якій категорії вона належить і уточни, що показати.

3. Якщо запит стосується документів (довідки, шаблони, гарантії) — запропонуй надіслати відповідні шаблони.

4. Якщо інформації немає — запропонуй звернутись до акаунт-менеджера: Анна Ільєнко, email: anna@vidzone.ua

5. Для будь-яких загальних питань про Vidzone — поясни, що це компанія, яка допомагає брендам розміщати відеорекламу на DigitalTV (Sweet.tv, MEGOGO, Київстар ТБ, Vodafone TV та інші).

Коротко: відповідай на основі бази знань, залишайся лаконічним, використовуй приклади з брендів, файлів і ринку відеореклами.
`;

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
            content: systemPrompt,
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

