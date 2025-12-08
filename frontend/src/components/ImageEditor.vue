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
          <div class="image-container" ref="imageContainer" :class="{ 'crop-active': activeTool === 'crop' }">
            <img
              ref="editableImage"
              :src="imageUrl"
              :style="imageStyle"
              @load="onImageLoad"
              crossorigin="anonymous"
              @mousedown="onImageMouseDown"
            />
            
            <!-- 裁剪框 -->
            <div
              v-if="activeTool === 'crop' && crop.visible"
              class="crop-box"
              :style="cropStyle"
              @mousedown="startCropInteraction"
            >
              <div class="crop-handle crop-handle-tl" @mousedown="startResize('tl', $event)"></div>
              <div class="crop-handle crop-handle-tr" @mousedown="startResize('tr', $event)"></div>
              <div class="crop-handle crop-handle-bl" @mousedown="startResize('bl', $event)"></div>
              <div class="crop-handle crop-handle-br" @mousedown="startResize('br', $event)"></div>
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
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue'
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

// 裁剪状态 - 重构版本
const crop = reactive({
  visible: false,
  x: 0,          // 相对于容器的位置（像素）
  y: 0,
  width: 0,
  height: 0,
  originalX: 0,  // 相对于原始图片的位置
  originalY: 0,
  originalWidth: 0,
  originalHeight: 0,
  dragging: false,
  resizing: false,
  resizeDirection: null
})

// 图片显示信息
const imageDisplayInfo = reactive({
  naturalWidth: 0,
  naturalHeight: 0,
  displayWidth: 0,
  displayHeight: 0,
  scale: 1,      // 显示缩放比例：display / natural
  offsetX: 0,    // 图片在容器中的偏移
  offsetY: 0
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
    // 等待图片加载完成
    if (editableImage.value && editableImage.value.complete) {
      onImageLoad()
    }
    crop.visible = true
  }
}

const onImageLoad = () => {
  const img = editableImage.value
  if (!img) return
  
  // 获取图片原始尺寸
  imageDisplayInfo.naturalWidth = img.naturalWidth
  imageDisplayInfo.naturalHeight = img.naturalHeight
  
  // 计算图片显示尺寸和位置
  calculateImageDisplayInfo()
  
  // 初始化裁剪框
  if (activeTool.value === 'crop') {
    initCrop()
  }
}

// 计算图片显示信息
const calculateImageDisplayInfo = () => {
  if (!editableImage.value || !imageContainer.value) return
  
  const container = imageContainer.value
  const img = editableImage.value
  
  // 获取容器尺寸
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  
  // 获取图片原始尺寸
  const imgWidth = img.naturalWidth
  const imgHeight = img.naturalHeight
  
  // 计算缩放比例（保持宽高比，适应容器）
  const scale = Math.min(
    containerWidth / imgWidth,
    containerHeight / imgHeight
  )
  
  // 计算显示尺寸
  const displayWidth = imgWidth * scale
  const displayHeight = imgHeight * scale
  
  // 计算居中偏移
  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2
  
  // 更新显示信息
  imageDisplayInfo.displayWidth = displayWidth
  imageDisplayInfo.displayHeight = displayHeight
  imageDisplayInfo.scale = scale
  imageDisplayInfo.offsetX = offsetX
  imageDisplayInfo.offsetY = offsetY
  
  console.log('图片显示信息:', {
    natural: `${imgWidth}x${imgHeight}`,
    display: `${displayWidth}x${displayHeight}`,
    scale: scale,
    offset: { x: offsetX, y: offsetY }
  })
}

