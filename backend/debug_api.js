const axios = require('axios');
const fs = require('fs');

async function testPrompt(prompt, maxTokens = 50) {
  try {
    const imagePath = 'C:/Users/kongsh/Pictures/Screenshots/jop.png';
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": prompt
            },
            {
              "type": "image_url",
              "image_url": {
                "url": `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      "max_tokens": maxTokens
    };

    console.log(`测试提示词: "${prompt}"`);
    
    const response = await axios.post('https://api.apiyi.com/v1/chat/completions', payload, {
      headers: {
        "Authorization": "sk-neHxY4RUphVtLkTL992b5500E3Ba4191A5C1365b4607Ff52",
        "Content-Type": "application/json"
      }
    });

    const result = response.data.choices[0];
    console.log('响应内容:', result.message.content);
    console.log('结束原因:', result.finish_reason);
    console.log('---');
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

async function runTests() {
  const prompts = [
    "标签",
    "图片标签",
    "狗,动物,宠物",
    "描述图片",
    "这是什么",
    "列出标签"
  ];

  for (const prompt of prompts) {
    await testPrompt(prompt, 30);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
  }
}

runTests();