<template>
  <div class="gallery-container">
    <el-card>
      <template #header>
        <div class="gallery-header">
          <h2>图片库</h2>
          <div class="search-controls">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索图片..."
              style="width: 300px"
              :prefix-icon="Search"
              clearable
              @clear="loadImages"
              @keyup.enter="loadImages"
            />
            <el-button @click="showTagFilter = !showTagFilter">
              <el-icon><Filter /></el-icon>
              {{ showTagFilter ? '隐藏筛选' : '标签筛选' }}
            </el-button>
            
            <el-button v-if="selectedTags.length > 0" @click="clearTagFilter">
              <el-icon><CircleClose /></el-icon>
              清除筛选
            </el-button>

          </div>
        </div>
      </template>
      
      <!-- 标签筛选器 -->
      <div v-if="showTagFilter" class="tag-filter">
        <div class="filter-header">
          <h4>标签筛选 ({{ selectedTags.length }} 个选中)</h4>
          <div class="filter-actions">
            <el-button type="text" @click="selectAllTags">全选</el-button>
            <el-button type="text" @click="clearTagFilter">清空</el-button>
          </div>
        </div>
        <div class="filter-tags">
          <el-checkbox-group v-model="selectedTags">
            <el-checkbox
              v-for="tag in filteredAvailableTags"
              :key="tag.id"
              :label="tag.id"
              class="tag-checkbox"
            >
              <el-tag
                :type="getTagType(tag.type)"
                size="small"
                class="filter-tag"
              >
                {{ tag.name }}
                <el-icon v-if="tag.type === 'custom'" class="custom-tag-icon">
                  <EditPen />
                </el-icon>
                <span class="tag-count">({{ getTagCount(tag.id) }})</span>
              </el-tag>
            </el-checkbox>
          </el-checkbox-group>
          <div v-if="filteredAvailableTags.length === 0" class="no-tags-found">
            <el-empty description="未找到相关标签" :image-size="60" />
          </div>
        </div>
      </div>
       
      <!-- 当前筛选状态 -->
      <div v-if="selectedTags.length > 0" class="active-filters">
        <span class="filter-label">当前筛选:</span>
        <el-tag
          v-for="tagId in selectedTags"
          :key="tagId"
          closable
          @close="removeTagFromFilter(tagId)"
          class="active-filter-tag"
        >
          {{ getTagName(tagId) }}
        </el-tag>
      </div>

      <div v-loading="loading" class="image-grid">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="image-item"
          :class="{ 'edited': image.isEdited }"
        >
          <el-image
            :src="getDisplayImageUrl(image)"
            fit="cover"
            class="thumbnail"
            :preview-src-list="[getPreviewImageUrl(image)]"
            :preview-teleported="true"
          >
            <template #error>
              <div class="image-error">
                <el-icon><Picture /></el-icon>
                <span>加载失败</span>
              </div>
            </template>
          </el-image>
          
          <div class="image-info">
            <!-- 修改图片名称部分 -->
            <div class="image-name">
              <span 
                v-if="!editingNames[image.id]" 
                class="filename-text"
                @dblclick="startEditingName(image)"
              >
                {{ image.filename }}
              </span>
              <div v-else class="filename-edit">
                <el-input
                  v-model="editingNames[image.id]"
                  size="small"
                  @keyup.enter="saveImageName(image)"
                  @blur="saveImageName(image)"
                  @keyup.esc="cancelEditingName(image)"
                />
              </div>
              
              <el-tag v-if="image.isEdited" size="small" type="success" class="edit-tag">
                已编辑
              </el-tag>
            </div>
            
            <div class="image-meta">
              <span>{{ formatFileSize(image.fileSize) }}</span>
              <span>{{ image.width }} × {{ image.height }}</span>
              <span class="resolution-info">{{ getResolutionInfo(image.width, image.height) }}</span>
              <span v-if="image.takenTime">{{ formatDateTime(image.takenTime) }}</span>
              <span v-else-if="image.uploadTime">{{ formatDateTime(image.uploadTime) }}</span>
            </div>
            
            <!-- 标签显示区域 -->
            <div class="image-tags">
              <el-tag
                v-for="tag in image.tags"
                :key="tag.id || tag.name"
                size="small"
                :type="getTagType(tag.type)"
                :closable="tag.type === 'custom'"
                @close="removeTag(image.id, tag)"
                class="image-tag"
              >
                {{ tag.name }}
                <el-icon v-if="tag.type === 'custom'" class="custom-tag-icon">
                  <EditPen />
                </el-icon>
              </el-tag>
              
              <el-button
                size="small"
                type="text"
                @click="showAddTagDialog(image)"
                class="add-tag-btn"
              >
                <el-icon><Plus /></el-icon>
                添加标签
              </el-button>
            </div>

            <div class="image-actions">
              <!-- 重命名按钮 -->
              <el-button
                type="info"
                size="small"
                @click="startEditingName(image)"
                :loading="renamingImageId === image.id"
              >
                <el-icon><EditPen /></el-icon>
                重命名
              </el-button>
              <el-button
                type="primary"
                size="small"
                @click="editImage(image)"
              >
                <el-icon><Edit /></el-icon>
                {{ image.isEdited ? '重新编辑' : '编辑' }}
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="deleteImage(image.id)"
                :loading="deletingImageId === image.id"
              >
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
              <!-- 还原按钮 -->
              <el-button
                v-if="image.isEdited"
                type="warning"
                size="small"
                @click="revertImage(image.id)"
                :loading="revertingImageId === image.id"
              >
                <el-icon><RefreshLeft /></el-icon>
                还原
              </el-button>
              <el-button
                type="warning"
                size="small"
                @click="analyzeWithAI(image.id)"
                :loading="analyzingImageId === image.id"
              >
                <el-icon><Star /></el-icon>
                AI分析
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="downloadImage(image)"
                :loading="downloadingImageId === image.id"
                class="download-btn"
              >
                <el-icon><Download /></el-icon>
                下载
              </el-button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="images.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无图片">
          <el-button type="primary" @click="$router.push('/upload')">
            上传图片
          </el-button>
        </el-empty>
      </div>
      
      <div v-if="pagination.total > 0" class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <ImageEditor ref="imageEditorRef" @edited="handleImageEdited" />
    <ImageEditor 
      ref="imageEditorRef" 
      @edited="handleImageEdited" 
      @renamed="handleImageRenamed"
    />

    <el-dialog
      v-model="showAddTagDialogVisible"
      title="添加标签"
      width="400px"
    >
      <div class="add-tag-dialog">
        <el-input
          v-model="newTagName"
          placeholder="输入新标签名称"
          @keyup.enter="addTag"
        />
        <div class="suggested-tags">
          <h4>常用标签</h4>
          <div class="suggested-tags-list">
            <el-tag
              v-for="tag in suggestedTags"
              :key="tag"
              class="suggested-tag"
              @click="newTagName = tag; addTag()"
            >
              {{ tag }}
            </el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showAddTagDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addTag" :loading="addingTag">
          添加
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Delete, Edit, Picture, RefreshLeft, EditPen, Plus, Filter, Star} from '@element-plus/icons-vue'
import ImageEditor from '../components/ImageEditor.vue'
import { Download } from '@element-plus/icons-vue'
import { useSwipe } from '@vueuse/core'