// 屏幕坐标转换为图片原始坐标
const screenToImageCoords = (screenX, screenY) => {
  const imgRect = editableImage.value.getBoundingClientRect()
  const containerRect = imageContainer.value.getBoundingClientRect()

  // 将页面坐标转换为相对于 image 显示区的坐标：
  // page -> container local -> relative to image inside container
  const localX = screenX - containerRect.left
  const localY = screenY - containerRect.top

  // image 在 container 中的左上角（相对于 container）
  const imgLocalLeft = imgRect.left - containerRect.left
  const imgLocalTop  = imgRect.top  - containerRect.top

  const relativeX = localX - imgLocalLeft
  const relativeY = localY - imgLocalTop

  const originalX = Math.max(0, Math.min(
    Math.round(relativeX / imageDisplayInfo.scale),
    imageDisplayInfo.naturalWidth
  ))

  const originalY = Math.max(0, Math.min(
    Math.round(relativeY / imageDisplayInfo.scale),
    imageDisplayInfo.naturalHeight
  ))

  return { x: originalX, y: originalY }
}

// —— 替换：imageToScreenCoords ——
// 输入：imgX/imgY（原图像像素坐标）
// 输出：{ x, y } 页面坐标（client）
// 注意：仍然返回页面坐标（若需要容器局部坐标见下 updateCropScreenPosition）
const imageToScreenCoords = (imgX, imgY) => {
  const imgRect = editableImage.value.getBoundingClientRect()

  const screenX = imgRect.left + (imgX * imageDisplayInfo.scale)
  const screenY = imgRect.top  + (imgY * imageDisplayInfo.scale)

  return { x: screenX, y: screenY }
}

const initCrop = () => {
  if (!editableImage.value) return
  
  const img = editableImage.value
  
  // 设置默认裁剪框为图片中心的70%
  const cropWidth = img.naturalWidth * 0.7
  const cropHeight = img.naturalHeight * 0.7
  const cropX = (img.naturalWidth - cropWidth) / 2
  const cropY = (img.naturalHeight - cropHeight) / 2
  
  // 更新原始图片坐标
  crop.originalX = Math.round(cropX)
  crop.originalY = Math.round(cropY)
  crop.originalWidth = Math.round(cropWidth)
  crop.originalHeight = Math.round(cropHeight)
  
  // 转换为屏幕坐标
  updateCropScreenPosition()
  
  crop.visible = true
}

const updateCropScreenPosition = () => {
  if (!editableImage.value || !imageContainer.value) return

  // image 的两个角在页面坐标
  const topLeft = imageToScreenCoords(crop.originalX, crop.originalY)
  const bottomRight = imageToScreenCoords(
    crop.originalX + crop.originalWidth,
    crop.originalY + crop.originalHeight
  )

  const containerRect = imageContainer.value.getBoundingClientRect()

  // 把页面坐标转换为容器内局部坐标（这样 template 使用 left/top 就正确）
  crop.x = Math.round(topLeft.x - containerRect.left)
  crop.y = Math.round(topLeft.y - containerRect.top)
  crop.width = Math.round(bottomRight.x - topLeft.x)
  crop.height = Math.round(bottomRight.y - topLeft.y)
}

// —— 替换：updateCropImagePosition ——
// 把 crop.x/crop.y（容器局部坐标）转换为 crop.original*（原始图片像素坐标）
const updateCropImagePosition = () => {
  if (!editableImage.value || !imageContainer.value) return

  const imgRect = editableImage.value.getBoundingClientRect()
  const containerRect = imageContainer.value.getBoundingClientRect()

  // pageCropLeft = container.left + crop.x
  const pageCropLeft = containerRect.left + crop.x
  const pageCropTop  = containerRect.top  + crop.y

  // relative to image (page coords)
  const relativeX = pageCropLeft - imgRect.left
  const relativeY = pageCropTop  - imgRect.top

  crop.originalX = Math.max(0, Math.min(
    Math.round(relativeX / imageDisplayInfo.scale),
    imageDisplayInfo.naturalWidth
  ))
  crop.originalY = Math.max(0, Math.min(
    Math.round(relativeY / imageDisplayInfo.scale),
    imageDisplayInfo.naturalHeight
  ))

  crop.originalWidth = Math.max(10, Math.min(
    Math.round(crop.width / imageDisplayInfo.scale),
    imageDisplayInfo.naturalWidth - crop.originalX
  ))
  crop.originalHeight = Math.max(10, Math.min(
    Math.round(crop.height / imageDisplayInfo.scale),
    imageDisplayInfo.naturalHeight - crop.originalY
  ))

  console.log('裁剪框原始坐标:', {
    x: crop.originalX,
    y: crop.originalY,
    width: crop.originalWidth,
    height: crop.originalHeight
  })
}

