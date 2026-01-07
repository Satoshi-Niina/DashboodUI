const pool = require('./shared-db-config');
async function check() {
    try {
        const res = await pool.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port()');
        console.table(res.rows);
    } finally {
        await pool.end();
    }
}
check();
