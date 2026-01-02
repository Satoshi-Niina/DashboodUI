/**
 * ログイン問題の診断・修正ツール
 * niina ユーザーのパスワードハッシュを確認・更新します
 */

const bcrypt = require('bcrypt');

// 期待されるパスワード
const expectedPassword = 'G&896845';

// database-setup.sqlにあるハッシュ
const currentHash = '$2b$10$BiKD0cFkIZfpxPlfwu6wTeBla8pXoBf59NC8Ap9gOWefpzExp1oZq';

console.log('========================================');
console.log('ログイン診断ツール');
console.log('========================================');
console.log('');
console.log(`対象ユーザー: niina`);
console.log(`期待パスワード: ${expectedPassword}`);
console.log('');

// 現在のハッシュが正しいか確認
bcrypt.compare(expectedPassword, currentHash).then(match => {
    console.log(`現在のハッシュとの一致: ${match ? '✓ 一致' : '✗ 不一致'}`);
    console.log('');
    
    if (!match) {
        console.log('⚠️ 現在のハッシュが正しくありません。新しいハッシュを生成します...');
        console.log('');
        
        // 新しいハッシュを生成
        bcrypt.hash(expectedPassword, 10).then(newHash => {
            console.log('新しいハッシュ:');
            console.log(newHash);
            console.log('');
            console.log('========================================');
            console.log('修正用SQLクエリ:');
            console.log('========================================');
            console.log('');
            console.log(`UPDATE master_data.users SET password = '${newHash}' WHERE username = 'niina';`);
            console.log('');
            console.log('このSQLをCloud SQLコンソールで実行してください。');
            console.log('');
            
            // 念のため、新しいハッシュが正しいか確認
            bcrypt.compare(expectedPassword, newHash).then(verifyMatch => {
                console.log(`新しいハッシュの検証: ${verifyMatch ? '✓ 正常' : '✗ エラー'}`);
            });
        });
    } else {
        console.log('✓ ハッシュは正しいです。');
        console.log('');
        console.log('ログインできない場合、以下を確認してください:');
        console.log('1. Cloud SQLデータベースにniinaユーザーが存在するか');
        console.log('2. usersテーブルがmaster_dataスキーマにあるか');
        console.log('3. アプリケーションがCloud SQLに正しく接続できているか');
        console.log('4. JWT_SECRETが環境変数に設定されているか');
        console.log('');
        console.log('以下のSQLで確認してください:');
        console.log('');
        console.log(`SELECT id, username, display_name, role FROM master_data.users WHERE username = 'niina';`);
    }
}).catch(err => {
    console.error('エラーが発生しました:', err);
});
