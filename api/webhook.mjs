// api/webhook.mjs
import { config } from 'dotenv';
import bot from '../bot.mjs';

config();

export default async (req, res) => {
  try {
    const { message } = req.body;
    const chatId = message?.chat?.id;
    const text = message?.text || '';

    if (!chatId) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    await bot.sendMessage(chatId, text);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

