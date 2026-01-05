const fs = require('fs');

const loginCode = `
// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('[Login] Login attempt for username:', username);

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  try {
    const users = await dynamicQuery('users', { username });

    if (users.length === 0) {
      console.log('[Login] User not found:', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = users[0];
    let match = false;

    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      match = await bcrypt.compare(password, user.password);
    } else {
      match = (password === user.password);

      if (match) {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          await dynamicUpdate('users',
            { password: hashedPassword },
            { id: user.id },
            false
          );
          console.log(`Password hashed for user: ${user.username}`);
        } catch (hashErr) {
          console.error('Failed to hash password:', hashErr);
        }
      }
    }

    if (match) {
      console.log('[Login] Password matched for user:', username);

      let department = 'General';
      
      if (user.role === 'system_admin') {
        department = 'System Administration';
      } else if (user.role === 'operation_admin') {
        department = 'Operations';
      } else {
        department = 'General';
      }

      const payload = {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        department: department,
        iat: Math.floor(Date.now() / 1000)
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '4h',
        issuer: 'emergency-assistance-app',
        audience: 'emergency-assistance-app'
      });

      console.log('[Login] JWT Token generated:', {
        userId: user.id,
        username: user.username,
        tokenLength: token.length,
        issuer: 'emergency-assistance-app',
        audience: 'emergency-assistance-app',
        expiresIn: '4h'
      });

      console.log('[Login] Token generated successfully');
      res.json({ success: true, token, user: { username: user.username, displayName: user.display_name, role: user.role } });
    } else {
      console.log('[Login] Password mismatch for user:', username);
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('[Login] ERROR:', err);
    console.error('[Login] Error stack:', err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
`;

let lines = fs.readFileSync('server.js', 'utf-8').split('\n');

// Find the login endpoint start
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("app.post('/api/login'")) {
    startIdx = i;
    break;
  }
}

if (startIdx === -1) {
  console.log('ERROR: Could not find login endpoint');
  process.exit(1);
}

// Find the closing }); for the login endpoint
let endIdx = -1;
let braceCount = 0;
let started = false;
for (let i = startIdx; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes("app.post('/api/login'")) {
    started = true;
  }
  
  if (started) {
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    
    if (braceCount === 0 && line.includes('});')) {
      endIdx = i;
      break;
    }
  }
}

if (endIdx === -1) {
  console.log('ERROR: Could not find login endpoint closing');
  console.log('Start index:', startIdx);
  process.exit(1);
}

console.log(`Replacing lines ${startIdx + 1} to ${endIdx + 1}`);

// Replace the login section
const before = lines.slice(0, startIdx);
const after = lines.slice(endIdx + 1);
const newContent = [...before, ...loginCode.split('\n'), ...after].join('\n');

fs.writeFileSync('server.js', newContent, 'utf-8');

console.log('Fixed login endpoint!');
