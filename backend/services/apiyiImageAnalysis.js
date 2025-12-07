const axios = require('axios');
const fs = require('fs');

class ApiyiImageAnalysis {
  constructor() {
    this.apiKey = process.env.APIYI_API_KEY || "sk-neHxY4RUphVtLkTL992b5500E3Ba4191A5C1365b4607Ff52";
    this.apiUrl = "https://api.apiyi.com/v1/chat/completions";
  }

  async analyzeImage(imagePath) {
    try {
      console.log('使用Apiyi分析图片:', imagePath);
      
      // 读取图片并转换为base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      // 获取图片MIME类型
      const mimeType = this.getMimeType(imagePath);

      const payload = {
        "model": "gpt-4o-mini",
        "messages": [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": "分析这张图片的内容，只需要输出图片中最主题最朱亚东内容，用逗号分隔输出2-4个中文标签，不要其他文字。例如：风景,人物,动物,宠物,棕色,室内"
              },
              {
                "type": "image_url",
                "image_url": {
                  "url": `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        "max_tokens": 50,
        "temperature": 0.1
      };

      console.log('发送Apiyi请求...');
      
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          "Authorization": this.apiKey,
          "Content-Type": "application/json"
        },
        timeout: 30000
      });

      console.log('Apiyi完整响应:', JSON.stringify(response.data, null, 2));
      
      if (response.data.choices && response.data.choices[0]) {
        const analysisResult = response.data.choices[0].message.content;
        console.log('Apiyi原始响应:', analysisResult);

        const tags = this.parseTags(analysisResult);
        console.log('解析后的标签:', tags);

        return tags;
      } else {
        console.error('Apiyi响应格式异常');
        throw new Error('API响应格式异常');
      }

    } catch (error) {
      console.error('Apiyi分析失败:', error.response?.data || error.message);
      return this.enhancedFallbackAnalysis(imagePath);
    }
  }

  getMimeType(imagePath) {
    const ext = imagePath.split('.').pop().toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  parseTags(text) {
    console.log('开始解析Apiyi响应:', text);
    
    // 如果响应为空，直接返回空数组
    if (!text || text.trim() === '') {
      console.log('API响应为空');
      return [];
    }

    const tags = new Set();
    
    // 方法1: 直接按逗号分割
    const commaSeparated = text.trim();
    const potentialTags = commaSeparated.split(/[，,]/);
    
    potentialTags.forEach(tag => {
      const cleanTag = tag.trim()
        .replace(/[。.!?？\s]$/, '')
        .replace(/^["']|["']$/g, '');
      
      if (this.isValidTag(cleanTag)) {
        tags.add(cleanTag);
      }
    });

    // 方法2: 如果方法1没提取到，尝试提取中文词语
    if (tags.size === 0) {
      const chineseWords = text.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      chineseWords.forEach(word => {
        if (this.isValidTag(word)) {
          tags.add(word);
        }
      });
    }

    console.log('最终提取的标签:', Array.from(tags));
    return Array.from(tags).slice(0, 8);
  }

  isValidTag(tag) {
    if (!tag || tag.length < 2 || tag.length > 6) return false;
    
    const invalidPatterns = [
      '图片', '照片', '图像', '这是', '包含', '可以看到', '主要有', '包括',
      '元素', '场景', '对象', '颜色', '氛围', '适合', '标签', '关键词',
      '详细', '分析', '识别', '给出', '输出', '不要', '直接', '作为',
      '请', '要求', '使用', '中文', '具体', '明确', '逗号', '分隔',
      '根据', '观察', '发现', '显示', '呈现', '应该', '可以', '需要',
      '例如', '比如', '可能', '一定', '非常', '特别'
    ];

    return !invalidPatterns.some(pattern => tag.includes(pattern));
  }

  enhancedFallbackAnalysis(imagePath) {
    const filename = require('path').basename(imagePath).toLowerCase();
    const tags = new Set();

    console.log('使用增强备用分析，文件名:', filename);

    // 详细的文件名模式匹配
    const patterns = [
      // 动物
      { test: /(dog|puppy| canine)/, tags: ['狗', '动物', '宠物', '犬类'] },
      { test: /(cat|kitten|feline)/, tags: ['猫', '动物', '宠物', '猫咪'] },
      { test: /(bird|avian)/, tags: ['鸟类', '动物', '飞禽'] },
      { test: /(fish|aquatic)/, tags: ['鱼类', '动物', '水生动物'] },
      
      // 人物
      { test: /(person|people|man|woman|human)/, tags: ['人物', '人像', '人类'] },
      { test: /(child|baby|kid)/, tags: ['儿童', '小孩', '婴儿'] },
      { test: /(family)/, tags: ['家庭', '亲情', '家人'] },
      { test: /(portrait)/, tags: ['肖像', '人像', '面部'] },
      
      // 风景
      { test: /(landscape|scenery|view)/, tags: ['风景', '自然', '景观'] },
      { test: /(mountain|hill)/, tags: ['山脉', '山景', '山峰'] },
      { test: /(forest|wood)/, tags: ['森林', '树木', '林木'] },
      { test: /(beach|coast|sea)/, tags: ['海滩', '海洋', '海岸'] },
      { test: /(sunset|sunrise)/, tags: ['日落', '日出', '黄昏'] },
      
      // 建筑
      { test: /(building|architecture)/, tags: ['建筑', '建筑物'] },
      { test: /(city|urban)/, tags: ['城市', '都市', '城区'] },
      { test: /(house|home)/, tags: ['房屋', '住宅', '房子'] },
      { test: /(bridge)/, tags: ['桥梁', '桥'] },
      
      // 其他
      { test: /(food|meal|dish)/, tags: ['食物', '美食', '餐饮'] },
      { test: /(car|vehicle|auto)/, tags: ['汽车', '车辆', '交通工具'] },
      { test: /(document|certificate|award)/, tags: ['文档', '证书', '奖状'] },
      { test: /(text|word)/, tags: ['文字', '文本'] }
    ];

    patterns.forEach(pattern => {
      if (pattern.test.test(filename)) {
        pattern.tags.forEach(tag => tags.add(tag));
      }
    });

    // 如果还是没识别到，使用通用标签
    if (tags.size === 0) {
      tags.add('图片');
    }

    console.log('备用分析结果:', Array.from(tags));
    return Array.from(tags);
  }
}

module.exports = new ApiyiImageAnalysis();