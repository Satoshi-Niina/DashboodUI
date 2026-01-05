# 繝ｭ繧ｰ繧､繝ｳ諠・ｱ縺ｮ莉悶い繝励Μ縺ｸ縺ｮ蠑輔″邯吶℃讖溯・

## 讎りｦ・
縺薙・繧ｷ繧ｹ繝・Β縺ｧ縺ｯ縲√ム繝・す繝･繝懊・繝峨°繧峨Ο繧ｰ繧､繝ｳ貂医∩縺ｮ繝ｦ繝ｼ繧ｶ繝ｼ諠・ｱ繧剃ｻ悶・繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｫ蠑輔″邯吶＄縺薙→縺後〒縺阪∪縺吶・ 
繝ｦ繝ｼ繧ｶ繝ｼ縺ｯ蜷・い繝励Μ縺ｧ蜀榊ｺｦ繝ｭ繧ｰ繧､繝ｳ縺吶ｋ蠢・ｦ√′縺ｪ縺上√す繝ｼ繝繝ｬ繧ｹ縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺ｧ縺阪∪縺吶・

## 謚陦謎ｻ墓ｧ・

### 騾∽ｿ｡蜀・ｮｹ
- **繝ｭ繧ｰ繧､繝ｳ繝ｦ繝ｼ繧ｶ繝ｼ蜷・* (username)
- **繝ｦ繝ｼ繧ｶ繝ｼID** (id)
- **讓ｩ髯・* (role: admin/user)
- **陦ｨ遉ｺ蜷・* (displayName)

縺薙ｌ繧峨・諠・ｱ縺ｯJWT・・SON Web Token・峨→縺励※證怜捷蛹悶＆繧後ゞRL繝代Λ繝｡繝ｼ繧ｿ邨檎罰縺ｧ騾∽ｿ｡縺輔ｌ縺ｾ縺吶・

## 螳溯｣・婿豕・

### 1. 騾∽ｿ｡蛛ｴ・医％縺ｮ繧｢繝励Μ・・
譌｢縺ｫ螳溯｣・ｸ医∩縺ｧ縺吶・app.js](app.js)縺ｧ繧｢繝励Μ襍ｷ蜍墓凾縺ｫ閾ｪ蜍慕噪縺ｫ繝医・繧ｯ繝ｳ縺御ｻ倅ｸ弱＆繧後∪縺吶・

```javascript
// app.js (譌｢蟄倥さ繝ｼ繝・- 螟画峩荳崎ｦ・
const token = localStorage.getItem('user_token');
const separator = baseUrl.includes('?') ? '&' : '?';
const tokenParam = AppConfig.tokenParamName || 'auth_token';
finalUrl = `${baseUrl}${separator}${tokenParam}=${encodeURIComponent(token)}`;
window.open(finalUrl, '_blank');
```

### 2. 蜿嶺ｿ｡蛛ｴ・井ｻ悶・繧｢繝励Μ・・

#### 繧ｹ繝・ャ繝・: auto-login.js繧偵さ繝斐・
[auto-login.js](auto-login.js) 繧剃ｻ悶・繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ縺ｮ繝・ぅ繝ｬ繧ｯ繝医Μ縺ｫ繧ｳ繝斐・縺励∪縺吶・

#### 繧ｹ繝・ャ繝・: HTML繝輔ぃ繧､繝ｫ縺ｧ隱ｭ縺ｿ霎ｼ縺ｿ
蜷・い繝励Μ縺ｮHTML繝輔ぃ繧､繝ｫ縺ｮ`<head>`繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｾ縺溘・`<body>`縺ｮ譛蠕後〒隱ｭ縺ｿ霎ｼ縺ｿ縺ｾ縺呻ｼ・

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>繧｢繝励Μ繧ｱ繝ｼ繧ｷ繝ｧ繝ｳ</title>
</head>
<body>
    <!-- 繧｢繝励Μ縺ｮ繧ｳ繝ｳ繝・Φ繝・-->
    
    <!-- 閾ｪ蜍輔Ο繧ｰ繧､繝ｳ讖溯・繧定ｿｽ蜉 -->
    <script src="./auto-login.js"></script>
