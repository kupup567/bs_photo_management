<template>
  <div class="ai-search-container">
    <el-card>
      <template #header>
        <div class="search-header">
          <h2>AI 智能图片搜索</h2>
          <div class="header-desc">
            <el-tag type="info" size="small">
              <el-icon><MagicStick /></el-icon>
              使用自然语言搜索图片
            </el-tag>
          </div>
        </div>
      </template>

      <!-- 搜索输入区域 -->
      <div class="search-input-area">
        <el-input
          v-model="searchQuery"
          placeholder="用自然语言描述你要找的图片，例如：海边日落的风景照、有猫咪的照片、婚礼现场的照片..."
          :prefix-icon="Search"
          clearable
          size="large"
          @keyup.enter="performSearch"
          @clear="clearSearch"
          class="search-input"
        >
          <template #append>
            <el-button 
              type="primary" 
              @click="performSearch"
              :loading="loading"
              :disabled="!searchQuery.trim()"
            >
              <el-icon><Search /></el-icon>
              {{ loading ? '搜索中...' : '智能搜索' }}
            </el-button>
          </template>
        </el-input>
        
        <div class="search-examples">
          <span class="example-label">搜索示例：</span>
          <el-tag
            v-for="(example, index) in searchExamples"
            :key="index"
            class="example-tag"
            type="info"
            size="small"
            @click="searchQuery = example; performSearch()"
          >
            {{ example }}
          </el-tag>
        </div>
      </div>

      <!-- 搜索结果展示 -->
      <div v-if="showResults" class="search-results">
        <!-- 搜索结果统计 -->
        <div class="results-header">
          <div class="results-summary">
            <h3>
              找到 {{ results.images.length }} 张相关图片
              <span class="query-text">"{{ results.query }}"</span>
            </h3>
            <div class="keywords-info">
              <el-tag type="info" size="small">
                <el-icon><Connection /></el-icon>
                AI 提取的关键词：
              </el-tag>
              <div class="keywords-list">
                <el-tag
                  v-for="keyword in results.keywords"
                  :key="keyword"
                  size="small"
                  type="primary"
                  class="keyword-tag"
                >
                  {{ keyword }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 图片网格 -->
        <div v-loading="loading" class="image-grid">
          <div
            v-for="image in results.images"
            :key="image.id"
            class="image-card"
          >
            <el-image
              :src="image.displayUrl"
              :preview-src-list="[image.displayUrl]"
              fit="cover"
              class="result-thumbnail"
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
              <div class="image-name">
                <span>{{ image.filename }}</span>
              </div>
              
              <div v-if="image.tags && image.tags.length > 0" class="image-tags">
                <el-tag
                  v-for="tag in image.tags.slice(0, 3)"
                  :key="tag"
                  size="mini"
                  type="info"
                  class="tag-item"
                >
                  {{ tag }}
                </el-tag>
                <span v-if="image.tags.length > 3" class="more-tags">
                  +{{ image.tags.length - 3 }}
                </span>
              </div>
              
              <div class="image-actions">
                <el-button
                  type="primary"
                  size="small"
                  @click.stop="viewImageDetails(image)"
                >
                  <el-icon><View /></el-icon>
                  查看
                </el-button>
                <el-button
                  type="default"
                  size="small"
                  @click.stop="downloadImage(image)"
                >
                  <el-icon><Download /></el-icon>
                  下载
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="results.images.length === 0 && !loading" class="empty-results">
          <el-empty description="没有找到相关图片">
            <template #image>
              <el-icon size="60"><Search /></el-icon>
            </template>
            <div class="empty-actions">
              <p>尝试换一个关键词搜索，或者</p>
              <el-button type="primary" @click="$router.push('/upload')">
                上传图片
              </el-button>
            </div>
          </el-empty>
        </div>

        <!-- 分页 -->
        <div v-if="results.pagination.count > 0" class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="results.pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <!-- 引导提示 -->
      <div v-else class="search-guide">
        <el-empty description="输入自然语言描述来搜索图片">
          <template #image>
            <div class="guide-icon">
              <el-icon size="80" color="#409EFF">
                <ChatLineRound />
              </el-icon>
            </div>
          </template>
          <div class="guide-content">
            <h4>💡 搜索提示：</h4>
            <ul class="guide-tips">
              <li>使用完整句子描述图片内容</li>
              <li>可以描述场景、颜色、人物、物体等</li>
              <li>AI会自动分析并转换为搜索关键词</li>
              <li>支持中文和英文混合搜索</li>
            </ul>
          </div>
        </el-empty>
      </div>
    </el-card>

    <!-- 图片预览模态框 -->
    <el-dialog
      v-model="previewVisible"
      :title="currentImage?.filename || '图片预览'"
      width="80%"
      :fullscreen="isMobile"
      @close="closePreview"
    >
      <div v-if="currentImage" class="image-preview">
        <!-- 主图片 -->
        <div class="preview-main">
          <el-image
            :src="currentImage.displayUrl"
            :preview-src-list="[currentImage.displayUrl]"
            fit="contain"
            class="preview-image"
            :preview-teleported="true"
            :hide-on-click-modal="true"
          >
            <template #error>
              <div class="preview-error">
                <el-icon><Picture /></el-icon>
                <span>图片加载失败</span>
              </div>
            </template>
          </el-image>
        </div>
        
        <!-- 图片信息 -->
        <div class="preview-info">
          <el-descriptions title="图片信息" :column="1" border>
            <el-descriptions-item label="文件名">
              {{ currentImage.filename }}
            </el-descriptions-item>
            <el-descriptions-item label="标签">
              <div class="info-tags">
                <el-tag
                  v-for="tag in currentImage.tags"
                  :key="tag"
                  size="small"
                  type="info"
                  class="info-tag"
                >
                  {{ tag }}
                </el-tag>
                <span v-if="currentImage.tags.length === 0" class="no-tags">
                  无标签
                </span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间" v-if="currentImage.uploadTime">
              {{ formatDateTime(currentImage.uploadTime) }}
            </el-descriptions-item>
            <el-descriptions-item label="操作">
              <el-button-group>
                <el-button
                  type="primary"
                  size="small"
                  @click="downloadImage(currentImage)"
                >
                  <el-icon><Download /></el-icon>
                  下载
                </el-button>
                <el-button
                  type="success"
                  size="small"
                  @click="goToGallery(currentImage)"
                >
                  <el-icon><View /></el-icon>
                  在图库中查看
                </el-button>
                <el-button
                  type="warning"
                  size="small"
                  @click="copyImageLink(currentImage)"
                >
                  <el-icon><Link /></el-icon>
                  复制链接
                </el-button>
              </el-button-group>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      
      <!-- 导航按钮 -->
      <div v-if="imagesInView.length > 1" class="preview-navigation">
        <el-button
          :disabled="currentImageIndex === 0"
          @click="showPreviousImage"
          class="nav-btn"
        >
          <el-icon><ArrowLeft /></el-icon>
          上一张
        </el-button>
        <span class="nav-info">
          {{ currentImageIndex + 1 }} / {{ imagesInView.length }}
        </span>
        <el-button
          :disabled="currentImageIndex === imagesInView.length - 1"
          @click="showNextImage"
          class="nav-btn"
        >
          下一张
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search,
  Picture,
  View,
  Download,
  MagicStick,
  Connection,
  ChatLineRound,
  Link,
  ArrowLeft,
  ArrowRight
} from '@element-plus/icons-vue'

