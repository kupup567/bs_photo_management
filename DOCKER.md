# Docker & Docker Compose 使用说明 ✅

## 要求 🔧
- Docker Engine / Docker Desktop（Windows）
- Docker Compose（如果未包含在 Docker Desktop 中）

## 文件说明 📁
- `docker-compose.yml` - 定义了服务：`db`（MySQL）、`backend`（Node API）、`frontend`（Vite 构建后由 Nginx 提供）以及可选的 `adminer`（数据库管理界面）
- `backend/Dockerfile` - 后端镜像（基于 Node，包含 libvips 支持 sharp）
- `frontend/Dockerfile` - 前端多阶段构建（Node 构建 -> Nginx 提供静态文件）
- `.env.example` - 环境变量示例
- `image.sql` - 启动时 MySQL 的初始化脚本（创建数据库和表）

## 快速启动 🚀
1. 复制示例 env 文件并根据需要修改：

   cp .env.example .env

   > 在 Windows PowerShell 下：
   > copy .env.example .env

2. 构建并启动容器：

   docker compose up --build -d

3. 访问服务：
- 前端: http://localhost:8080
- 后端 API: http://localhost:3000
- Adminer（可选）: http://localhost:8081 （登录 MySQL: server=db, username=image_user, password=password123）

## 注意事项与建议 🔍
- 初始 MySQL 登录信息在 `docker-compose.yml` 中设置（`MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`），生产环境请替换这些密码。
- 后端会把上传的图片存放在名为 `uploads_data` 的 Docker 卷中，可持久化保存文件。
- 如果需要在开发时热重载后端，可将 `backend` 服务改为使用 `npm run dev` 并挂载本地代码（建议仅用于开发）。

## 常见操作 🛠️
- 查看运行容器： docker ps
- 查看日志： docker compose logs -f backend
- 停止并移除容器： docker compose down -v

---
如需我为 `backend` 加入 Docker Compose 下的开发模式（bind mount + nodemon），或为 Nginx 添加自定义配置，我可以继续实现。