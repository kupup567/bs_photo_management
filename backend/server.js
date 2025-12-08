const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const config = require('./config');
const exifr = require('exifr');
const aiImageAnalysis = require('./services/aiImageAnalysis');
const { getSearchKeywords } = require('./services/deepseekSearch');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 创建上传目录
const uploadsDir = path.join(__dirname, 'uploads');
const originalsDir = path.join(uploadsDir, 'originals');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[uploadsDir, originalsDir, thumbnailsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 全局安全 JSON 解析函数
const safeJsonParse = (str, defaultValue = null) => {
  if (str === null || str === undefined) {
    return defaultValue;
  }
  if (typeof str === 'object') {
    return str; // 如果已经是对象，直接返回
  }
  if (typeof str !== 'string') {
    return defaultValue;
  }
  try {
    // 检查是否是无效的字符串表示
    if (str === '[object Object]' || str === 'null' || str === 'undefined') {
      return defaultValue;
    }
    const parsed = JSON.parse(str);
    return parsed;
  } catch (error) {
    console.warn('JSON 解析失败，内容:', str, '错误:', error.message);
    return defaultValue;
  }
};

// 数据库连接池
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(connection => {
    console.log('✅ 数据库连接成功');
    connection.release();
  })
  .catch(error => {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('请检查：');
    console.error('1. MySQL 服务是否启动');
    console.error('2. 数据库配置是否正确');
    console.error('3. 用户名和密码是否正确');
  });

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, originalsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'image-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件！'), false);
    }
  }
});

// 工具函数：生成JWT令牌
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