const loading = ref(false)
const images = ref([])
const searchKeyword = ref('')
const deletingImageId = ref(null)
const revertingImageId = ref(null)
const renamingImageId = ref(null)
const imageEditorRef = ref()
const showTagFilter = ref(false)
const availableTags = ref([])
const selectedTags = ref([])
const showAddTagDialogVisible = ref(false)
const newTagName = ref('')
const addingTag = ref(false)
const currentImageForTag = ref(null)
const tagSearchKeyword = ref('')
const analyzingImageId = ref(null)
const downloadingImageId = ref(null)

const downloadImage = async (image) => {
  try {
    downloadingImageId.value = image.id
    
    // 获取图片URL（优先使用编辑后的版本）
    const imageUrl = image.displayUrl || image.originalUrl || image.thumbnailUrl
    if (!imageUrl) {
      ElMessage.error('无法获取图片地址')
      return
    }
    
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // 使用图片原始文件名
    link.download = image.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('图片下载完成')
  } catch (error) {
    console.error('下载图片失败:', error)
    ElMessage.error('下载失败，请稍后重试')
  } finally {
    downloadingImageId.value = null
  }
}

// 添加获取文件扩展名的辅助函数（虽然可能用不到，但保持一致性）
const getFileExtension = (filename) => {
  const match = filename.match(/\.[^/.]+$/)
  return match ? match[0] : '.jpg'
}

