<template>
  <div class="carousel-container">
    <el-card>
      <template #header>
        <div class="carousel-header">
          <h2>轮播展示</h2>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建轮播
          </el-button>
        </div>
      </template>

      <!-- 轮播配置列表 -->
      <div v-if="carouselConfigs.length > 0" class="config-list">
        <div v-for="config in carouselConfigs" :key="config.id" class="config-item">
          <div class="config-info">
            <h3>{{ config.name }}</h3>
            <div class="config-meta">
              <span>图片数量: {{ config.images.length }}</span>
              <span>切换间隔: {{ config.interval_seconds }}秒</span>
              <span>创建时间: {{ formatDate(config.created_at) }}</span>
            </div>
          </div>
          <div class="config-actions">
            <el-button type="primary" @click="previewCarousel(config)">
              <el-icon><View /></el-icon>
              预览
            </el-button>
            <el-button @click="editConfig(config)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" @click="deleteConfig(config.id)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <el-empty description="暂无轮播配置">
          <el-button type="primary" @click="showCreateDialog = true">
            创建第一个轮播
          </el-button>
        </el-empty>
      </div>
    </el-card>

    <!-- 创建/编辑轮播对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingConfig ? '编辑轮播' : '新建轮播'"
      width="600px"
    >
      <el-form :model="configForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="configForm.name" placeholder="请输入轮播名称" />
        </el-form-item>
        
        <el-form-item label="切换间隔">
          <el-input-number
            v-model="configForm.intervalSeconds"
            :min="1"
            :max="60"
            controls-position="right"
          />
          <span class="interval-text">秒</span>
        </el-form-item>

        <el-form-item label="选择图片">
          <div class="image-selector">
            <div class="available-images">
              <h4>可用图片 ({{ availableImages.length }})</h4>
              <div class="image-grid">
                <div
                  v-for="image in availableImages"
                  :key="image.id"
                  class="selectable-image"
                  :class="{ selected: isImageSelected(image.id) }"
                  @click="toggleImageSelection(image.id)"
                >
                  <img :src="image.thumbnailUrl" :alt="image.filename" />
                  <div class="image-overlay">
                    <el-icon><Check /></el-icon>
                  </div>
                  <div class="image-info">
                    <div class="filename">{{ image.filename }}</div>
                    <el-tag v-if="image.isEdited" size="small" type="success">已编辑</el-tag>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="selected-images">
              <h4>已选图片 ({{ configForm.selectedImageIds.length }})</h4>
              <div v-if="configForm.selectedImageIds.length > 0" class="selected-list">
                <div
                  v-for="imageId in configForm.selectedImageIds"
                  :key="imageId"
                  class="selected-item"
                >
                  <img :src="getSelectedImageUrl(imageId)" />
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removeImageFromSelection(imageId)"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>
              <div v-else class="empty-selection">
                暂无选择的图片
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveConfig" :loading="saving">
          {{ editingConfig ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 轮播预览对话框 -->
    <el-dialog
      v-model="showPreview"
      title="轮播预览"
      width="80%"
      fullscreen
    >
      <div v-if="previewConfig" class="carousel-preview">
        <el-carousel
          :interval="previewConfig.interval_seconds * 1000"
          height="60vh"
          trigger="click"
          arrow="always"
        >
          <el-carousel-item v-for="image in previewConfig.images" :key="image.id">
            <div class="carousel-image-container">
              <!-- 使用 displayUrl 显示图片，优先显示编辑后的版本 -->
              <img :src="image.displayUrl" :alt="image.filename" class="carousel-image" />
              <div class="image-caption">
                <h3>{{ image.filename }}</h3>
                <el-tag v-if="image.isEdited" type="success">已编辑</el-tag>
              </div>
            </div>
          </el-carousel-item>
        </el-carousel>
        
        <div class="preview-info">
          <h3>{{ previewConfig.name }}</h3>
          <p>共 {{ previewConfig.images.length }} 张图片，切换间隔 {{ previewConfig.interval_seconds }} 秒</p>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="showPreview = false">关闭预览</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, View, Edit, Delete, Check, Close } from '@element-plus/icons-vue'

const showCreateDialog = ref(false)
const showPreview = ref(false)
const saving = ref(false)
const editingConfig = ref(null)
const previewConfig = ref(null)

const carouselConfigs = ref([])
const availableImages = ref([])

const configForm = reactive({
  name: '',
  intervalSeconds: 5,
  selectedImageIds: []
})

// 获取已选图片的URL（优先显示编辑后的版本）
const getSelectedImageUrl = (imageId) => {
  const image = availableImages.value.find(img => img.id === imageId)
  return image ? (image.displayUrl || image.thumbnailUrl) : ''
}

// 检查图片是否已选中
const isImageSelected = (imageId) => {
  return configForm.selectedImageIds.includes(imageId)
}

// 切换图片选择状态
const toggleImageSelection = (imageId) => {
  const index = configForm.selectedImageIds.indexOf(imageId)
  if (index > -1) {
    configForm.selectedImageIds.splice(index, 1)
  } else {
    configForm.selectedImageIds.push(imageId)
  }
}

// 从选择中移除图片
const removeImageFromSelection = (imageId) => {
  const index = configForm.selectedImageIds.indexOf(imageId)
  if (index > -1) {
    configForm.selectedImageIds.splice(index, 1)
  }
}

// 加载轮播配置
const loadCarouselConfigs = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/carousel', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      carouselConfigs.value = data.configs
      console.log('加载的轮播配置:', data.configs)
    } else {
      ElMessage.error('加载轮播配置失败')
    }
  } catch (error) {
    console.error('加载轮播配置错误:', error)
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 加载可用图片
const loadAvailableImages = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/images?limit=1000', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      availableImages.value = data.images
    } else {
      ElMessage.error('加载图片失败')
    }
  } catch (error) {
    console.error('加载图片错误:', error)
    ElMessage.error('网络错误，请稍后重试')
  }
}