// 中间件：验证JWT令牌
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '访问被拒绝，没有提供令牌' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const [users] = await pool.execute(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: '令牌无效，用户不存在' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ error: '令牌无效' });
  }
};

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 基本验证
    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    if (username.length < 6) {
      return res.status(400).json({ error: '用户名至少6个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    // 检查用户是否已存在
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: '用户名或邮箱已存在' });
    }

    // 加密密码
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 创建用户
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    // 生成令牌
    const token = generateToken(result.insertId);

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: result.insertId,
        username,
        email
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '请填写用户名和密码' });
    }

    // 查找用户
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = users[0];

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成令牌
    const token = generateToken(user.id);

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// 获取图片列表接口 - 修复标签数据结构
app.get('/api/images', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, search } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE i.user_id = ? AND i.is_deleted = false';
    const queryParams = [userId];

    if (search) {
      whereClause += ' AND i.filename LIKE ?';
      queryParams.push(`%${search}%`);
    }

    // 修改SQL查询，确保获取标签的完整信息
    const sql = `SELECT i.*, 
                    GROUP_CONCAT(DISTINCT t.id) as tag_ids,
                    GROUP_CONCAT(DISTINCT t.name) as tag_names,
                    GROUP_CONCAT(DISTINCT t.type) as tag_types
             FROM images i
             LEFT JOIN image_tags it ON i.id = it.image_id
             LEFT JOIN tags t ON it.tag_id = t.id
             ${whereClause}
             GROUP BY i.id
             ORDER BY i.upload_time DESC
             LIMIT ${limitNum} OFFSET ${offset}`;

    const [images] = await pool.query(sql, queryParams);

    // 获取总数
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM images i ${whereClause}`,
      queryParams
    );

    const formattedImages = images.map(image => {
      // 优先使用编辑后的图片，如果没有则使用原始图片
      const displayUrl = image.edited_path 
        ? `/uploads/originals/${path.basename(image.edited_path)}`
        : `/uploads/originals/${path.basename(image.original_path)}`;
      
      const thumbnailUrl = `/uploads/thumbnails/${path.basename(image.thumbnail_path)}`;

      // 构建标签数组，确保包含 id
      let tags = [];
      if (image.tag_ids && image.tag_names && image.tag_types) {
        const tagIds = image.tag_ids.split(',');
        const tagNames = image.tag_names.split(',');
        const tagTypes = image.tag_types.split(',');
        
        tags = tagIds.map((id, index) => ({
          id: parseInt(id),
          name: tagNames[index] || '',
          type: tagTypes[index] || 'custom'
        })).filter(tag => tag.name); // 过滤掉空标签
      }

      return {
        id: image.id,
        filename: image.filename,
        originalUrl: `/uploads/originals/${path.basename(image.original_path)}`,
        editedUrl: image.edited_path ? `/uploads/originals/${path.basename(image.edited_path)}` : null,
        displayUrl: displayUrl,
        thumbnailUrl: thumbnailUrl,
        fileSize: image.file_size,
        width: image.width,
        height: image.height,
        cameraModel: image.camera_model,
        takenTime: image.taken_time,
        uploadTime: image.upload_time,
        isEdited: !!image.edited_path,
        editOperations: safeJsonParse(image.edit_operations),
        tags: tags
      }
    });

    res.json({
      images: formattedImages,
      pagination: {
        total: countResult[0].total,
        page: pageNum,
        pages: Math.ceil(countResult[0].total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('获取图片列表错误:', error);
    res.status(500).json({ error: '获取图片列表失败' });
  }
});

// 删除图片
app.delete('/api/images/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [result] = await pool.execute(
      'UPDATE images SET is_deleted = true WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '图片不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除图片错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 还原图片到原始版本
app.post('/api/images/:id/revert', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT * FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    const image = images[0];
    
    // 删除编辑后的文件
    if (image.edited_path && fs.existsSync(image.edited_path)) {
      fs.unlinkSync(image.edited_path);
    }

    // 清除数据库中的编辑信息
    await pool.execute(
      'UPDATE images SET edited_path = NULL, edit_operations = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: '还原成功' });
  } catch (error) {
    console.error('还原图片错误:', error);
    res.status(500).json({ error: '还原失败' });
  }
});

// 给图片添加自定义标签 - 修复版本
app.post('/api/images/:id/tags', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { tagName } = req.body;

    if (!tagName || tagName.trim() === '') {
      return res.status(400).json({ error: '标签名不能为空' });
    }

    const trimmedTagName = tagName.trim();

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT id FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    // 查找或创建标签
    let [tags] = await pool.execute(
      'SELECT id, name, type FROM tags WHERE name = ?',
      [trimmedTagName]
    );

    let tagId;
    let tagType;
    if (tags.length === 0) {
      const [result] = await pool.execute(
        'INSERT INTO tags (name, type) VALUES (?, ?)',
        [trimmedTagName, 'custom']
      );
      tagId = result.insertId;
      tagType = 'custom';
    } else {
      tagId = tags[0].id;
      tagType = tags[0].type;
    }

    // 关联图片和标签
    await pool.execute(
      'INSERT IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)',
      [id, tagId]
    );

    res.status(201).json({ 
      message: '标签添加成功',
      tag: {
        id: tagId,
        name: trimmedTagName,
        type: tagType
      }
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({ error: '添加标签失败' });
  }
});

// 从图片移除标签 - 修复版本
app.delete('/api/images/:id/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { id, tagId } = req.params;
    const userId = req.user.id;

    console.log('移除标签请求:', { id, tagId, userId });

    // 验证参数有效性
    if (!id || !tagId || isNaN(parseInt(id)) || isNaN(parseInt(tagId))) {
      return res.status(400).json({ error: '无效的参数' });
    }

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT id FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [parseInt(id), userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    // 验证标签是否存在
    const [tags] = await pool.execute(
      'SELECT id FROM tags WHERE id = ?',
      [parseInt(tagId)]
    );

    if (tags.length === 0) {
      return res.status(404).json({ error: '标签不存在' });
    }

    // 移除标签关联
    const [result] = await pool.execute(
      'DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?',
      [parseInt(id), parseInt(tagId)]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '图片和标签的关联不存在' });
    }

    res.json({ message: '标签移除成功' });
  } catch (error) {
    console.error('移除标签错误:', error);
    res.status(500).json({ error: '移除标签失败' });
  }
});

// 获取所有可用标签 - 确保去重
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const [tags] = await pool.execute(
      'SELECT DISTINCT id, name, type FROM tags ORDER BY type, name'
    );

    res.json({ tags });
  } catch (error) {
    console.error('获取标签错误:', error);
    res.status(500).json({ error: '获取标签失败' });
  }
});

// 增强的时间标签生成函数
function generateTimeBasedTags(dateTime) {
  const tags = [];
  
  if (!dateTime) return tags;
  
  try {
    const date = new Date(dateTime);
    const hour = date.getHours();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    // 一天中的时间段
    if (hour >= 5 && hour < 8) {
      tags.push('清晨');
    } else if (hour >= 8 && hour < 12) {
      tags.push('上午');
    } else if (hour >= 12 && hour < 14) {
      tags.push('中午');
    } else if (hour >= 14 && hour < 18) {
      tags.push('下午');
    } else if (hour >= 18 && hour < 22) {
      tags.push('傍晚');
    } else {
      tags.push('夜晚');
    }
    
    // 季节
    if (month >= 3 && month <= 5) {
      tags.push('春天', '春季');
    } else if (month >= 6 && month <= 8) {
      tags.push('夏天', '夏季');
    } else if (month >= 9 && month <= 11) {
      tags.push('秋天', '秋季');
    } else {
      tags.push('冬天', '冬季');
    }
    
    // 月份
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                       '七月', '八月', '九月', '十月', '十一月', '十二月'];
    tags.push(monthNames[month - 1]);
    
    // 年份
    tags.push(`${year}年`);
    
  } catch (error) {
    console.error('生成时间标签错误:', error);
  }
  
  return tags;
}

// 修改智能标签生成函数
async function generateSmartTags(metadata, exifData) {
  const tags = new Set();

  // 基础图片属性标签
  const aspectRatio = metadata.width / metadata.height;
  if (aspectRatio > 1.3) {
    tags.add('横图');
  } else if (aspectRatio < 0.7) {
    tags.add('竖图');
  } else {
    tags.add('方形');
  }

  // EXIF信息标签
  if (exifData) {
    // 焦距标签

    // 时间相关标签
    if (exifData.DateTimeOriginal) {
      const timeTags = generateTimeBasedTags(exifData.DateTimeOriginal);
      timeTags.forEach(tag => tags.add(tag));
    }
  }

  return Array.from(tags);
}

// 在文件上传处理部分添加EXIF信息提取
app.post('/api/images/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有选择文件' });
    }

    const userId = req.user.id;
    const file = req.file;

    // 生成缩略图
    const thumbFilename = 'thumb-' + path.basename(file.filename);
    const thumbnailPath = path.join(thumbnailsDir, thumbFilename);

    // 获取图片元数据并生成缩略图
    const metadata = await sharp(file.path).metadata();
    
    await sharp(file.path)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(thumbnailPath);

    // 提取EXIF信息
    let exifData = {};
    try {
      exifData = await exifr.parse(file.path);
    } catch (exifError) {
      console.warn('EXIF解析失败:', exifError.message);
    }

    // AI图片分析生成标签
    console.log('调用AI分析服务...');
    const aiTags = await aiImageAnalysis.analyzeImage(file.path);
    console.log('AI生成的标签:', aiTags);

    // 保存到数据库（包含EXIF信息）
    const [result] = await pool.execute(
      `INSERT INTO images (
        user_id, filename, original_path, thumbnail_path, file_size, 
        width, height, mime_type, camera_model, taken_time,
        exposure_time, f_number, iso_speed, focal_length, lens_model,
        gps_latitude, gps_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        file.originalname,
        file.path,
        thumbnailPath,
        file.size,
        metadata.width,
        metadata.height,
        file.mimetype,
        exifData.Model || null,
        exifData.DateTimeOriginal ? new Date(exifData.DateTimeOriginal) : null,
        exifData.ExposureTime || null,
        exifData.FNumber || null,
        exifData.ISO || null,
        exifData.FocalLength || null,
        exifData.LensModel || null,
        exifData.latitude || null,
        exifData.longitude || null
      ]
    );

    // 智能标签生成
    const smartTags = await generateSmartTags(metadata, exifData);

    // 合并标签
    const allTags = [...smartTags, ...aiTags];
    const uniqueTags = [...new Set(allTags)];

    // 添加标签到数据库
    for (const tagName of uniqueTags) {
      const [tags] = await pool.execute(
        'SELECT id FROM tags WHERE name = ?',
        [tagName]
      );

      let tagId;
      if (tags.length === 0) {
        const [newTag] = await pool.execute(
          'INSERT INTO tags (name, type) VALUES (?, ?)',
          [tagName, 'ai']
        );
        tagId = newTag.insertId;
      } else {
        tagId = tags[0].id;
      }

      await pool.execute(
        'INSERT IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)',
        [result.insertId, tagId]
      );
    }

    res.status(201).json({
      message: '上传成功',
      image: {
        id: result.insertId,
        filename: file.originalname,
        thumbnailUrl: `/uploads/thumbnails/${thumbFilename}`,
        width: metadata.width,
        height: metadata.height,
        exif: exifData,
        tags: uniqueTags
      }
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    
    // 清理上传的文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: '上传失败: ' + error.message });
  }
});

