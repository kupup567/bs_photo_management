require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'image_user',
    password: process.env.DB_PASSWORD || 'password123',
    database: process.env.DB_NAME || 'image_manager',
    // 添加连接配置
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: '7d'
  },
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 16 * 1024 * 1024
  }
};