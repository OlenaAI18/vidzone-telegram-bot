// api/webhook.mjs — без обмеження доступу

import { retrieveRelevantChunks } from '../lib/rag.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';
import { logToGoogleSheet } from '../googleSheetsLogger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* =========================
 * Статичні файли
 * ========================= */
const guaranteeLetter    = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');
const techRequirements   = fs.readFileSync(path.join(__dirname, '../data/technical_requirements.md'), 'utf-8');
const musicCertificate   = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const channelsCatalog    = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/ad_channels.json'), 'utf-8'));

const guaranteeLetterDocx  = path.join(__dirname, '../data/guarantee_letter.docx');
const techRequirementsDocx = path.join(__dirname, '../data/technical_requirements.docx');
const musicCertificateDocx = path.join(__dirname, '../data/music_certificate.docx');

/* =========================
 * Константи
 * ========================= */
const CONTACT_ANI    = 'Анна Ільєнко — a.ilyenko@vidzone.com';
const CHANNELS       = Array.isArray(channelsCatalog?.items) ? channelsCatalog.items : [];
const OPENAI_MODEL   = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

/* =========================
 * Меню
 * ========================= */
const mainMenuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '📺 Про Vidzone', callback_data: 'menu_about' }, { text: '📄 Шаблони документів', callback_data: 'menu_documents' }],
      [{ text: '😄 Веселе про Vidzone', callback_data: 'menu_jokes' }, { text: '❓ Задати питання', callback_data: 'menu_help' }],
    ],
  },
};

/* =========================
 * Handler
 * ========================= */
export default async function handler(req, res) {
  const { body } = req;

  if (!body?.message?.text) {
    return res.status(200).send('ok');
  }

  const chatId = body.message.chat.id;
  const userId = String(body.message.from?.id || '');
  const text   = body.message.text.trim();
  const apiKey = process.env.OPENAI_API_KEY;

  console.log('[MSG]', { userId, text });

  // /start
  if (/^\/start/.test(text)) {
    await bot.sendMessage(
      chatId,
      'Привіт! Я AI-помічник Vidzone. Питай про рекламу, канали або ціни — допоможу.',
      mainMenuKeyboard
    );
    return res.status(200).send('start');
  }

  try {
    const chunks = await retrieveRelevantChunks(text, apiKey);
    const knowledge = chunks.join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: `Ти асистент Vidzone. Відповідай коротко, українською, по темі Digital TV реклами.`,
          },
          {
            role: 'user',
            content: `Питання: ${text}\n\nКонтекст:\n${knowledge}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Спробуйте ще раз';

    await logToGoogleSheet({
      timestamp: new Date().toISOString(),
      userId,
      userMessage: text,
      botResponse: reply,
    });

    await bot.sendMessage(chatId, reply, mainMenuKeyboard);

    return res.status(200).send('ok');

  } catch (err) {
    console.error(err);

    await bot.sendMessage(
      chatId,
      'Сталася помилка. Напишіть пізніше або зверніться до Анни Ільєнко.',
      mainMenuKeyboard
    );

    return res.status(200).send('error');
  }
}
