// bot.js
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const openaiEndpoint = 'https://api.openai.com/v1/chat/completions';
const customGPTId = 'g-682cf1eba22c8191b9a0acacf9db7149-vidzone-ai-beta';
const allowedIds = process.env.ALLOWED_USER_IDS.split(',').map(id => id.trim());

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const userMessage = msg.text || '';

  if (!allowedIds.includes(userId)) {
    bot.sendMessage(chatId, "⛔️ Цей бот є приватним.");
    return;
  }

  try {
    const response = await fetch(openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: customGPTId,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '🤖 GPT не надав відповіді.';
    bot.sendMessage(chatId, reply);
  } catch (err) {
    console.error('OpenAI error:', err);
    bot.sendMessage(chatId, '⚠️ Сталася помилка. Спробуйте пізніше.');
  }
});
export default bot;