const router = useRouter()

// 搜索相关数据
const searchQuery = ref('')
const loading = ref(false)
const showResults = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

// 预览相关状态
const previewVisible = ref(false)
const currentImage = ref(null)
const currentImageIndex = ref(0)
const imagesInView = ref([])

// 搜索结果
const results = reactive({
  query: '',
  keywords: [],
  images: [],
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  }
})

// 搜索示例
const searchExamples = [
  '海边日落的风景照',
  '有猫咪的可爱照片',
  '婚礼现场的喜庆照片',
  '秋天的枫叶美景',
  '城市夜景灯光',
  '美食特写照片',
  '户外运动精彩瞬间',
  '家庭聚会合影'
]

// 移动端检测
const isMobile = computed(() => {
  return window.innerWidth <= 768
})

// 执行搜索
const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('请输入搜索内容')
    return
  }

  try {
    loading.value = true
    const token = localStorage.getItem('token')
    
    console.log('搜索请求:', {
      query: searchQuery.value.trim(),
      page: currentPage.value,
      limit: pageSize.value
    })
    
    const response = await fetch('/api/ai-image-search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: searchQuery.value.trim(),
        page: currentPage.value,
        limit: pageSize.value
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('搜索结果:', data)
      
      results.query = data.query
      results.keywords = data.keywords
      results.images = data.images
      results.pagination = data.pagination
      showResults.value = true
      
      if (data.images.length === 0) {
        ElMessage.info('未找到相关图片')
      } else {
        ElMessage.success(`找到 ${data.images.length} 张相关图片`)
      }
    } else {
      const errorData = await response.json()
      console.error('搜索失败响应:', errorData)
      ElMessage.error(errorData.error || '搜索失败')
      clearResults()
    }
  } catch (error) {
    console.error('AI搜索错误:', error)
    ElMessage.error('网络错误，请稍后重试')
    clearResults()
  } finally {
    loading.value = false
  }
}