// 图片编辑接口 - 修复版本
app.post('/api/images/:id/edit', authenticateToken, async (req, res) => {
  let editedPath = null; // 提前声明并初始化
  
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { operations } = req.body;

    console.log('图片编辑请求:', { id, userId, operations });

    // 验证请求体
    if (!operations || typeof operations !== 'object') {
      return res.status(400).json({ error: '缺少有效的编辑操作' });
    }

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT * FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    const image = images[0];
    
    // 检查原始文件是否存在
    if (!fs.existsSync(image.original_path)) {
      return res.status(404).json({ error: '原始图片文件不存在' });
    }

    // 创建编辑后的文件路径
    const timestamp = Date.now();
    const fileExt = path.extname(image.original_path);
    const editedFilename = `edited-${timestamp}-${path.basename(image.original_path, fileExt)}${fileExt}`;
    editedPath = path.join(originalsDir, editedFilename);

    console.log('开始图片编辑处理...');

    let sharpInstance = sharp(image.original_path);

    // 应用裁剪
    if (operations.crop && operations.crop.width > 0 && operations.crop.height > 0) {
      console.log('应用裁剪:', operations.crop);
      const { x, y, width, height } = operations.crop;
      
      // 验证裁剪参数有效性
      if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        return res.status(400).json({ error: '裁剪参数无效' });
      }
      
      sharpInstance = sharpInstance.extract({ 
        left: Math.max(0, Math.round(x)), 
        top: Math.max(0, Math.round(y)), 
        width: Math.max(1, Math.round(width)), 
        height: Math.max(1, Math.round(height)) 
      });
    }

    // 应用旋转
    if (operations.rotate && operations.rotate !== 0) {
      console.log('应用旋转:', operations.rotate);
      sharpInstance = sharpInstance.rotate(operations.rotate);
    }

    // 应用滤镜
    if (operations.filters) {
      console.log('应用滤镜:', operations.filters);
      const { brightness, contrast, saturation } = operations.filters;
      
      // 验证滤镜参数范围
      if (brightness && (brightness < 0.1 || brightness > 3)) {
        return res.status(400).json({ error: '亮度参数超出范围 (0.1-3)' });
      }
      if (contrast && (contrast < 0.1 || contrast > 3)) {
        return res.status(400).json({ error: '对比度参数超出范围 (0.1-3)' });
      }
      if (saturation && (saturation < 0 || saturation > 3)) {
        return res.status(400).json({ error: '饱和度参数超出范围 (0-3)' });
      }
      
      if (brightness && brightness !== 1) {
        sharpInstance = sharpInstance.modulate({ brightness: parseFloat(brightness) });
      }
      if (contrast && contrast !== 1) {
        sharpInstance = sharpInstance.linear(parseFloat(contrast));
      }
      if (saturation && saturation !== 1) {
        sharpInstance = sharpInstance.modulate({ saturation: parseFloat(saturation) });
      }
    }

    // 保存编辑后的图片
    console.log('保存编辑后的图片到:', editedPath);
    await sharpInstance.jpeg({ quality: 90 }).toFile(editedPath);

    // 更新数据库
    console.log('更新数据库记录...');
    await pool.execute(
      'UPDATE images SET edited_path = ?, edit_operations = ? WHERE id = ?',
      [editedPath, JSON.stringify(operations), id]
    );

    console.log('图片编辑完成');

    res.json({
      message: '编辑成功',
      editedUrl: `/uploads/originals/${editedFilename}`,
      operations: operations
    });

  } catch (error) {
    console.error('图片编辑错误:', error);
    
    // 清理可能创建的不完整文件
    if (editedPath && fs.existsSync(editedPath)) {
      try {
        fs.unlinkSync(editedPath);
        console.log('已清理未完成的编辑文件:', editedPath);
      } catch (cleanupError) {
        console.error('清理文件失败:', cleanupError);
      }
    }
    
    // 提供更详细的错误信息
    let errorMessage = '编辑失败';
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = '数据库字段错误，请联系管理员';
    } else if (error.message.includes('Input file is missing')) {
      errorMessage = '原始图片文件不存在';
    } else if (error.message.includes('extract')) {
      errorMessage = '裁剪参数无效或超出图片范围';
    }
    
    res.status(500).json({ 
      error: errorMessage, 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// 获取轮播配置接口 - 修改为显示编辑后的图片
app.get('/api/carousel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [configs] = await pool.execute(
      'SELECT * FROM carousel_configs WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    // 用于存储格式化后的轮播配置
    const formattedConfigs = [];

    for (const config of configs) {
      let imageIds = [];
      try {
        // 尝试解析 images 字段
        if (config.images && typeof config.images === 'string') {
          imageIds = JSON.parse(config.images);
        } else if (Array.isArray(config.images)) {
          imageIds = config.images;
        }
      } catch (error) {
        console.error(`解析轮播配置 ${config.id} 的 images 字段失败:`, error);
        imageIds = [];
      }

      // 如果轮播配置中没有图片，直接返回空数组
      if (imageIds.length === 0) {
        formattedConfigs.push({
          ...config,
          images: []  // 图片信息数组为空
        });
        continue;
      }

      // 构建查询图片的SQL，使用IN查询
      const placeholders = imageIds.map(() => '?').join(',');
      const [images] = await pool.execute(
        `SELECT id, filename, original_path, edited_path, thumbnail_path 
         FROM images 
         WHERE id IN (${placeholders}) AND is_deleted = false`,
        imageIds
      );

      // 将图片信息按照imageIds的顺序排序，并构建图片URL
      const imageMap = new Map();
      images.forEach(img => {
        // 优先使用编辑后的图片，如果没有则使用原始图片
        const displayUrl = img.edited_path 
          ? `/uploads/originals/${path.basename(img.edited_path)}`
          : `/uploads/originals/${path.basename(img.original_path)}`;
        
        const thumbnailUrl = `/uploads/thumbnails/${path.basename(img.thumbnail_path)}`;
        
        imageMap.set(img.id, {
          id: img.id,
          filename: img.filename,
          displayUrl: displayUrl,
          thumbnailUrl: thumbnailUrl,
          isEdited: !!img.edited_path
        });
      });

      // 按照imageIds的顺序构建图片列表
      const imageList = [];
      for (const id of imageIds) {
        if (imageMap.has(id)) {
          imageList.push(imageMap.get(id));
        }
      }

      formattedConfigs.push({
        ...config,
        images: imageList
      });
    }

    res.json({ configs: formattedConfigs });
  } catch (error) {
    console.error('获取轮播配置错误:', error);
    res.status(500).json({ error: '获取轮播配置失败' });
  }
});