const startCropInteraction = (e) => {
  e.preventDefault()
  e.stopPropagation()

  crop.dragging = true
  const startX = e.clientX
  const startY = e.clientY
  const startCropX = crop.x
  const startCropY = crop.y

  const containerRect = imageContainer.value.getBoundingClientRect()
  const imgRect = editableImage.value.getBoundingClientRect()

  const doMove = (moveEvent) => {
    if (!crop.dragging) return

    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY

    // new pos in container-local coords
    let newX = startCropX + dx
    let newY = startCropY + dy

    // 边界：图片在容器中的局部坐标范围
    const imgLocalLeft = imgRect.left - containerRect.left
    const imgLocalTop  = imgRect.top  - containerRect.top
    const imgLocalRight = imgLocalLeft + imageDisplayInfo.displayWidth
    const imgLocalBottom = imgLocalTop + imageDisplayInfo.displayHeight

    // 限制 newX/newY 在图片显示区内
    newX = Math.max(imgLocalLeft, Math.min(newX, imgLocalRight - crop.width))
    newY = Math.max(imgLocalTop, Math.min(newY, imgLocalBottom - crop.height))

    crop.x = newX
    crop.y = newY
  }

  const stopMove = () => {
    crop.dragging = false
    document.removeEventListener('mousemove', doMove)
    document.removeEventListener('mouseup', stopMove)
    updateCropImagePosition()
  }

  document.addEventListener('mousemove', doMove)
  document.addEventListener('mouseup', stopMove)
}


const startResize = (direction, e) => {
  e.preventDefault()
  e.stopPropagation()
  
  crop.resizing = true
  crop.resizeDirection = direction
  
  const startX = e.clientX
  const startY = e.clientY
  const startCrop = {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height
  }
  
  const doResize = (moveEvent) => {
    if (!crop.resizing) return
    
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    
    const imgRect = editableImage.value.getBoundingClientRect()
    
    // 最小尺寸
    const minSize = 50
    
    switch (direction) {
      case 'br': // 右下角
        crop.width = Math.max(minSize, startCrop.width + dx)
        crop.height = Math.max(minSize, startCrop.height + dy)
        break
        
      case 'tr': // 右上角
        crop.width = Math.max(minSize, startCrop.width + dx)
        crop.height = Math.max(minSize, startCrop.height - dy)
        crop.y = startCrop.y + dy
        break
        
      case 'bl': // 左下角
        crop.width = Math.max(minSize, startCrop.width - dx)
        crop.height = Math.max(minSize, startCrop.height + dy)
        crop.x = startCrop.x + dx
        break
        
      case 'tl': // 左上角
        crop.width = Math.max(minSize, startCrop.width - dx)
        crop.height = Math.max(minSize, startCrop.height - dy)
        crop.x = startCrop.x + dx
        crop.y = startCrop.y + dy
        break
    }
    
    // 边界检查：使用 container 局部坐标与 image 显示区边界
    const containerRect = imageContainer.value.getBoundingClientRect()
    const imgLocalLeft = imgRect.left - containerRect.left
    const imgLocalTop  = imgRect.top  - containerRect.top
    const imgLocalRight = imgLocalLeft + imageDisplayInfo.displayWidth
    const imgLocalBottom = imgLocalTop + imageDisplayInfo.displayHeight

    // 限制 x/y 在图片显示区内
    crop.x = Math.max(imgLocalLeft, Math.min(crop.x, imgLocalRight - minSize))
    crop.y = Math.max(imgLocalTop, Math.min(crop.y, imgLocalBottom - minSize))

    // 限制宽高不超出图片显示区（注意 crop.x 是局部坐标）
    crop.width = Math.min(crop.width, imgLocalRight - crop.x)
    crop.height = Math.min(crop.height, imgLocalBottom - crop.y)
  }
  
  const stopResize = () => {
    crop.resizing = false
    document.removeEventListener('mousemove', doResize)
    document.removeEventListener('mouseup', stopResize)
    updateCropImagePosition()
  }
  
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', stopResize)
}

