const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const TOKEN = '8561160122:AAG8sGQZdx_mXK7Nyr0MtXfLWV8QLdkalh8';
const MCP_URL = 'http://localhost:4021';

const bot = new TelegramBot(TOKEN, {polling: true});

// ЛОВИМ ВСЕ СООБЩЕНИЯ ПЕРВЫМ
bot.on('message', (msg) => {
  console.log('📱 <- Telegram:', msg.text, 'chat:', msg.chat.id, 'user:', msg.from.username);
  
  // /start
  if (msg.text === '/start') {
    bot.sendMessage(msg.chat.id, '🚀 VaultAgent Online!\n/scan - live вальты');
    return;
  }
  
  // /scan
  if (msg.text === '/scan') {
    fetch(MCP_URL + '/scan/free')
      .then(res => res.json())
      .then(data => {
        console.log('📤 -> Scan data:', data);
        bot.sendMessage(msg.chat.id, '📊 ' + JSON.stringify(data, null, 2));
      })
      .catch(e => bot.sendMessage(msg.chat.id, '❌ MCP offline'));
    return;
  }
  
  // Любой текст
  bot.sendMessage(msg.chat.id, `💬 Получил: "${msg.text}"\n\nКоманды:\n/start - меню\n/scan - вальты`);
});

bot.on('polling_error', (error) => {
  console.log('❌ Polling:', error.code, error.message);
});

console.log('🤖 DEBUG Bot started!');
