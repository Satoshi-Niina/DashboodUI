const fs = require('fs');

// Read server.js
let content = fs.readFileSync('server.js', 'utf-8');

// Replace all message strings containing garbled Japanese characters
content = content.replace(/message:\s*'[^']*[\u0080-\uFFFF][^']*'/g, "message: 'Operation completed'");

// Write back
fs.writeFileSync('server.js', content, 'utf-8');

console.log('Fixed all garbled message strings');