</body>
</html>
```

#### 繧ｹ繝・ャ繝・: 閾ｪ蜍輔Ο繧ｰ繧､繝ｳ縺ｮ蜍穂ｽ懃｢ｺ隱・
繧ｹ繧ｯ繝ｪ繝励ヨ繧定ｪｭ縺ｿ霎ｼ繧縺縺代〒縲∽ｻ･荳九・蜃ｦ逅・′閾ｪ蜍慕噪縺ｫ螳溯｡後＆繧後∪縺呻ｼ・

1. URL繝代Λ繝｡繝ｼ繧ｿ縺九ｉ`auth_token`繧貞叙蠕・
2. 繝医・繧ｯ繝ｳ繧呈､懆ｨｼ繧ｨ繝ｳ繝峨・繧､繝ｳ繝茨ｼ・/api/verify-token`・峨↓騾∽ｿ｡
3. 讀懆ｨｼ謌仙粥譎ゅ√Θ繝ｼ繧ｶ繝ｼ諠・ｱ繧値ocalStorage縺ｫ菫晏ｭ・
4. 繧ｻ繝・す繝ｧ繝ｳ繧堤｢ｺ遶・

### 3. 繧ｵ繝ｼ繝舌・蛛ｴ縺ｮ險ｭ螳・

#### 蠢・域擅莉ｶ
- **JWT_SECRET**: 蜈ｨ繧｢繝励Μ縺ｧ蜷後§遘伜ｯ・嵯繧剃ｽｿ逕ｨ縺吶ｋ蠢・ｦ√′縺ゅｊ縺ｾ縺・
- **CORS險ｭ螳・*: 莉悶・繧｢繝励Μ縺九ｉ縺ｮAPI繝ｪ繧ｯ繧ｨ繧ｹ繝医ｒ險ｱ蜿ｯ

#### .env繝輔ぃ繧､繝ｫ縺ｮ險ｭ螳壻ｾ・
```env
# 隱崎ｨｼ繧ｷ繝ｼ繧ｯ繝ｬ繝・ヨ・亥・繧｢繝励Μ縺ｧ蜷後§蛟､繧剃ｽｿ逕ｨ・・
JWT_SECRET=your-secret-key-here

# CORS險ｭ螳夲ｼ郁､・焚繝峨Γ繧､繝ｳ繧偵き繝ｳ繝槫玄蛻・ｊ縺ｧ謖・ｮ夲ｼ・
CORS_ORIGIN=http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004
```

#### server.js縺ｮ螳溯｣・ｼ域里縺ｫ螳溯｣・ｸ医∩・・
繝医・繧ｯ繝ｳ讀懆ｨｼ繧ｨ繝ｳ繝峨・繧､繝ｳ繝・`/api/verify-token` 縺御ｻ悶・繧｢繝励Μ縺九ｉ繧ょ茜逕ｨ蜿ｯ閭ｽ縺ｧ縺吶・

## 繧ｫ繧ｹ繧ｿ繝槭う繧ｺ

### 閾ｪ蜍募ｮ溯｡後ｒ辟｡蜉ｹ蛹悶☆繧句ｴ蜷・
[auto-login.js](auto-login.js) 縺ｮ譛蠕後・驛ｨ蛻・ｒ繧ｳ繝｡繝ｳ繝医い繧ｦ繝医＠縲∵焔蜍輔〒蜻ｼ縺ｳ蜃ｺ縺励∪縺呻ｼ・