// 创建轮播配置 - 保持不变，但确保返回正确的图片信息
app.post('/api/carousel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, imageIds, intervalSeconds = 5 } = req.body;

    console.log('创建轮播配置，接收的数据:', { name, imageIds, intervalSeconds });

    // 确保 imageIds 是数组且有效
    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds 必须是数组' });
    }

    const validImageIds = imageIds.filter(id => Number.isInteger(id) && id > 0);
    
    if (validImageIds.length === 0) {
      return res.status(400).json({ error: '请选择有效的图片' });
    }

    const imagesJson = JSON.stringify(validImageIds);
    console.log('要存储的 JSON:', imagesJson);

    const [result] = await pool.execute(
      'INSERT INTO carousel_configs (user_id, name, images, interval_seconds) VALUES (?, ?, ?, ?)',
      [userId, name, imagesJson, intervalSeconds]
    );

    // 获取新创建的轮播配置的完整信息（包括图片详情）
    const [newConfigs] = await pool.execute(
      'SELECT * FROM carousel_configs WHERE id = ?',
      [result.insertId]
    );

    const newConfig = newConfigs[0];
    let imageList = [];
    
    try {
      const parsedImageIds = JSON.parse(newConfig.images);
      if (parsedImageIds.length > 0) {
        const placeholders = parsedImageIds.map(() => '?').join(',');
        const [images] = await pool.execute(
          `SELECT id, filename, original_path, edited_path, thumbnail_path 
           FROM images 
           WHERE id IN (${placeholders}) AND is_deleted = false`,
          parsedImageIds
        );

        // 构建图片信息
        imageList = images.map(img => ({
          id: img.id,
          filename: img.filename,
          displayUrl: img.edited_path 
            ? `/uploads/originals/${path.basename(img.edited_path)}`
            : `/uploads/originals/${path.basename(img.original_path)}`,
          thumbnailUrl: `/uploads/thumbnails/${path.basename(img.thumbnail_path)}`,
          isEdited: !!img.edited_path
        }));
      }
    } catch (parseError) {
      console.error('解析轮播图片ID失败:', parseError);
    }

    res.status(201).json({
      message: '轮播配置创建成功',
      config: { 
        ...newConfig,
        images: imageList
      }
    });
  } catch (error) {
    console.error('创建轮播配置错误:', error);
    res.status(500).json({ error: '创建轮播配置失败' });
  }
});

