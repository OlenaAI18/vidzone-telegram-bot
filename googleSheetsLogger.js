import { google } from 'googleapis';

const SPREADSHEET_ID = '1OFqpUNXIayjpeq1ezX00fAtgNZt7fEQdpb77DNfDQLY';

// Ініціалізуємо клієнт тільки якщо є credentials
let sheets = null;
try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  }
} catch (e) {
  console.error('[Logger] Init error:', e.message);
}

export async function logToGoogleSheet({ timestamp, userId, userMessage, botResponse, note = '' }) {
  // Завжди логуємо в консоль (видно у Vercel Logs)
  console.log('[LOG]', JSON.stringify({
    t: timestamp,
    uid: userId,
    q: userMessage?.slice(0, 80),
    a: botResponse?.slice(0, 120),
    note: note || undefined,
  }));

  // Спробуємо записати в Sheets — якщо не вийде, мовчимо (не смітимо в логи)
  if (!sheets) return;

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Логи!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[timestamp, userId, userMessage, botResponse, note]],
      },
    });
  } catch (error) {
    // Тільки коротке повідомлення — не весь stack trace
    const msg = error?.response?.data?.error_description || error?.message || 'unknown';
    console.error('[Logger] Sheets write failed:', msg);
  }
}
