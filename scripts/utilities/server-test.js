// 最小限のテストサーバー
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('Starting minimal test server...');
console.log('PORT:', PORT);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.get('/', (req, res) => {
  res.send('Test server is working!');
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});