// 更新轮播配置 - 修改为返回完整的图片信息
app.put('/api/carousel/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, imageIds, intervalSeconds } = req.body;

    console.log('更新轮播配置，接收的数据:', { id, name, imageIds, intervalSeconds });

    // 检查权限
    const [configs] = await pool.execute(
      'SELECT * FROM carousel_configs WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (configs.length === 0) {
      return res.status(404).json({ error: '轮播配置不存在' });
    }

    // 确保 imageIds 是数组且有效
    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ error: 'imageIds 必须是数组' });
    }

    const validImageIds = imageIds.filter(id => Number.isInteger(id) && id > 0);
    const imagesJson = JSON.stringify(validImageIds);

    await pool.execute(
      'UPDATE carousel_configs SET name = ?, images = ?, interval_seconds = ? WHERE id = ?',
      [name, imagesJson, intervalSeconds, id]
    );

    // 获取更新后的完整配置信息
    const [updatedConfigs] = await pool.execute(
      'SELECT * FROM carousel_configs WHERE id = ?',
      [id]
    );

    const updatedConfig = updatedConfigs[0];
    let imageList = [];
    
    try {
      const parsedImageIds = JSON.parse(updatedConfig.images);
      if (parsedImageIds.length > 0) {
        const placeholders = parsedImageIds.map(() => '?').join(',');
        const [images] = await pool.execute(
          `SELECT id, filename, original_path, edited_path, thumbnail_path 
           FROM images 
           WHERE id IN (${placeholders}) AND is_deleted = false`,
          parsedImageIds
        );

        // 构建图片信息
        imageList = images.map(img => ({
          id: img.id,
          filename: img.filename,
          displayUrl: img.edited_path 
            ? `/uploads/originals/${path.basename(img.edited_path)}`
            : `/uploads/originals/${path.basename(img.original_path)}`,
          thumbnailUrl: `/uploads/thumbnails/${path.basename(img.thumbnail_path)}`,
          isEdited: !!img.edited_path
        }));
      }
    } catch (parseError) {
      console.error('解析轮播图片ID失败:', parseError);
    }

    res.json({ 
      message: '轮播配置更新成功',
      config: {
        ...updatedConfig,
        images: imageList
      }
    });
  } catch (error) {
    console.error('更新轮播配置错误:', error);
    res.status(500).json({ error: '更新轮播配置失败' });
  }
});

