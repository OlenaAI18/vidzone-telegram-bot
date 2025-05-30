import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Завантаження довідок
const musicReference = fs.readFileSync(path.join(__dirname, '../data/music_reference.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');

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

  // Вимикаємо перевірку allowedIds для тесту

  const userMessage = text?.toLowerCase().trim() || '';

  // Перевірка довідок
  if (userMessage.includes('музична довідка')) {
    await bot.sendMessage(id, `🎶 Музична довідка:\n\n${musicReference}`);
    return res.status(200).send('Music reference sent');
  }

  if (userMessage.includes('технічні вимоги')) {
    await bot.sendMessage(id, `⚙️ Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical requirements sent');
  }

  if (userMessage.includes('гарантійний лист')) {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
  }

  // Якщо команда не розпізнана
  await bot.sendMessage(id, 'Вибачте, я не знайшов інформацію по вашому запиту. Спробуйте запитати про музичну довідку, технічні вимоги або гарантійний лист.');
  res.status(200).send('Fallback sent');
}