// 清空搜索
const clearSearch = () => {
  searchQuery.value = ''
  clearResults()
}

// 清空结果
const clearResults = () => {
  showResults.value = false
  results.query = ''
  results.keywords = []
  results.images = []
  results.pagination = { page: 1, limit: 20, total: 0, pages: 0 }
  currentPage.value = 1
}

// 分页处理
const handleSizeChange = (newSize) => {
  pageSize.value = newSize
  currentPage.value = 1
  performSearch()
}

const handlePageChange = (newPage) => {
  currentPage.value = newPage
  performSearch()
}

// 查看图片详情
const viewImageDetails = (image) => {
  console.log('查看图片详情:', image)
  
  // 找到当前图片在搜索结果中的索引
  const index = results.images.findIndex(img => img.id === image.id)
  if (index !== -1) {
    currentImageIndex.value = index
    currentImage.value = image
    imagesInView.value = results.images
    previewVisible.value = true
  } else {
    ElMessage.warning('图片信息异常')
  }
}

// 关闭预览
const closePreview = () => {
  previewVisible.value = false
  currentImage.value = null
  currentImageIndex.value = 0
  imagesInView.value = []
}

// 显示上一张图片
const showPreviousImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
    currentImage.value = imagesInView.value[currentImageIndex.value]
  }
}

// 显示下一张图片
const showNextImage = () => {
  if (currentImageIndex.value < imagesInView.value.length - 1) {
    currentImageIndex.value++
    currentImage.value = imagesInView.value[currentImageIndex.value]
  }
}

// 复制图片链接
const copyImageLink = (image) => {
  const link = window.location.origin + image.displayUrl
  navigator.clipboard.writeText(link)
    .then(() => {
      ElMessage.success('链接已复制到剪贴板')
    })
    .catch(err => {
      console.error('复制失败:', err)
      ElMessage.error('复制失败')
    })
}

// 跳转到图库
const goToGallery = (image) => {
  // 关闭预览
  previewVisible.value = false
  
  // 跳转到图库页面
  router.push('/gallery')
  // 可以稍后添加滚动到特定图片的功能
  ElMessage.info('已跳转到图库页面')
}

// 格式化时间
const formatDateTime = (dateString) => {
  if (!dateString) return '未知时间'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    return '无效时间'
  }
}

