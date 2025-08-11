import { google } from 'googleapis';

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const SPREADSHEET_ID = '100106757739134346173';

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function logToGoogleSheet({ timestamp, userId, userMessage, botResponse }) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Логи!A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[timestamp, userId, userMessage, botResponse]],
      },
    });
    console.log('Log written to Google Sheets');
  } catch (error) {
    console.error('Error writing log to Google Sheets:', error);
  }
}
