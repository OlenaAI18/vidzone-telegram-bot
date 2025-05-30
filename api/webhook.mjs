// webhook.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import bot from '../bot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Читання бази знань
const credentials = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Credentials_Cleaned.md'), 'utf-8');
const benchmark = fs.readFileSync(path.join(__dirname, '../data/Vidzone_Clutter_Benchmark_Cleaned.md'), 'utf-8');
const news = fs.readFileSync(path.join(__dirname, '../data/DigitalTVNews_Cleaned_2025.md'), 'utf-8');

// Читання шаблонів документів
const musicCertificate = fs.readFileSync(path.join(__dirname, '../data/music_certificate.md'), 'utf-8');
const techRequirements = fs.readFileSync(path.join(__dirname, '../data/tech_requirements.md'), 'utf-8');
const guaranteeLetter = fs.readFileSync(path.join(__dirname, '../data/guarantee_letter.md'), 'utf-8');

export default async function handler(req, res) {
  const { body } = req;

  if (!body.message) return res.status(200).send('Non-message update skipped');

  const {
    chat: { id },
    text,
  } = body.message;

  const userMessage = text?.toLowerCase().trim() || '';

  // Вітальне повідомлення
  if (userMessage === '/start' || userMessage.includes('привіт')) {
    await bot.sendMessage(
      id,
      `Привіт! Я AI-помічник Vidzone.

Можу допомогти з:
- інформацією про Vidzone і DigitalTV;
- аналітикою брендів;
- технічними вимогами до роликів;
- шаблонами документів.

Просто напиши, що саме тебе цікавить!
Якщо тобі потрібен документ — напиши "довідка", "гарантійний лист" або "технічні вимоги", і я запропоную варіанти 📄`
    );
    return res.status(200).send('Welcome sent');
  }

  // Вибір документів
  if (userMessage.includes('довідка') || userMessage.includes('документ') || userMessage.includes('гарантійний') || userMessage.includes('технічні вимоги')) {
    let optionsMessage = `Окей! Які документи вам потрібні? Виберіть один із варіантів:
1. Музична довідка
2. Технічні вимоги
3. Гарантійний лист`;

    await bot.sendMessage(id, optionsMessage);
    return res.status(200).send('Documents options sent');
  }

  // Відповідь на конкретні запити документів
  if (userMessage.includes('музична довідка') || userMessage.includes('довідка музична')) {
    await bot.sendMessage(id, musicCertificate);
    return res.status(200).send('Certificate sent');
  }

  if (userMessage.includes('технічні вимоги')) {
    await bot.sendMessage(id, techRequirements);
    return res.status(200).send('Tech Requirements sent');
  }

  if (userMessage.includes('гарантійний лист')) {
    await bot.sendMessage(id, guaranteeLetter);
    return res.status(200).send('Guarantee Letter sent');
  }

  // Логіка для питань про планування кампанії
  if (userMessage.includes('контакт') || userMessage.includes('охоплення') || userMessage.includes('планування') || userMessage.includes('кампанію')) {
    const planningResponse = `${benchmark}

---

📝 Для точного планування радимо також враховувати активність категорії.
Можу показати активність головних брендів, якщо потрібно.`;

    await bot.sendMessage(id, planningResponse);
    return res.status(200).send('Planning info sent');
  }

  // Заглушка для графіків
  if (userMessage.startsWith('sov')) {
    await bot.sendMessage(
      id,
      '🔍 Побудова графіків за категоріями наразі в розробці. Якщо можете вказати приклади брендів або виробників — підготую потрібні дані! 📊'
    );
    return res.status(200).send('SOV stub sent');
  }

  // База знань
  const contextText = `
# База знань Vidzone

=== Креденшли ===
${credentials}

=== Бенчмарк Clutter ===
${benchmark}

=== Новини DigitalTV ===
${news}
`;

  // System Prompt
  const systemPrompt = `
Ти — офіційний віртуальний AI-помічник Vidzone. Відповідай дружньо, але професійно. Не ділись конфіденційною інформацією.

Про Vidzone:
- Vidzone — провідна платформа для розміщення відеореклами на Digital TV (Sweet.tv, MEGOGO, Vodafone TV, Київстар ТБ).
- СЕО компанії — Євген Левченко.
- Комерційний директор — Анна Ільєнко (email: a.ilyenko@vidzone.com).

Користуйся цією базою знань для відповідей:
${contextText}

🔹 Якщо питання про керівників — вкажи Євгена Левченка як CEO.
🔹 Якщо запит про документи — запропонуй шаблон (довідка, технічні вимоги, гарантійний лист).
🔹 Якщо питання про аналітику SOV або активність брендів — скажи, що функція в розробці.
🔹 Якщо не знаєш відповіді — запропонуй звернутись до акаунт-менеджера Анна Ільєнко (a.ilyenko@vidzone.com).

Відповідай коротко, чітко, без вигаданих фактів.
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      }),
    });

    const data = await openaiRes.json();
    console.log('OpenAI full response:', JSON.stringify(data, null, 2));

    const reply = data.choices?.[0]?.message?.content || '🔔 Інформація недоступна. Зверніться до акаунт-менеджера Анни Ільєнко (a.ilyenko@vidzone.com)';
    await bot.sendMessage(id, reply);
    res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    await bot.sendMessage(id, '⚠️ Сталася помилка. Спробуйте пізніше.');
    res.status(500).send('OpenAI error');
  }
}



