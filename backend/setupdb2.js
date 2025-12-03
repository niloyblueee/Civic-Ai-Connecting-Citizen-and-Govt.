const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    console.log('🗄️  Setting up database...');
    let connection;
    try {
        connection = await mysql.createConnection({
            // If you use DB_URL:
            uri: process.env.DB_URL, // mysql2 supports "uri" option
            // OR use individual vars:
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        console.log('✅ Connected to Railway public MySQL');
        // Create government authorities table

        await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_bans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        phone_number VARCHAR(20),
        issue_id INT NULL,
        reason VARCHAR(255) NULL,
        banned_by INT NULL,
        banned_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        banned_until TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (banned_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL
      )
    `);
        console.log('✅ User bans table created');

        await connection.execute(`
      CREATE TABLE IF NOT EXISTS blacklisted_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        phone_number VARCHAR(20),
        reason VARCHAR(255) NULL,
        blacklisted_by INT NULL,
        blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (blacklisted_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_blacklisted_user (user_id)
      )
    `);
        console.log('✅ Blacklisted users table created');

        console.log('🎉 Database setup completed successfully!');
        console.log('\n📋 Sample accounts:');
        console.log('   Admin: admin@technovation.com / admin123 (Fixed)');
        console.log('   Citizen: citizen@technovation.com / citizen123');
        console.log('   Govt Authority: govt@technovation.com / govt123 (Pending Approval)');
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (connection && connection.end) {
            try {
                await connection.end();
            } catch (e) {
                // ignore close errors
            }
        }
    }
}

setupDatabase();