// 删除轮播配置
app.delete('/api/carousel/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查权限
    const [configs] = await pool.execute(
      'SELECT * FROM carousel_configs WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (configs.length === 0) {
      return res.status(404).json({ error: '轮播配置不存在' });
    }

    await pool.execute('DELETE FROM carousel_configs WHERE id = ?', [id]);

    res.json({ message: '轮播配置删除成功' });
  } catch (error) {
    console.error('删除轮播配置错误:', error);
    res.status(500).json({ error: '删除轮播配置失败' });
  }
});

// 修改图片名称接口
app.put('/api/images/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { filename } = req.body;

    console.log('修改图片名称请求:', { id, userId, filename });

    if (!filename || filename.trim() === '') {
      return res.status(400).json({ error: '文件名不能为空' });
    }

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT * FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    // 检查文件名是否已存在（排除当前图片）
    const [existingImages] = await pool.execute(
      'SELECT id FROM images WHERE filename = ? AND user_id = ? AND id != ? AND is_deleted = false',
      [filename, userId, id]
    );

    if (existingImages.length > 0) {
      return res.status(409).json({ error: '文件名已存在' });
    }

    // 更新文件名
    await pool.execute(
      'UPDATE images SET filename = ? WHERE id = ?',
      [filename, id]
    );

    res.json({ 
      message: '修改成功',
      newFilename: filename
    });
  } catch (error) {
    console.error('修改图片名称错误:', error);
    res.status(500).json({ error: '修改失败' });
  }
});

