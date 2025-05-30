// Вітання
if (userMessage === '/start' || /привіт|хай|вітаю/.test(userMessage)) {
    await bot.sendMessage(id, welcomeMessage);
    return res.status(200).send('Welcome sent');
}

// Запит на документи
if (/довідка|документ|технічні вимоги|гарантійний лист/.test(userMessage)) {
    await bot.sendMessage(id, documentsMenu);
    return res.status(200).send('Document menu sent');
}

// Відповіді на конкретні запити документів
if (/музична довідка/.test(userMessage) || userMessage === '1') {
    await bot.sendMessage(id, `🎼 Музична довідка:\n\n${musicCertificate}`);
    return res.status(200).send('Music certificate sent');
}
if (/технічні вимоги/.test(userMessage) || userMessage === '2') {
    await bot.sendMessage(id, `📄 Технічні вимоги:\n\n${techRequirements}`);
    return res.status(200).send('Technical requirements sent');
}
if (/гарантійний лист/.test(userMessage) || userMessage === '3') {
    await bot.sendMessage(id, `📝 Гарантійний лист:\n\n${guaranteeLetter}`);
    return res.status(200).send('Guarantee letter sent');
}

// Відповідь про керівника/CEO
if (/керівник|сео|директор|головний/.test(userMessage)) {
    await bot.sendMessage(id, `CEO Vidzone — Євген Левченко.`);
    return res.status(200).send('CEO answer sent');
}

// Бренди, реклама, побудова бренду
if (/бренд|реклама|побудова бренду/.test(userMessage)) {
    await bot.sendMessage(id, brandText);
    return res.status(200).send('Brand answer sent');
}

// Планування кампанії
if (/планування|кампанія|контактів|скільки контактів/.test(userMessage)) {
    await bot.sendMessage(id, campaignPlanningText);
    return res.status(200).send('Planning answer sent');
}

// Анекдоти
if (/анекдот|жарт/.test(userMessage)) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await bot.sendMessage(id, `😄 Ось вам жарт:\n${randomJoke}`);
    return res.status(200).send('Joke sent');
}