// 保存轮播配置
const saveConfig = async () => {
  if (!configForm.name.trim()) {
    ElMessage.error('请输入轮播名称')
    return
  }
  
  if (configForm.selectedImageIds.length === 0) {
    ElMessage.error('请至少选择一张图片')
    return
  }

  try {
    saving.value = true
    const token = localStorage.getItem('token')
    const url = editingConfig.value 
      ? `/api/carousel/${editingConfig.value.id}`
      : '/api/carousel'
    
    const method = editingConfig.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: configForm.name,
        imageIds: configForm.selectedImageIds,
        intervalSeconds: configForm.intervalSeconds
      })
    })
    
    if (response.ok) {
      ElMessage.success(editingConfig.value ? '更新成功' : '创建成功')
      showCreateDialog.value = false
      resetForm()
      loadCarouselConfigs()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '保存失败')
    }
  } catch (error) {
    console.error('保存轮播配置错误:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 编辑配置
const editConfig = (config) => {
  editingConfig.value = config
  configForm.name = config.name
  configForm.intervalSeconds = config.interval_seconds
  configForm.selectedImageIds = config.images.map(img => img.id)
  showCreateDialog.value = true
}

// 预览轮播
const previewCarousel = (config) => {
  previewConfig.value = config
  showPreview.value = true
}

// 删除配置
const deleteConfig = async (configId) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个轮播配置吗？此操作不可恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/carousel/${configId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      ElMessage.success('删除成功')
      loadCarouselConfigs()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 重置表单
const resetForm = () => {
  configForm.name = ''
  configForm.intervalSeconds = 5
  configForm.selectedImageIds = []
  editingConfig.value = null
}

// 格式化日期
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

// 监听对话框关闭
const handleDialogClose = () => {
  resetForm()
}

onMounted(() => {
  loadCarouselConfigs()
  loadAvailableImages()
})
</script>

<style scoped>
.carousel-container {
  max-width: 1200px;
  margin: 0 auto;
}

.carousel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: white;
}

.config-info h3 {
  margin: 0 0 8px 0;
  color: #333;
}

.config-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.image-selector {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  max-height: 500px; /* 增加最大高度 */
  height: 500px; /* 设置固定高度 */
  overflow: hidden; /* 隐藏外部溢出 */
}

.available-images, .selected-images {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  padding: 16px;
  height: 100%; /* 填充父容器高度 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 隐藏内部溢出 */
}

.available-images h4, .selected-images h4 {
  margin: 0 0 12px 0;
  color: #333;
  flex-shrink: 0; /* 防止标题被压缩 */
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  overflow-y: auto; /* 添加垂直滚动 */
  flex: 1; /* 占据剩余空间 */
  padding-right: 8px; /* 为滚动条留出空间 */
}

/* 自定义滚动条样式 */
.image-grid::-webkit-scrollbar {
  width: 6px;
}

.image-grid::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.image-grid::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.image-grid::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.selected-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: none; /* 移除最大高度限制 */
  height: auto; /* 自动高度 */
  overflow-y: auto; /* 添加滚动 */
  flex: 1; /* 占据剩余空间 */
  padding-right: 8px;
}

/* 同样为已选列表添加滚动条样式 */
.selected-list::-webkit-scrollbar {
  width: 6px;
}

.selected-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.selected-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.selected-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.empty-selection {
  text-align: center;
  color: #999;
  padding: 20px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .image-selector {
    grid-template-columns: 1fr;
    height: 700px; /* 移动端增加高度 */
  }
  
  .images-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .images-header .el-input {
    width: 100%;
  }
}

.selectable-image {
  position: relative;
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.selectable-image:hover {
  border-color: #409EFF;
}

.selectable-image.selected {
  border-color: #409EFF;
  background-color: #f0f9ff;
}

.selectable-image img {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #409EFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  opacity: 0;
}

.selectable-image.selected .image-overlay {
  opacity: 1;
}

.image-info {
  padding: 4px;
  font-size: 12px;
}

.filename {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e6e6e6;
  border-radius: 6px;
}

.selected-item img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
}

.empty-selection {
  text-align: center;
  color: #999;
  padding: 20px;
}

.interval-text {
  margin-left: 8px;
  color: #666;
}

.carousel-preview {
  text-align: center;
}

.carousel-image-container {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.image-caption {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.preview-info {
  margin-top: 20px;
  text-align: center;
}

.empty-state {
  padding: 40px 0;
}

@media (max-width: 768px) {
  .config-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .config-actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .image-selector {
    grid-template-columns: 1fr;
  }
}
</style>