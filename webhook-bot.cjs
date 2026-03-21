const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const TOKEN = '8561160122:AAG8sGQZdx_mXK7Nyr0MtXfLWV8QLdkalh8';
const bot = new TelegramBot(TOKEN);

bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, '🚀 LIVE!'));
bot.onText(/\/scan/, async (msg) => {
  const data = await fetch('http://localhost:4021/scan/free').then(r=>r.json());
  bot.sendMessage(msg.chat.id, JSON.stringify(data, null, 2));
});

bot.setWebHook('NGROK_WEBHOOK_URL_HERE');
console.log('Webhook ready!');
