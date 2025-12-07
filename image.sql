-- database.sql
CREATE DATABASE IF NOT EXISTS image_manager;
USE image_manager;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 图片表（增强版）
CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    width INT,
    height INT,
    mime_type VARCHAR(100),
    camera_model VARCHAR(255),
    taken_time DATETIME,
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    -- EXIF 信息字段
    exposure_time VARCHAR(50),
    f_number VARCHAR(50),
    iso_speed VARCHAR(50),
    focal_length VARCHAR(50),
    lens_model VARCHAR(255),
    gps_latitude DECIMAL(10, 8),
    gps_longitude DECIMAL(10, 8),
    location_name VARCHAR(255),
    -- 编辑信息字段
    edited_path VARCHAR(500),
    edit_operations JSON,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('exif', 'custom', 'ai') DEFAULT 'custom',
    color VARCHAR(7) DEFAULT '#409EFF'
);

-- 图片标签关联表
CREATE TABLE IF NOT EXISTS image_tags (
    image_id INT,
    tag_id INT,
    PRIMARY KEY (image_id, tag_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 轮播配置表
CREATE TABLE IF NOT EXISTS carousel_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    images JSON NOT NULL, -- 存储图片ID数组
    interval_seconds INT DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 插入一些示例标签
INSERT IGNORE INTO tags (name, type, color) VALUES
('横图', 'exif', '#67C23A'),
('竖图', 'exif', '#67C23A'),
('4K', 'exif', '#E6A23C'),
('高清', 'exif', '#E6A23C'),
('人像', 'ai', '#F56C6C'),
('风景', 'ai', '#409EFF'),
('建筑', 'ai', '#909399'),
('夜景', 'ai', '#673AB7'),
('微距', 'ai', '#9C27B0');