// ビルド時にバージョン番号を自動更新
const fs = require('fs');
const path = require('path');

const version = Date.now();

// admin.htmlのバージョン更新
const adminHtmlPath = path.join(__dirname, 'admin.html');
let adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
adminHtml = adminHtml.replace(/admin\.js\?v=\d+/g, `admin.js?v=${version}`);
fs.writeFileSync(adminHtmlPath, adminHtml);

// index.htmlがあれば更新
const indexHtmlPath = path.join(__dirname, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  indexHtml = indexHtml.replace(/app\.js\?v=\d+/g, `app.js?v=${version}`);
  fs.writeFileSync(indexHtmlPath, indexHtml);
}

console.log(`✅ Version updated to: ${version}`);
