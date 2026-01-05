// 譛蟆城剞縺ｮ繝・せ繝医し繝ｼ繝舌・
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
  console.log(`笨・Test server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('笶・Server error:', err);
  process.exit(1);
});