// 下载图片
const downloadImage = async (image) => {
  try {
    ElMessage.info('开始下载...')
    
    const response = await fetch(image.displayUrl)
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // 获取文件扩展名
    const extension = getFileExtension(image.filename)
    const filename = image.filename.replace(/\.[^/.]+$/, "") || 'image'
    link.download = `${filename}${extension}`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success('下载完成')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败，请稍后重试')
  }
}

// 获取文件扩展名
const getFileExtension = (filename) => {
  const match = filename.match(/\.[^/.]+$/)
  return match ? match[0] : '.jpg'
}

// 文本截断
const truncateText = (text, maxLength) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

onMounted(() => {
  // 组件挂载时的初始化
})
</script>

<style scoped>
.ai-search-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.header-desc {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input-area {
  margin-bottom: 30px;
}

.search-input {
  margin-bottom: 16px;
}

.search-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.example-label {
  font-size: 14px;
  color: #666;
}

.example-tag {
  cursor: pointer;
  transition: all 0.2s;
}

.example-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 搜索结果区域 */
.search-results {
  margin-top: 24px;
}

.results-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e6e6e6;
}

.results-summary h3 {
  margin: 0 0 12px 0;
  color: #333;
}

.query-text {
  color: #409EFF;
  font-weight: 600;
}

.keywords-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.keyword-tag {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.image-card {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  transition: all 0.3s ease;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.result-thumbnail {
  width: 100%;
  height: 180px;
  display: block;
  object-fit: cover;
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
  align-items: center;
}

.tag-item {
  cursor: default;
}

.more-tags {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

.image-actions {
  display: flex;
  gap: 8px;
}

/* 空状态 */
.empty-results {
  padding: 40px 0;
}

.empty-actions {
  text-align: center;
  margin-top: 12px;
}

.empty-actions p {
  margin-bottom: 12px;
  color: #666;
}

/* 引导提示 */
.search-guide {
  padding: 40px 0;
}

.guide-icon {
  margin-bottom: 16px;
}

.guide-content {
  max-width: 600px;
  margin: 0 auto;
}

.guide-tips {
  text-align: left;
  padding-left: 20px;
  color: #666;
  line-height: 1.8;
}

.guide-tips li {
  margin-bottom: 8px;
}

/* 分页 */
.pagination-container {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

/* 图片预览样式 */
.image-preview {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-height: 70vh;
  overflow: auto;
}

@media (min-width: 768px) {
  .image-preview {
    flex-direction: row;
  }
}

.preview-main {
  flex: 1;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 60vh;
  width: auto;
  height: auto;
}

.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  gap: 10px;
  padding: 40px;
}

.preview-error .el-icon {
  font-size: 48px;
}

.preview-info {
  flex: 0 0 300px;
}

.info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.info-tag {
  margin: 2px;
}

.no-tags {
  color: #999;
  font-style: italic;
}

/* 导航按钮 */
.preview-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e6e6e6;
}

.nav-btn {
  min-width: 100px;
}

.nav-info {
  color: #666;
  font-size: 14px;
  min-width: 80px;
  text-align: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .ai-search-container {
    padding: 10px;
  }
  
  .search-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .search-input :deep(.el-input-group__append) {
    width: 100%;
    margin-top: 10px;
  }
  
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
  }
  
  .result-thumbnail {
    height: 140px;
  }
  
  .keywords-info {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .image-actions {
    flex-direction: column;
  }
  
  /* 移动端预览适配 */
  .image-preview {
    max-height: 50vh;
  }
  
  .preview-info {
    flex: none;
    width: 100%;
  }
  
  .preview-navigation {
    flex-direction: column;
    gap: 10px;
  }
  
  .nav-btn {
    width: 100%;
  }
}

/* 加载动画 */
:deep(.el-loading-mask) {
  background-color: rgba(255, 255, 255, 0.8);
}

:deep(.el-loading-spinner .circular) {
  width: 42px;
  height: 42px;
}
</style>