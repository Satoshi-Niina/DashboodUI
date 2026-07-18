#!/usr/bin/env node
/**
 * SQL スクリプトで demo_db ユーザーを初期化
 * 使用方法: node scripts/initialize-demo-users-direct.js
 */

const { Pool } = require('pg');
const path = require('path');

async function initializeDemoUsers() {
  const connectionConfig = {
    user: 'postgres',
    password: 'Takabeni',
    host: 'localhost',
    port: 5432,
    database: 'demo_db'
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('📝 Initializing demo_db users...');

    // password カラム確認・追加
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('⚠️  Adding password column...');
      await pool.query('ALTER TABLE public.users ADD COLUMN password VARCHAR(255) DEFAULT NULL');
      console.log('✅ Password column added');
    } else {
      console.log('✅ Password column already exists');
    }

    // NULL password を修正
    const nullPwdRes = await pool.query(`
      SELECT id, username FROM public.users WHERE password IS NULL
    `);

    for (const user of nullPwdRes.rows) {
      const pwd = user.username === 'admin' ? 'admin123' : 'demo123';
      console.log(`📝 Setting password for ${user.username}...`);
      await pool.query(
        'UPDATE public.users SET password = $1 WHERE id = $2',
        [pwd, user.id]
      );
    }

    // デモユーザー挿入（存在しない場合）
    const insertRes = await pool.query(`
      INSERT INTO public.users (username, password, display_name, role) VALUES 
      ('niina', 'demo123', '新井二郎', 'admin'),
      ('demo_user', 'demo123', 'デモユーザー', 'user'),
      ('admin', 'admin123', '管理者', 'admin')
      ON CONFLICT (username) DO NOTHING
      RETURNING username
    `);

    if (insertRes.rows.length > 0) {
      console.log('✅ Inserted users:', insertRes.rows.map(r => r.username).join(', '));
    }

    // 確認
    const finalRes = await pool.query(`
      SELECT id, username, password, display_name, role FROM public.users 
      WHERE username IN ('niina', 'demo_user', 'admin')
      ORDER BY id
    `);

    console.log('\n📊 Final user state:');
    console.log('─'.repeat(60));
    for (const u of finalRes.rows) {
      const pwdStatus = u.password 
        ? (u.password.startsWith('$2') ? 'HASHED' : 'PLAINTEXT(' + u.password + ')') 
        : 'NULL';
      console.log(`  ${u.username.padEnd(15)} | ${u.display_name.padEnd(10)} | ${pwdStatus}`);
    }
    console.log('─'.repeat(60));
    console.log('✅ Demo users initialized successfully!\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDemoUsers();