// 图片点击创建裁剪框
const onImageMouseDown = (e) => {
  if (activeTool.value !== 'crop') return

  if (!crop.visible) {
    initCrop()
    return
  }

  const containerRect = imageContainer.value.getBoundingClientRect()
  const clickLocalX = e.clientX - containerRect.left
  const clickLocalY = e.clientY - containerRect.top

  const inCrop = (
    clickLocalX >= crop.x &&
    clickLocalX <= crop.x + crop.width &&
    clickLocalY >= crop.y &&
    clickLocalY <= crop.y + crop.height
  )

  if (!inCrop) {
    // 点击在裁剪框外，以点击点为中心创建新的裁剪框
    const imgCoords = screenToImageCoords(e.clientX, e.clientY)

    const newWidth = imageDisplayInfo.naturalWidth * 0.4
    const newHeight = imageDisplayInfo.naturalHeight * 0.4

    crop.originalX = Math.max(0, Math.min(
      Math.round(imgCoords.x - newWidth / 2),
      imageDisplayInfo.naturalWidth - newWidth
    ))
    crop.originalY = Math.max(0, Math.min(
      Math.round(imgCoords.y - newHeight / 2),
      imageDisplayInfo.naturalHeight - newHeight
    ))
    crop.originalWidth = Math.round(newWidth)
    crop.originalHeight = Math.round(newHeight)

    updateCropScreenPosition()
  }
}


// 监听窗口大小变化
const onResize = () => {
  calculateImageDisplayInfo()
  if (crop.visible) {
    updateCropScreenPosition()
  }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

const rotateImage = () => {
  editingState.rotation = (editingState.rotation + 90) % 360
  // 旋转后需要重新计算显示信息
  if (editableImage.value && editableImage.value.complete) {
    nextTick(() => {
      calculateImageDisplayInfo()
      if (crop.visible) {
        updateCropScreenPosition()
      }
    })
  }
}

const applyFilters = () => {
  // 滤镜实时应用，通过CSS filter实现
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
    
    // 确保裁剪坐标是最新的
    if (crop.visible) {
      updateCropImagePosition()
    }
    
    const operations = {
      crop: crop.visible ? {
        x: crop.originalX,
        y: crop.originalY,
        width: crop.originalWidth,
        height: crop.originalHeight
      } : null,
      rotate: editingState.rotation,
      filters: { ...filters }
    }

    console.log('发送编辑请求，操作:', operations)

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
      console.log('编辑返回结果:', result)
      
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
  cursor: crosshair;
}

.image-container.crop-active {
  cursor: default;
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
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5); /* 半透明遮罩 */
}

.crop-box::before {
  content: '';
  position: absolute;
  top: 33.33%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.5);
}

.crop-box::after {
  content: '';
  position: absolute;
  top: 66.66%;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.5);
}

.crop-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #409EFF;
  border: 2px solid white;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.crop-handle-tl {
  top: -6px;
  left: -6px;
  cursor: nw-resize;
}

.crop-handle-tr {
  top: -6px;
  right: -6px;
  cursor: ne-resize;
}

.crop-handle-bl {
  bottom: -6px;
  left: -6px;
  cursor: sw-resize;
}

.crop-handle-br {
  bottom: -6px;
  right: -6px;
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