app.post('/api/images/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('收到AI分析请求，图片ID:', id, '用户ID:', userId);

    // 验证图片所有权
    const [images] = await pool.execute(
      'SELECT * FROM images WHERE id = ? AND user_id = ? AND is_deleted = false',
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在或无权访问' });
    }

    const image = images[0];
    console.log('开始分析图片:', image.filename);

    // 调用AI分析服务
    const aiTags = await aiImageAnalysis.analyzeImage(image.original_path);

    console.log('AI分析完成，生成的标签:', aiTags);

    // 添加AI生成的标签到数据库
    const addedTags = [];
    for (const tagName of aiTags) {
      // 查找或创建标签
      const [existingTags] = await pool.execute(
        'SELECT id FROM tags WHERE name = ?',
        [tagName]
      );

      let tagId;
      if (existingTags.length === 0) {
        const [newTag] = await pool.execute(
          'INSERT INTO tags (name, type) VALUES (?, ?)',
          [tagName, 'ai']
        );
        tagId = newTag.insertId;
      } else {
        tagId = existingTags[0].id;
      }

      // 修复：使用正确的查询检查关联是否存在
      const [existingRelations] = await pool.execute(
        'SELECT image_id, tag_id FROM image_tags WHERE image_id = ? AND tag_id = ?',
        [id, tagId]
      );

      if (existingRelations.length === 0) {
        // 插入关联
        await pool.execute(
          'INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)',
          [id, tagId]
        );
        addedTags.push(tagName);
        console.log(`添加标签: ${tagName}`);
      } else {
        console.log(`标签已存在: ${tagName}`);
      }
    }

    res.json({
      message: 'AI分析完成',
      tags: aiTags,
      addedTags: addedTags,
      total: addedTags.length
    });

  } catch (error) {
    console.error('AI分析错误:', error);
    res.status(500).json({ 
      error: 'AI分析失败',
      details: error.message 
    });
  }
});