```javascript
// DOMContentLoaded譎ゅ・閾ｪ蜍募ｮ溯｡後ｒ辟｡蜉ｹ蛹悶☆繧句ｴ蜷・
// if (document.readyState === 'loading') { ... } 繧偵さ繝｡繝ｳ繝医い繧ｦ繝・

// 謇句虚縺ｧ螳溯｡・
document.addEventListener('DOMContentLoaded', async () => {
    const success = await window.AutoLogin.execute({
        apiBaseUrl: 'http://localhost:3000', // 隱崎ｨｼ繧ｵ繝ｼ繝舌・縺ｮURL
        redirectOnSuccess: '/dashboard', // 繝ｭ繧ｰ繧､繝ｳ謌仙粥蠕後・繝ｪ繝繧､繝ｬ繧ｯ繝亥・
        redirectOnFailure: '/login.html', // 螟ｱ謨玲凾縺ｮ繝ｪ繝繧､繝ｬ繧ｯ繝亥・
        showConsoleLog: true
    });
    
    if (success) {
        console.log('閾ｪ蜍輔Ο繧ｰ繧､繝ｳ謌仙粥');
    }
});
```

### 謌仙粥譎ゅ・螟ｱ謨玲凾縺ｮ繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ
```javascript
window.AutoLogin.execute({
    apiBaseUrl: 'http://localhost:3000',
    onSuccess: (userInfo) => {
        console.log('繧医≧縺薙◎縲・ + userInfo.username + '縺輔ｓ');
        // 繧ｫ繧ｹ繧ｿ繝蜃ｦ逅・
    },
    onFailure: () => {
        console.error('閾ｪ蜍輔Ο繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆');
        // 繧ｫ繧ｹ繧ｿ繝蜃ｦ逅・
    }
});
```

## 繧ｻ繧ｭ繝･繝ｪ繝・ぅ蟇ｾ遲・

### 1. HTTPS騾壻ｿ｡縺ｮ菴ｿ逕ｨ
譛ｬ逡ｪ迺ｰ蠅・〒縺ｯ蠢・★HTTPS繧剃ｽｿ逕ｨ縺励※縺上□縺輔＞縲・

### 2. 繝医・繧ｯ繝ｳ縺ｮ譛牙柑譛滄剞
JWT繝医・繧ｯ繝ｳ縺ｯ1譎る俣縺ｧ譛滄剞蛻・ｌ縺ｫ縺ｪ繧翫∪縺呻ｼ亥､画峩蜿ｯ閭ｽ・峨・

### 3. URL縺九ｉ繝医・繧ｯ繝ｳ繧貞炎髯､
[auto-login.js](auto-login.js) 縺ｯ閾ｪ蜍慕噪縺ｫURL縺九ｉ繝医・繧ｯ繝ｳ繝代Λ繝｡繝ｼ繧ｿ繧貞炎髯､縺励∪縺呻ｼ亥ｱ･豁ｴ縺ｫ谿九ｉ縺ｪ縺・ｼ峨・

### 4. 繧ｻ繧ｭ繝･繧｢縺ｪ繧ｹ繝医Ξ繝ｼ繧ｸ
繝医・繧ｯ繝ｳ縺ｯlocalStorage縺ｫ菫晏ｭ倥＆繧後∪縺吶ゅｈ繧企ｫ倥＞繧ｻ繧ｭ繝･繝ｪ繝・ぅ縺悟ｿ・ｦ√↑蝣ｴ蜷医・縲？ttpOnly Cookie縺ｮ菴ｿ逕ｨ繧呈､懆ｨ弱＠縺ｦ縺上□縺輔＞縲・

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### 繝医・繧ｯ繝ｳ讀懆ｨｼ縺悟､ｱ謨励☆繧・
- **蜴溷屏**: JWT_SECRET縺檎焚縺ｪ繧・
- **隗｣豎ｺ遲・*: 蜈ｨ繧｢繝励Μ縺ｧ蜷後§JWT_SECRET繧剃ｽｿ逕ｨ

### CORS繧ｨ繝ｩ繝ｼ縺檎匱逕溘☆繧・
- **蜴溷屏**: CORS險ｭ螳壹′荳崎ｶｳ
- **隗｣豎ｺ遲・*: server.js縺ｮCORS險ｭ螳壹↓蜿嶺ｿ｡蛛ｴ繧｢繝励Μ縺ｮ繧ｪ繝ｪ繧ｸ繝ｳ繧定ｿｽ蜉

