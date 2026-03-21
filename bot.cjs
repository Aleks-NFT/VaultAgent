const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const TOKEN = '8561160122:AAG8sGQZdx_mXK7Nyr0MtXfLWV8QLdkalh8';
const MCP_URL = 'http://localhost:4021';

const bot = new TelegramBot(TOKEN, { 
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4  // IPv4 only
    }
  }
});

// Логируем ВСЕ сообщения
bot.on('message', (msg) => {
  console.log('💬 Получено:', msg.text, 'от', msg.chat.id);
  
  if (msg.text === '/start') {
    bot.sendMessage(msg.chat.id, '🚀 VaultAgent Online!\n/scan - live вальты');
  }
  
  if (msg.text === '/scan') {
    fetch(MCP_URL + '/scan/free')
      .then(res => res.json())
      .then(data => bot.sendMessage(msg.chat.id, '📊 Live Scan:\n' + JSON.stringify(data, null, 2)))
      .catch(e => bot.sendMessage(msg.chat.id, '❌ MCP offline'));
  }
});

// Ошибки polling
bot.on('polling_error', (error) => {
  console.log('❌ Polling error:', error.code, error.message);
});

console.log('🤖 Bot started! Жду сообщения...');
