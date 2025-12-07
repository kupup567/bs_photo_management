const apiyiImageAnalysis = require('./apiyiImageAnalysis');

class AIImageAnalysis {
  constructor() {
    this.service = apiyiImageAnalysis;
  }

  async analyzeImage(imagePath) {
    console.log('开始AI图片分析，使用Apiyi服务...');
    
    try {
      const tags = await this.service.analyzeImage(imagePath);
      
      if (tags && tags.length > 0) {
        console.log('Apiyi分析成功，标签:', tags);
        return tags;
      }
      
      throw new Error('Apiyi分析返回空结果');
      
    } catch (error) {
      console.error('Apiyi分析失败，使用备用方案:', error.message);
      return this.enhancedFallbackAnalysis(imagePath);
    }
  }

  enhancedFallbackAnalysis(imagePath) {
    const filename = require('path').basename(imagePath).toLowerCase();
    const tags = new Set();

    console.log('使用增强备用分析，文件名:', filename);

    const patterns = [
      { test: /dog/, tags: ['狗', '动物', '宠物'] },
      { test: /cat/, tags: ['猫', '动物', '宠物'] },
      { test: /person/, tags: ['人物', '人像'] },
      { test: /landscape/, tags: ['风景', '自然'] },
      { test: /building/, tags: ['建筑'] },
      { test: /food/, tags: ['食物', '美食'] },
      { test: /car/, tags: ['汽车', '交通工具'] },
      { test: /document/, tags: ['文档', '文字'] }
    ];

    patterns.forEach(pattern => {
      if (pattern.test.test(filename)) {
        pattern.tags.forEach(tag => tags.add(tag));
      }
    });

    if (tags.size === 0) {
      tags.add('图片');
    }

    return Array.from(tags);
  }
}

module.exports = new AIImageAnalysis();