```javascript
// server.js
const corsOptions = {
  origin: ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true
};
app.use(cors(corsOptions));
```

### 閾ｪ蜍輔Ο繧ｰ繧､繝ｳ縺悟虚菴懊＠縺ｪ縺・
1. 繝悶Λ繧ｦ繧ｶ縺ｮ繧ｳ繝ｳ繧ｽ繝ｼ繝ｫ縺ｧ繧ｨ繝ｩ繝ｼ繧堤｢ｺ隱・
2. URL繝代Λ繝｡繝ｼ繧ｿ縺ｫ`auth_token`縺悟性縺ｾ繧後※縺・ｋ縺狗｢ｺ隱・
3. `/api/verify-token` 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医′豁｣蟶ｸ縺ｫ蜍穂ｽ懊＠縺ｦ縺・ｋ縺狗｢ｺ隱・

## 菴ｿ逕ｨ萓・

### 繝繝・す繝･繝懊・繝峨°繧峨い繝励Μ繧定ｵｷ蜍・
1. 繝繝・す繝･繝懊・繝峨↓繝ｭ繧ｰ繧､繝ｳ
2. 繧｢繝励Μ繧ｫ繝ｼ繝峨ｒ繧ｯ繝ｪ繝・け
3. 縲後い繝励Μ襍ｷ蜍輔阪・繧ｿ繝ｳ繧偵け繝ｪ繝・け
4. 譁ｰ縺励＞繧ｿ繝悶〒莉悶・繧｢繝励Μ縺瑚・蜍慕噪縺ｫ繝ｭ繧ｰ繧､繝ｳ縺輔ｌ縺溽憾諷九〒髢九″縺ｾ縺・

### URL縺ｮ萓・
```
http://localhost:3001/?auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

繝医・繧ｯ繝ｳ縺梧､懆ｨｼ縺輔ｌ縺溷ｾ後ゞRL縺ｯ莉･荳九・繧医≧縺ｫ螟画峩縺輔ｌ縺ｾ縺呻ｼ・
```
http://localhost:3001/
```

## API莉墓ｧ・

### POST /api/verify-token

#### 繝ｪ繧ｯ繧ｨ繧ｹ繝・
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 繝ｬ繧ｹ繝昴Φ繧ｹ・域・蜉滓凾・・
```json
{
  "valid": true,
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "displayName": "邂｡逅・・,
    "role": "admin"
  }
}
```

#### 繝ｬ繧ｹ繝昴Φ繧ｹ・亥､ｱ謨玲凾・・
```json
{
  "valid": false,
  "success": false,
  "message": "繝医・繧ｯ繝ｳ縺檎┌蜉ｹ縺ｾ縺溘・譛滄剞蛻・ｌ縺ｧ縺・
}
```

## 縺ｾ縺ｨ繧・

笨・**騾∽ｿ｡蛛ｴ**: 譌｢縺ｫ螳溯｣・ｸ医∩・・pp.js・・ 
笨・**蜿嶺ｿ｡蛛ｴ**: auto-login.js繧定ｪｭ縺ｿ霎ｼ繧縺縺・ 
笨・**繧ｵ繝ｼ繝舌・蛛ｴ**: JWT_SECRET縺ｨCORS繧定ｨｭ螳・ 
笨・**繧ｻ繧ｭ繝･繝ｪ繝・ぅ**: HTTPS縺ｨ驕ｩ蛻・↑繝医・繧ｯ繝ｳ邂｡逅・ｒ謗ｨ螂ｨ

縺薙ｌ縺ｧ縲∬､・焚縺ｮ繧｢繝励Μ髢薙〒繧ｷ繝ｼ繝繝ｬ繧ｹ縺ｪ繝ｭ繧ｰ繧､繝ｳ菴馴ｨ薙ｒ謠蝉ｾ帙〒縺阪∪縺吶・
