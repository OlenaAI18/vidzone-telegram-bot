// bot.mjs
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

export default bot;

export const jokes = [
  '— Ти де свою рекламу бачив?\n— На Vidzone.\n— А я ще на пульт не натиснув, а вона вже мені в очах — точно таргетована 😄',
  'Якщо ти бачиш рекламу 5 разів на день — ти в Vidzone!',
  'Відзон — це коли відео каже "привіт" раніше, ніж ти клікаєш play.',
];
