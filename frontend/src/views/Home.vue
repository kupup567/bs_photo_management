<template>
  <div class="home-container">
    <el-card class="welcome-card">
      <template #header>
        <div class="card-header">
          <h2>欢迎使用图片管理系统</h2>
        </div>
      </template>
      
      <div class="welcome-content">
        <el-icon size="64" color="#409EFF"><Picture /></el-icon>
        <h3>开始管理您的图片</h3>
        <p>上传、查看和管理您的所有图片</p>
        
        <div class="action-buttons">
          <el-button type="primary" size="large" @click="$router.push('/upload')">
            <el-icon><Upload /></el-icon>
            上传图片
          </el-button>
          <el-button type="success" size="large" @click="$router.push('/gallery')">
            <el-icon><Picture /></el-icon>
            查看图库
          </el-button>
        </div>
      </div>
    </el-card>
    
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon size="32" color="#409EFF"><Picture /></el-icon>
          <div class="stat-info">
            <div class="stat-number">{{ stats.totalImages || 0 }}</div>
            <div class="stat-label">总图片数</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon size="32" color="#67C23A"><Collection /></el-icon>
          <div class="stat-info">
            <div class="stat-number">{{ stats.totalTags || 0 }}</div>
            <div class="stat-label">总标签数</div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Picture, Upload, Collection } from '@element-plus/icons-vue'

const stats = ref({
  totalImages: 0,
  totalTags: 0
})

const loadStats = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/images?limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      stats.value.totalImages = data.pagination.total
    }
    
    const tagsResponse = await fetch('/api/tags', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (tagsResponse.ok) {
      const tagsData = await tagsResponse.json()
      stats.value.totalTags = tagsData.tags.length
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.home-container {
  max-width: 800px;
  margin: 0 auto;
}

.welcome-card {
  margin-bottom: 20px;
  text-align: center;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0;
  color: #333;
}

.welcome-content {
  padding: 40px 20px;
}

.welcome-content h3 {
  margin: 20px 0 10px 0;
  color: #333;
  font-size: 24px;
}

.welcome-content p {
  margin: 0 0 30px 0;
  color: #666;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  text-align: center;
}

.stat-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 20px;
}

.stat-info {
  text-align: left;
}

.stat-number {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

@media (max-width: 768px) {
  .action-buttons {
    flex-direction: column;
  }
  
  .action-buttons .el-button {
    width: 100%;
  }
  
  .stats-cards {
    grid-template-columns: 1fr;
  }
}
</style>