// 获取图片的EXIF信息 - 修复版本
app.get('/api/images/:id/exif', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [images] = await pool.execute(
      `SELECT 
        camera_model, taken_time, exposure_time, f_number, 
        iso_speed, focal_length, lens_model, gps_latitude, gps_longitude 
       FROM images WHERE id = ? AND user_id = ? AND is_deleted = false`,
      [id, userId]
    );

    if (images.length === 0) {
      return res.status(404).json({ error: '图片不存在' });
    }

    const exifData = images[0];
    
    // 确保返回的数据格式正确
    const formattedExif = {
      camera_model: exifData.camera_model || null,
      taken_time: exifData.taken_time ? new Date(exifData.taken_time).toISOString() : null,
      exposure_time: exifData.exposure_time || null,
      f_number: exifData.f_number || null,
      iso_speed: exifData.iso_speed || null,
      focal_length: exifData.focal_length || null,
      lens_model: exifData.lens_model || null,
      gps_latitude: exifData.gps_latitude || null,
      gps_longitude: exifData.gps_longitude || null
    };

    res.json({ exif: formattedExif });
  } catch (error) {
    console.error('获取EXIF信息错误:', error);
    res.status(500).json({ error: '获取EXIF信息失败' });
  }
});

// 基于 DeepSeek 的智能图片搜索接口 - 简化版本
app.post('/api/ai-image-search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, page = 1, limit = 20 } = req.body || {};

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'query 不能为空' });
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    // 1. 调用 DeepSeek，把自然语言转换成检索关键词
    const keywords = await getSearchKeywords(query.trim());
    console.log('AI 搜图关键词:', keywords);

    // 2. 构造 SQL 查询 - 直接GROUP BY代替DISTINCT
    let whereClause = 'WHERE i.user_id = ? AND i.is_deleted = false';
    const params = [userId];

    if (keywords.length > 0) {
      const likeClauses = [];
      
      keywords.forEach(kw => {
        const likeVal = `%${kw}%`;
        // 搜索文件名和标签名
        likeClauses.push('(i.filename LIKE ? OR t.name LIKE ?)');
        params.push(likeVal, likeVal);
      });

      whereClause += ' AND (' + likeClauses.join(' OR ') + ')';
    }

    // 3. 获取总数量
    const countSql = `
      SELECT COUNT(DISTINCT i.id) as total
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      ${whereClause}
    `;

    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // 4. 获取分页数据 - 使用GROUP BY
    const sql = `
      SELECT 
        i.id,
        i.filename,
        i.original_path,
        i.edited_path,
        i.thumbnail_path,
        i.upload_time,
        GROUP_CONCAT(DISTINCT t.name) as tag_names
      FROM images i
      LEFT JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN tags t ON it.tag_id = t.id
      ${whereClause}
      GROUP BY i.id, i.filename, i.original_path, i.edited_path, i.thumbnail_path, i.upload_time
      ORDER BY i.upload_time DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, limitNum, offset];
    const [rows] = await pool.query(sql, queryParams);

    // 5. 处理结果
    const images = rows.map(row => {
      const displayUrl = row.edited_path 
        ? `/uploads/originals/${path.basename(row.edited_path)}`
        : `/uploads/originals/${path.basename(row.original_path)}`;
      
      const thumbnailUrl = row.thumbnail_path
        ? `/uploads/thumbnails/${path.basename(row.thumbnail_path)}`
        : null;

      // 处理标签
      const tags = row.tag_names ? row.tag_names.split(',').filter(name => name) : [];

      return {
        id: row.id,
        filename: row.filename,
        tags: tags,
        displayUrl: displayUrl,
        thumbnailUrl: thumbnailUrl,
        uploadTime: row.upload_time
      };
    });

    res.json({
      query,
      keywords,
      images: images,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('AI 图片搜索错误:', error);
    res.status(500).json({ 
      error: 'AI 图片搜索失败', 
      details: error.message 
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Image Manager API'
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制' });
    }
  }
  
  console.error('服务器错误:', error);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动服务器
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 环境: ${config.server.env}`);
  console.log(`💾 数据库: ${config.database.database}`);
  console.log(`📁 上传目录: ${config.upload.path}`);
});

// 打印已定义的路由
console.log('已定义的路由:');
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // 路由中间件
    const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
    console.log(`${methods} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // 路由器中间件
    if (middleware.handle.stack) {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(',').toUpperCase();
          console.log(`${methods} ${handler.route.path}`);
        }
      });
    }
  }
});