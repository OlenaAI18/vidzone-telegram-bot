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

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'g-682cf1eba22c8191b9a0acacf9db7149-vidzone-ai-beta',
        messages: [{ role: 'user', content: text }],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error('OpenAI error:', err);
    await bot.sendMessage(id, '⚠️ Сталася помилка. Спробуйте пізніше.');
    res.status(500).send('OpenAI error');
  }
}
