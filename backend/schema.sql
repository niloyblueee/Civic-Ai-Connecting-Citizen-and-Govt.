//node -e "console.log(require('bcryptjs').hashSync('admin123', 12))"


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


    // Create users table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        firstName VARCHAR(50) NOT NULL,
        lastName VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        national_id VARCHAR(20) UNIQUE,
        sex ENUM('male', 'female', 'other') NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        role ENUM('admin', 'govt_authority', 'citizen') DEFAULT 'citizen',
        status ENUM('active', 'pending', 'rejected') DEFAULT 'active',
        profileImage VARCHAR(255),
        googleId VARCHAR(100) UNIQUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        reward_point INT DEFAULT 0
      )
    `);
    console.log('✅ Users table created');

    // Create citizens table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS citizens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        address TEXT,
        location_coordinates JSON,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Citizens table created');

    // Create government authorities table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS govt_authorities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        department VARCHAR(100) NOT NULL,
        region ENUM('dhaka_north', 'dhaka_south') NOT NULL,
        admin_level ENUM('super', 'regular') DEFAULT 'regular',
        permissions JSON,
        approved_by INT,
        approved_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Government Authorities table created');

    // Create admins table (fixed single admin)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        admin_level ENUM('super') DEFAULT 'super',
        permissions JSON,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Admins table created');

    // Insert fixed super admin record
    await connection.execute(`
      INSERT INTO admins(user_id, admin_level)
      SELECT id, 'super' 
      FROM users WHERE email = 'admin@technovation.com'
      ON DUPLICATE KEY UPDATE admin_level = admin_level;
    `);


    // Create ISSUES table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS issues(
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone_number VARCHAR(20),
        coordinate VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        photo TEXT(60000),
        emergency BOOLEAN DEFAULT FALSE,
        status ENUM('pending', 'in_progress', 'resolved', 'rejected') DEFAULT 'pending',
        assigned_department VARCHAR(100) NULL
        description_pic_AI VARCHAR(255) NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        validation boolean DEFAULT FALSE,
        REASON_TEXT VARCHAR(255) NULL
      )
    `);


    console.log('✅ Issues table created');


    await connection.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        duration_minutes INT NOT NULL,
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Events table (with duration) created');

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

    // Insert fixed admin user (password: admin123)
    const adminPassword = '$2b$12$/q8ieN3O2vmWEY/Uwh0uX.tD6sZHGSrOzhGtbNdRtAUnYNiAoPEZe';
    await connection.execute(`
      INSERT IGNORE INTO users(firstName, lastName, email, password, national_id, sex, phone_number, role, status)
      VALUES('System', 'Admin', 'admin@technovation.com', ?, 'ADMIN001', 'male', '01300000000', 'admin', 'active')
    `, [adminPassword]);
    console.log('✅ Fixed admin user created (admin@technovation.com / admin123)');

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
