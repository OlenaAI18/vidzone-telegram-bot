import bot from '../bot.mjs';
import fetch from 'node-fetch';

export default async function handler(req, res) {
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

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `Ти GPT Vidzone. Відповідай лише на запити, повʼязані з аналітикою SOV, медіабайїнгом, відеорекламою та брендами в Україні. Не відхиляйся від теми. Відповідай лаконічно, українською.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.7
      }),
    });

    const data = await openaiRes.json();
    console.log('📦 OpenAI response:', JSON.stringify(data, null, 2)); // Додай це!
    const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Помилка. Спробуйте ще раз пізніше.');
    res.status(500).send('OpenAI error');
  }
}