const analyzeWithAI = async (imageId) => {
  try {
    analyzingImageId.value = imageId
    const token = localStorage.getItem('token')
    
    // const response = await fetch(`/api/images/${imageId}/analyze`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${token}`
    //   }
    // })

    // 临时使用绝对URL测试
    const response = await fetch(`http://localhost:3000/api/images/${imageId}/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      ElMessage.success(`AI分析完成，生成 ${data.total} 个标签`)
      // 重新加载图片以显示新标签
      loadImages()
      loadAvailableTags()
    } else {
      const errorData = await response.json()
      ElMessage.error(errorData.error || 'AI分析失败')
    }
  } catch (error) {
    console.error('AI分析错误:', error)
    ElMessage.error('AI分析失败')
  } finally {
    analyzingImageId.value = null
  }
}

const setupTouchEvents = () => {
  if ('ontouchstart' in window) {
    // 移动端设备，添加触摸优化
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
  }
}

const handleTouchStart = (e) => {
  // 触摸开始逻辑
}

const handleTouchEnd = (e) => {
  // 触摸结束逻辑
}

onMounted(() => {
  setupTouchEvents()
})

const cameraRelatedKeywords = [
  // 相机品牌
  '佳能', '尼康', '索尼', '富士', '手机拍摄',
  // 焦距相关
  '超广角', '广角', '长焦', '标准焦距', '50mm', '35mm', '85mm', '24mm',
  // 光圈相关
  '大光圈', '小光圈', 'F1.8', 'F2', 'F2.8', 'F4', 'F5.6', 'F8', 'F11', 'F16', 'F22',
  // ISO相关
  '高感光度', '低感光度', 'ISO100', 'ISO200', 'ISO400', 'ISO800', 'ISO1600', 'ISO3200', 'ISO6400',
  // 曝光相关
  '曝光时间', '快门速度', '曝光补偿','GPS','2024年','2025年',
  '清晨', '夜景','高清','4K','春季'
]

// 用于存储正在编辑的文件名
const editingNames = reactive({})

// 常用标签建议
const suggestedTags = ref(['人像', '风景', '建筑', '动物', '植物', '美食', '旅行', '工作', '家庭', '活动'])

const filteredAvailableTags = computed(() => {
  // return availableTags.value.filter(tag => {
  //   // 检查标签名称是否包含任何相机相关关键词
  //   const isCameraRelated = cameraRelatedKeywords.some(keyword => 
  //     tag.name.includes(keyword)
  //   );
  //   return !isCameraRelated;
  // });
  return availableTags.value.filter(tag => {
    // 只显示自定义标签，隐藏所有智能标签
    return tag.type === 'custom';
  });
});

// 或者更详细的版本：
const getResolutionInfo = (width, height) => {
  if (!width || !height) return '未知分辨率';
  
  const totalPixels = width * height;
  const megapixels = (totalPixels / 1000000).toFixed(2);
  
  // 分辨率等级判断
  let resolutionLevel = '';
  if (totalPixels >= 7680 * 4320) resolutionLevel = '8K 超高清';
  else if (totalPixels >= 3840 * 2160) resolutionLevel = '4K 超高清';
  else if (totalPixels >= 2560 * 1440) resolutionLevel = '2K QHD';
  else if (totalPixels >= 1920 * 1080) resolutionLevel = '全高清 FHD';
  else if (totalPixels >= 1280 * 720) resolutionLevel = '高清 HD';
  else if (totalPixels >= 1024 * 768) resolutionLevel = 'XGA';
  else if (totalPixels >= 800 * 600) resolutionLevel = 'SVGA';
  else resolutionLevel = '标清 SD';
  
  return `${resolutionLevel} (${megapixels}MP)`;
}


const formatDateTime = (dateString) => {
  if (!dateString) return '未知时间';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // 如果是今天，显示时间
    if (diffDays === 1) {
      return `今天 ${date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    // 如果是昨天
    else if (diffDays === 2) {
      return `昨天 ${date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    // 一周内
    else if (diffDays <= 7) {
      return `${diffDays - 1}天前`;
    }
    // 其他情况显示完整日期
    else {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (error) {
    console.error('时间格式化错误:', error);
    return '无效时间';
  }
}

// 在 Gallery.vue 中添加处理重命名的方法
const handleImageRenamed = (newFilename) => {
  console.log('图片重命名完成:', newFilename)
  ElMessage.success('重命名成功')
  // 重新加载图片列表以显示更新后的文件名
  loadImages()
}

const pagination = ref({
  page: 1,
  limit: 20,
  total: 0
})

const filteredImages = computed(() => {
  if (selectedTags.value.length === 0) {
    return images.value
  }
  
  return images.value.filter(image => {
    if (!image.tags || !Array.isArray(image.tags)) {
      return false
    }
    
    const imageTagIds = image.tags.map(tag => tag.id).filter(id => id != null)
    return selectedTags.value.every(selectedTagId => 
      imageTagIds.includes(selectedTagId)
    )
  })
})


// 获取显示图片的URL（优先显示编辑后的版本）
const getDisplayImageUrl = (image) => {
  return image.displayUrl || image.thumbnailUrl
}

// 获取预览图片的URL（优先显示编辑后的版本）
const getPreviewImageUrl = (image) => {
  return image.displayUrl || image.originalUrl
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getTagType = (type) => {
  const types = {
    'exif': 'success',
    'custom': 'primary',
    'ai': 'warning'
  }
  return types[type] || 'info'
}

// 标签筛选功能
const toggleTagFilter = (tagId) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

const clearTagFilter = () => {
  selectedTags.value = []
}


// 添加标签功能
const showAddTagDialog = (image) => {
  currentImageForTag.value = image
  newTagName.value = ''
  showAddTagDialogVisible.value = true
}

const addTag = async () => {
  if (!newTagName.value.trim()) {
    ElMessage.error('请输入标签名称')
    return
  }

  if (!currentImageForTag.value) {
    ElMessage.error('没有选择图片')
    return
  }

  try {
    addingTag.value = true
    const token = localStorage.getItem('token')
    
    const response = await fetch(`/api/images/${currentImageForTag.value.id}/tags`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tagName: newTagName.value.trim() })
    })
    
    if (response.ok) {
      const data = await response.json()
      ElMessage.success('标签添加成功')
      showAddTagDialogVisible.value = false
      newTagName.value = ''
      
      // 如果后端返回了完整的标签信息，可以直接更新本地数据
      if (data.tag && data.tag.id) {
        // 找到对应的图片并添加标签
        const imageIndex = images.value.findIndex(img => img.id === currentImageForTag.value.id)
        if (imageIndex !== -1) {
          if (!images.value[imageIndex].tags) {
            images.value[imageIndex].tags = []
          }
          images.value[imageIndex].tags.push(data.tag)
        }
      } else {
        // 否则重新加载
        loadImages()
      }
      
      loadAvailableTags()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '添加标签失败')
    }
  } catch (error) {
    console.error('添加标签错误:', error)
    ElMessage.error('添加标签失败')
  } finally {
    addingTag.value = false
  }
}

// 移除标签
const removeTag = async (imageId, tag) => {
  console.log('移除标签，参数:', { imageId, tag }); // 添加调试信息
  
  try {
    // 检查 tag 对象是否有 id 属性
    if (!tag.id) {
      console.error('标签对象缺少 id 属性:', tag);
      ElMessage.error('标签数据不完整，无法移除');
      return;
    }

    await ElMessageBox.confirm(
      `确定要移除标签 "${tag.name}" 吗？`,
      '确认移除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/images/${imageId}/tags/${tag.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      ElMessage.success('标签移除成功')
      loadImages() // 重新加载图片以更新标签
      loadAvailableTags() // 重新加载可用标签
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '移除标签失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('移除标签失败')
    }
  }
}

// 加载可用标签
const loadAvailableTags = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/tags', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      availableTags.value = data.tags
    }
  } catch (error) {
    console.error('加载标签错误:', error)
  }
}

// 获取标签名称
const getTagName = (tagId) => {
  const tag = availableTags.value.find(t => t.id === tagId)
  return tag ? tag.name : '未知标签'
}

// 获取标签使用次数
const getTagCount = (tagId) => {
  return images.value.filter(image => 
    image.tags && image.tags.some(tag => tag.id === tagId)
  ).length
}

// 从筛选器中移除标签
const removeTagFromFilter = (tagId) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  }
}

// 全选标签
const selectAllTags = () => {
  selectedTags.value = availableTags.value.map(tag => tag.id)
}

// 搜索处理
const handleSearch = () => {
  pagination.value.page = 1 // 重置到第一页
  loadImages()
}

const handleSearchClear = () => {
  searchKeyword.value = ''
  pagination.value.page = 1
  loadImages()
}

// 开始编辑文件名
const startEditingName = (image) => {
  editingNames[image.id] = image.filename
  // 下一个tick聚焦输入框
  setTimeout(() => {
    const input = document.querySelector(`[data-image-id="${image.id}"] input`)
    if (input) {
      input.focus()
      input.select()
    }
  }, 100)
}

// 保存图片名称
const saveImageName = async (image) => {
  const newFilename = editingNames[image.id]?.trim()
  
  if (!newFilename) {
    ElMessage.error('文件名不能为空')
    cancelEditingName(image)
    return
  }
  
  if (newFilename === image.filename) {
    cancelEditingName(image)
    return
  }
  
  try {
    renamingImageId.value = image.id
    const token = localStorage.getItem('token')
    
    const response = await fetch(`/api/images/${image.id}/rename`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename: newFilename })
    })
    
    if (response.ok) {
      const data = await response.json()
      ElMessage.success('重命名成功')
      // 更新本地数据
      image.filename = newFilename
      cancelEditingName(image)
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '重命名失败')
      // 恢复原始文件名
      editingNames[image.id] = image.filename
    }
  } catch (error) {
    console.error('重命名错误:', error)
    ElMessage.error('重命名失败')
    // 恢复原始文件名
    editingNames[image.id] = image.filename
  } finally {
    renamingImageId.value = null
  }
}

// 取消编辑文件名
const cancelEditingName = (image) => {
  delete editingNames[image.id]
}

// 编辑图片
const editImage = (image) => {
  console.log('开始编辑图片:', image)
  
  if (!image || !image.id) {
    console.error('无效的图片数据:', image)
    ElMessage.error('图片数据无效')
    return
  }
  
  if (!imageEditorRef.value) {
    console.error('图片编辑器未初始化')
    ElMessage.error('编辑器未准备好')
    return
  }
  
  try {
    imageEditorRef.value.show(image)
  } catch (error) {
    console.error('调用图片编辑器失败:', error)
    ElMessage.error('打开编辑器失败')
  }
}

// 处理编辑完成
const handleImageEdited = (result) => {
  console.log('图片编辑完成:', result)
  ElMessage.success('编辑已保存')
  // 重新加载图片列表以显示编辑后的效果
  loadImages()
}

// 还原图片到原始版本
const revertImage = async (imageId) => {
  try {
    await ElMessageBox.confirm(
      '确定要还原这张图片吗？将删除所有编辑效果。',
      '确认还原',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    revertingImageId.value = imageId
    const token = localStorage.getItem('token')
    
    const response = await fetch(`/api/images/${imageId}/revert`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      ElMessage.success('还原成功')
      loadImages()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '还原失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('还原失败')
    }
  } finally {
    revertingImageId.value = null
  }
}

const loadImages = async () => {
  try {
    loading.value = true
    const token = localStorage.getItem('token')
    
    const params = new URLSearchParams({
      page: pagination.value.page,
      limit: pagination.value.limit
    })
    
    if (searchKeyword.value) {
      params.append('search', searchKeyword.value)
    }
    
    const response = await fetch(`/api/images?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      images.value = data.images
      pagination.value.total = data.pagination.total
    } else {
      ElMessage.error('加载图片失败')
    }
  } catch (error) {
    console.error('加载图片错误:', error)
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

const deleteImage = async (imageId) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这张图片吗？此操作不可恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    deletingImageId.value = imageId
    const token = localStorage.getItem('token')
    
    const response = await fetch(`/api/images/${imageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      ElMessage.success('删除成功')
      loadImages()
    } else {
      const data = await response.json()
      ElMessage.error(data.error || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  } finally {
    deletingImageId.value = null
  }
}

const handleSizeChange = (newSize) => {
  pagination.value.limit = newSize
  pagination.value.page = 1
  loadImages()
}

const handlePageChange = (newPage) => {
  pagination.value.page = newPage
  loadImages()
}

onMounted(() => {
  loadImages()
  loadAvailableTags()
})
</script>

<style scoped>

.image-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 4px;
}

.resolution-info {
  color: #409EFF;
  font-weight: 500;
  background: #f0f9ff;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid #d9ecff;
}


.tag-checkbox {
  margin-right: 8px;
  margin-bottom: 8px;
}

.filter-tag {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-count {
  font-size: 12px;
  opacity: 0.7;
  margin-left: 4px;
}

.active-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 4px;
  border-left: 4px solid #409EFF;
}

.filter-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.active-filter-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

.tag-filter {
  background: #f8f9fa;
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.filter-header h4 {
  margin: 0;
  color: #333;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tag:hover {
  opacity: 0.8;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  align-items: center;
}

.image-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.custom-tag-icon {
  font-size: 12px;
}

.add-tag-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}

.add-tag-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggested-tags h4 {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.suggested-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.suggested-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.suggested-tag:hover {
  background-color: #409EFF;
  color: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .gallery-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-controls {
    flex-direction: column;
    gap: 10px;
  }
  
  .search-controls .el-input {
    width: 100%;
    margin-right: 0;
  }
  
  .image-grid {
    grid-template-columns: 1fr;
  }
  
  .image-actions {
    flex-direction: column;
  }
  
  .image-name {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filename-text {
    width: 100%;
  }
  
  .filter-tags {
    justify-content: center;
  }
}


.gallery-container {
  max-width: 1200px;
  margin: 0 auto;
}

.gallery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
}

.search-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.image-item {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  transition: transform 0.2s, box-shadow 0.2s;
}

.image-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 已编辑图片的特殊样式 */
.image-item.edited {
  border-left: 4px solid #67c23a;
}

.thumbnail {
  width: 100%;
  height: 200px;
  display: block;
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filename-text {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filename-text:hover {
  background-color: #f5f7fa;
}

.filename-edit {
  flex: 1;
}

.filename-edit :deep(.el-input) {
  width: 100%;
}

.edit-tag {
  flex-shrink: 0;
}

.image-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}

.image-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  gap: 8px;
}

.empty-state {
  padding: 40px 0;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .gallery-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-controls {
    justify-content: space-between;
  }
  
  .search-controls .el-input {
    width: 100%;
    margin-right: 10px;
  }
  
  .image-grid {
    grid-template-columns: 1fr;
  }
  
  .image-actions {
    flex-direction: column;
  }
  
  .image-name {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .filename-text {
    width: 100%;
  }
}
</style>