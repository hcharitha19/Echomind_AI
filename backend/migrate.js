// config/migrate.js — Run: node config/migrate.js
require('dotenv').config();
const { getPool, testConnection } = require('./db');

const migrate = async () => {
  await testConnection();
  const pool = getPool();

  const queries = [
    /* ── Users table ── */
    `CREATE TABLE IF NOT EXISTS users (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(100)         NOT NULL,
      email         VARCHAR(255)         NOT NULL UNIQUE,
      password_hash VARCHAR(255)         NOT NULL,
      avatar_url    VARCHAR(500)         DEFAULT NULL,
      is_active     TINYINT(1)           NOT NULL DEFAULT 1,
      is_verified   TINYINT(1)           NOT NULL DEFAULT 0,
      role          ENUM('user','admin') NOT NULL DEFAULT 'user',
      last_login    DATETIME             DEFAULT NULL,
      created_at    DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    /* ── Refresh tokens table ── */
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      token      VARCHAR(500) NOT NULL UNIQUE,
      expires_at DATETIME     NOT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_token   (token(255)),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    /* ── Chat sessions table ── */
    `CREATE TABLE IF NOT EXISTS chat_sessions (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          NOT NULL,
      session_id VARCHAR(100) NOT NULL UNIQUE,
      title      VARCHAR(255) DEFAULT 'New Conversation',
      model      VARCHAR(100) DEFAULT 'llama3',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id   (user_id),
      INDEX idx_session_id(session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    /* ── Messages table ── */
    `CREATE TABLE IF NOT EXISTS messages (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      session_id INT          NOT NULL,
      role       ENUM('user','assistant') NOT NULL,
      content    LONGTEXT     NOT NULL,
      model      VARCHAR(100) DEFAULT NULL,
      tokens     INT          DEFAULT NULL,
      created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
      INDEX idx_session_id (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    /* ── Login audit log ── */
    `CREATE TABLE IF NOT EXISTS login_logs (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT          DEFAULT NULL,
      email      VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45)  DEFAULT NULL,
      user_agent TEXT         DEFAULT NULL,
      status     ENUM('success','failed','logout') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_email   (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const sql of queries) {
    try {
      await pool.execute(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`✅  Table ready: ${tableName}`);
    } catch (err) {
      console.error('❌  Migration error:', err.message);
      process.exit(1);
    }
  }

  console.log('\n🎉  All migrations completed successfully!\n');
  process.exit(0);
};

migrate();