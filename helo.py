import base64
import requests

def image_to_base64(image_path):
    """将本地图片转换为 base64 编码"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# 读取本地图片
base64_image = image_to_base64("C:/Users/kongsh/Pictures/Screenshots/jop.png")

url = "https://api.apiyi.com/v1/chat/completions"
headers = {
    "Authorization": "sk-neHxY4RUphVtLkTL992b5500E3Ba4191A5C1365b4607Ff52",
    "Content-Type": "application/json"
}

payload = {
    "model": "gemini-2.5-pro",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "分析这张图片是什么动物"
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{base64_image}"
                    }
                }
            ]
        }
    ]
}

response = requests.post(url, headers=headers, json=payload)
print(response.json()['choices'][0]['message']['content'])