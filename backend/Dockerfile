# Backend Dockerfile - Node 18 on Debian slim to ensure compatibility with sharp
FROM node:20-slim

# 安装系统依赖以支持 sharp 等原生模块
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  gcc \
  g++ \
  make \
  python3 \
  libvips-dev \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 仅复制 package.json 来利用缓存
COPY package*.json ./

# 安装依赖
RUN npm ci --production

# 复制应用代码
COPY . .

# 创建上传目录（由卷挂载覆盖）
RUN mkdir -p /app/uploads/originals /app/uploads/thumbnails

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
