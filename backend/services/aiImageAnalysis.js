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
      // 直接调用apiyi的备用分析，而不是重复定义
      return this.service.enhancedFallbackAnalysis(imagePath);
    }
  }
}

module.exports = new AIImageAnalysis();