<template>
  <div id="app">
    <el-container class="layout-container" v-if="isLoggedIn">
      <el-header class="header">
        <div class="header-content">
          <h1 class="logo">📷 图片管理系统</h1>
          <el-menu
            :default-active="$route.path"
            mode="horizontal"
            router
            class="nav-menu"
          >
            <el-menu-item index="/">
              <el-icon><House /></el-icon>
              首页
            </el-menu-item>
            <el-menu-item index="/upload">
              <el-icon><Upload /></el-icon>
              上传
            </el-menu-item>
            <el-menu-item index="/gallery">
              <el-icon><Picture /></el-icon>
              图库
            </el-menu-item>
            <el-menu-item index="/carousel">
              <el-icon><VideoPlay /></el-icon>
              轮播展示
            </el-menu-item>
            <el-menu-item index="/ai-search">
              <el-icon><MagicStick /></el-icon>
              AI搜索
            </el-menu-item>
          </el-menu>
          <div class="user-info">
            <span>欢迎，{{ userInfo?.username }}</span>
            <el-button type="text" @click="logout" class="logout-btn">
              <el-icon><SwitchButton /></el-icon>
              退出
            </el-button>
          </div>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
    
    <router-view v-else />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { House, Upload, Picture, SwitchButton, Search, MagicStick } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const isLoggedIn = computed(() => {
  const token = localStorage.getItem('token')
  return token && route.path !== '/login' && route.path !== '/register'
})

const userInfo = computed(() => {
  const user = localStorage.getItem('userInfo')
  return user ? JSON.parse(user) : null
})

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('userInfo')
  ElMessage.success('已退出登录')
  router.push('/login')
}

onMounted(() => {
  if (!isLoggedIn.value && route.path !== '/login' && route.path !== '/register') {
    router.push('/login')
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f7fa;
}

.layout-container {
  height: 100vh;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.logo {
  margin: 0;
  color: #409EFF;
  font-size: 24px;
  font-weight: 600;
}

.nav-menu {
  flex: 1;
  justify-content: center;
  border: none;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #666;
}

.logout-btn {
  color: #f56c6c;
}

.main-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    height: auto;
    padding: 10px;
  }
  
  .logo {
    margin-bottom: 10px;
  }
  
  .nav-menu {
    width: 100%;
    margin-bottom: 10px;
  }
  
  .user-info {
    width: 100%;
    justify-content: flex-end;
  }
  
  .main-content {
    padding: 10px;
  }
}
</style>