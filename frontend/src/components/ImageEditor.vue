<template>
  <div class="image-editor-container">
    <el-dialog 
      v-model="visible" 
      title="图片编辑" 
      width="90%"
      fullscreen
      :before-close="handleClose"
    >
      <div v-if="currentImage" class="editor-layout">
        <!-- 编辑工具栏 -->
        <div class="toolbar">
          <el-button-group>
            <el-button 
              :type="activeTool === 'crop' ? 'primary' : ''"
              @click="setActiveTool('crop')"
            >
              <el-icon><Crop /></el-icon>
              裁剪
            </el-button>
            <el-button 
              :type="activeTool === 'rotate' ? 'primary' : ''"
              @click="rotateImage"
            >
              <el-icon><Refresh /></el-icon>
              旋转
            </el-button>
          </el-button-group>

          <el-divider direction="vertical" />

          <!-- 滤镜调整 -->
          <div class="filter-controls">
            <span>亮度:</span>
            <el-slider
              v-model="filters.brightness"
              :min="0.5"
              :max="2"
              :step="0.1"
              style="width: 120px;"
              @change="applyFilters"
            />
            
            <span>对比度:</span>
            <el-slider
              v-model="filters.contrast"
              :min="0.5"
              :max="2"
              :step="0.1"
              style="width: 120px;"
              @change="applyFilters"
            />
            
            <span>饱和度:</span>
            <el-slider
              v-model="filters.saturation"
              :min="0"
              :max="2"
              :step="0.1"
              style="width: 120px;"
              @change="applyFilters"
            />
          </div>

          <el-divider direction="vertical" />

          <el-button-group>
            <el-button @click="resetEditing">
              <el-icon><RefreshLeft /></el-icon>
              重置
            </el-button>
            <el-button type="primary" @click="saveEditing" :loading="saving">
              <el-icon><Check /></el-icon>
              保存
            </el-button>
          </el-button-group>
        </div>

        <!-- 编辑区域 -->
        <div class="editor-area">
          <div class="image-container" ref="imageContainer">
            <img
              ref="editableImage"
              :src="imageUrl"
              :style="imageStyle"
              @load="onImageLoad"
              crossorigin="anonymous"
            />
            
            <!-- 裁剪框 -->
            <div
              v-if="activeTool === 'crop' && crop.visible"
              class="crop-box"
              :style="cropStyle"
              @mousedown="startCropMove"
            >
              <div class="crop-handle crop-handle-tl" @mousedown="startCropResize('tl')"></div>
              <div class="crop-handle crop-handle-tr" @mousedown="startCropResize('tr')"></div>
              <div class="crop-handle crop-handle-bl" @mousedown="startCropResize('bl')"></div>
              <div class="crop-handle crop-handle-br" @mousedown="startCropResize('br')"></div>
            </div>
          </div>

          <!-- EXIF信息面板 -->
          <div class="info-panel">
            <el-card>
              <template #header>
                <h3>图片信息</h3>
              </template>
              
              <div v-if="exifInfo" class="exif-info">
                <div class="info-item">
                  <span class="label">相机型号:</span>
                  <span class="value">{{ exifInfo.camera_model || '未知' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">拍摄时间:</span>
                  <span class="value">{{ formatDate(exifInfo.taken_time) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">曝光时间:</span>
                  <span class="value">{{ exifInfo.exposure_time || '未知' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">光圈:</span>
                  <span class="value">{{ exifInfo.f_number || '未知' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">ISO:</span>
                  <span class="value">{{ exifInfo.iso_speed || '未知' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">焦距:</span>
                  <span class="value">{{ exifInfo.focal_length || '未知' }}</span>
                </div>
              </div>
              
              <div v-else class="loading-info">
                <el-skeleton :rows="5" animated />
              </div>

              <!-- 标签展示 -->
              <div class="tags-section">
                <h4>智能标签</h4>
                <div class="tags-list">
                  <el-tag
                    v-for="tag in imageTags"
                    :key="tag.name"
                    :type="getTagType(tag.type)"
                    size="small"
                  >
                    {{ tag.name }}
                  </el-tag>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </div>

      <div v-else class="no-image">
        <el-empty description="图片数据加载失败" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Crop, Refresh, RefreshLeft, Check } from '@element-plus/icons-vue'

// 移除必需的 prop 定义，改为内部状态管理
const visible = ref(false)
const saving = ref(false)
const activeTool = ref('')
const editableImage = ref(null)
const imageContainer = ref(null)
const currentImage = ref(null) // 改为内部状态管理

// 编辑状态
const editingState = reactive({
  rotation: 0,
  scale: 1
})

// 裁剪状态
const crop = reactive({
  visible: false,
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  isMoving: false,
  isResizing: false,
  resizeDirection: ''
})

// 滤镜状态
const filters = reactive({
  brightness: 1,
  contrast: 1,
  saturation: 1
})

const exifInfo = ref(null)
const imageTags = ref([])

const imageUrl = computed(() => {
  return currentImage.value?.originalUrl || ''
})

const imageStyle = computed(() => ({
  transform: `rotate(${editingState.rotation}deg) scale(${editingState.scale})`,
  filter: `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturation})`
}))

const cropStyle = computed(() => ({
  left: `${crop.x}px`,
  top: `${crop.y}px`,
  width: `${crop.width}px`,
  height: `${crop.height}px`
}))

const show = (image) => {
  console.log('ImageEditor show called with:', image)
  
  if (!image || !image.id) {
    console.error('无效的图片数据:', image)
    ElMessage.error('图片数据无效')
    return
  }
  
  currentImage.value = image
  visible.value = true
  loadImageInfo()
}

const hide = () => {
  visible.value = false
  resetEditing()
  currentImage.value = null // 重置图片数据
}

const handleClose = () => {
  hide()
}

const setActiveTool = (tool) => {
  activeTool.value = tool
  if (tool === 'crop') {
    initCrop()
  }
}

const initCrop = () => {
  if (!editableImage.value) return
  
  const img = editableImage.value
  crop.visible = true
  crop.width = img.width * 0.7
  crop.height = img.height * 0.7
  crop.x = (img.width - crop.width) / 2
  crop.y = (img.height - crop.height) / 2
}

const onImageLoad = () => {
  // 图片加载完成后的初始化
}

const rotateImage = () => {
  editingState.rotation = (editingState.rotation + 90) % 360
}

const applyFilters = () => {
  // 滤镜实时应用，通过CSS filter实现
}

const startCropMove = (e) => {
  crop.isMoving = true
  const startX = e.clientX
  const startY = e.clientY
  const startCropX = crop.x
  const startCropY = crop.y

  const doMove = (moveEvent) => {
    if (!crop.isMoving) return
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    crop.x = Math.max(0, Math.min(startCropX + dx, editableImage.value.width - crop.width))
    crop.y = Math.max(0, Math.min(startCropY + dy, editableImage.value.height - crop.height))
  }

  const stopMove = () => {
    crop.isMoving = false
    document.removeEventListener('mousemove', doMove)
    document.removeEventListener('mouseup', stopMove)
  }

  document.addEventListener('mousemove', doMove)
  document.addEventListener('mouseup', stopMove)
}

const startCropResize = (direction) => {
  crop.isResizing = true
  crop.resizeDirection = direction

  const startX = event.clientX
  const startY = event.clientY
  const startCrop = { ...crop }

  const doResize = (moveEvent) => {
    if (!crop.isResizing) return
    
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY

    switch (direction) {
      case 'br':
        crop.width = Math.max(50, startCrop.width + dx)
        crop.height = Math.max(50, startCrop.height + dy)
        break
      case 'tr':
        crop.width = Math.max(50, startCrop.width + dx)
        crop.height = Math.max(50, startCrop.height - dy)
        crop.y = startCrop.y + dy
        break
      // 其他方向类似实现
    }
  }

  const stopResize = () => {
    crop.isResizing = false
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
  }

  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
}

const resetEditing = () => {
  editingState.rotation = 0
  editingState.scale = 1
  filters.brightness = 1
  filters.contrast = 1
  filters.saturation = 1
  crop.visible = false
  activeTool.value = ''
}

const saveEditing = async () => {
  if (!currentImage.value) {
    ElMessage.error('没有可编辑的图片')
    return
  }

  try {
    saving.value = true
    
    const operations = {
      crop: crop.visible ? {
        x: Math.round(crop.x),
        y: Math.round(crop.y),
        width: Math.round(crop.width),
        height: Math.round(crop.height)
      } : null,
      rotate: editingState.rotation,
      filters: { ...filters }
    }

    console.log('发送编辑请求，操作:', operations);

    const token = localStorage.getItem('token')
    const response = await fetch(`/api/images/${currentImage.value.id}/edit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operations })
    })

    if (response.ok) {
      const result = await response.json()
      ElMessage.success('编辑保存成功')
      console.log('编辑返回结果:', result);
      
      // 触发编辑完成事件
      emit('edited', result)
      hide()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '保存失败')
    }
  } catch (error) {
    console.error('保存编辑失败:', error)
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

// 添加事件发射器
const emit = defineEmits(['edited'])

const loadImageInfo = async () => {
  if (!currentImage.value) {
    console.error('没有当前图片数据')
    return
  }

  try {
    const token = localStorage.getItem('token')
    
    // 加载EXIF信息
    const exifResponse = await fetch(`/api/images/${currentImage.value.id}/exif`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (exifResponse.ok) {
      const data = await exifResponse.json()
      exifInfo.value = data.exif
    }

    // 设置标签
    imageTags.value = currentImage.value.tags || []
  } catch (error) {
    console.error('加载图片信息失败:', error)
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '未知'
  return new Date(dateString).toLocaleString('zh-CN')
}

const getTagType = (type) => {
  const types = {
    'exif': 'success',
    'custom': 'primary',
    'ai': 'warning'
  }
  return types[type] || 'info'
}


defineExpose({
  show,
  hide
})
</script>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: 80vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  border-bottom: 1px solid #e6e6e6;
  background: white;
  flex-wrap: wrap;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-controls span {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.editor-area {
  display: flex;
  flex: 1;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
}

.image-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  overflow: hidden;
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.crop-box {
  position: absolute;
  border: 2px solid #409EFF;
  background: rgba(64, 158, 255, 0.1);
  cursor: move;
}

.crop-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #409EFF;
  border: 1px solid white;
}

.crop-handle-tl {
  top: -5px;
  left: -5px;
  cursor: nw-resize;
}

.crop-handle-tr {
  top: -5px;
  right: -5px;
  cursor: ne-resize;
}

.crop-handle-bl {
  bottom: -5px;
  left: -5px;
  cursor: sw-resize;
}

.crop-handle-br {
  bottom: -5px;
  right: -5px;
  cursor: se-resize;
}

.info-panel {
  width: 300px;
  flex-shrink: 0;
}

.exif-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-item .label {
  font-weight: 500;
  color: #666;
}

.info-item .value {
  color: #333;
  text-align: right;
}

.loading-info {
  padding: 10px 0;
}

.tags-section {
  margin-top: 20px;
}

.tags-section h4 {
  margin: 0 0 10px 0;
  color: #333;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

@media (max-width: 768px) {
  .editor-area {
    flex-direction: column;
  }
  
  .info-panel {
    width: 100%;
    order: -1;
  }
  
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filter-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>