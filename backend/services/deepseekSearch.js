// services/deepseekSearch.js
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

/**
 * 调用 DeepSeek，把用户自然语言查询转成若干检索关键词
 * 返回：['海边', '日落', '情侣'] 这种数组
 */
async function getSearchKeywords(naturalQuery) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('缺少环境变量 DEEPSEEK_API_KEY');
  }

  const payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      {
        role: 'system',
        content:
          '你是一个图片检索关键词生成器。' +
          '用户会给你一段关于要查找图片的自然语言描述，' +
          '请提取 3-10 个简短的中文或英文关键词，用于数据库搜索。' +
          '只输出用中文逗号分隔的关键词，不要输出任何解释或多余文本。'
      },
      {
        role: 'user',
        content: naturalQuery
      }
    ],
    temperature: 0.3
  };

  const resp = await axios.post(DEEPSEEK_API_URL, payload, {
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  const content =
    resp.data &&
    resp.data.choices &&
    resp.data.choices[0] &&
    resp.data.choices[0].message &&
    resp.data.choices[0].message.content;

  if (!content) {
    throw new Error('DeepSeek 返回内容为空');
  }

  // 期望格式：keyword1, keyword2, keyword3
  const rawKeywords = content
    .replace(/\n/g, ' ')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  // 去重
  const uniqueKeywords = Array.from(new Set(rawKeywords));

  // 如果模型意外输出了很乱的内容，这里兜底
  if (uniqueKeywords.length === 0) {
    uniqueKeywords.push(naturalQuery.trim());
  }

  return uniqueKeywords;
}

module.exports = {
  getSearchKeywords
};