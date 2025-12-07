<template>
  <div class="upload-container">
    <el-card>
      <template #header>
        <div class="upload-header">
          <h2>上传图片</h2>
          <p>支持 JPG、PNG、GIF 格式，单文件不超过 16MB</p>
        </div>
      </template>
      
      <el-upload
        class="upload-demo"
        drag
        multiple
        action="/api/images/upload"
        :headers="headers"
        :on-success="handleSuccess"
        :on-error="handleError"
        :before-upload="beforeUpload"
        :file-list="fileList"
        accept="image/*"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 jpg、png、gif 格式图片，单文件不超过 16MB
          </div>
        </template>
      </el-upload>
      
      <div v-if="uploadResults.length > 0" class="upload-results">
        <h3>上传结果</h3>
        <div v-for="result in uploadResults" :key="result.filename" class="result-item">
          <el-icon :color="result.success ? '#67c23a' : '#f56c6c'">
            <success-filled v-if="result.success" />
            <circle-close-filled v-else />
          </el-icon>
          <span class="filename">{{ result.filename }}</span>
          <span class="status" :class="result.success ? 'success' : 'error'">
            {{ result.message }}
          </span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  UploadFilled, 
  SuccessFilled, 
  CircleCloseFilled 
} from '@element-plus/icons-vue'

const fileList = ref([])
const uploadResults = ref([])

const headers = computed(() => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`
}))

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt16M = file.size / 1024 / 1024 < 16

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt16M) {
    ElMessage.error('图片大小不能超过 16MB!')
    return false
  }
  
  return true
}

const handleSuccess = (response) => {
  uploadResults.value.push({
    filename: response.image.filename,
    success: true,
    message: '上传成功'
  })
  
  ElMessage.success('上传成功')
}

const handleError = (error) => {
  const errorMessage = error.message || '上传失败'
  uploadResults.value.push({
    filename: '未知文件',
    success: false,
    message: errorMessage
  })
  
  ElMessage.error('上传失败')
}
</script>

<style scoped>
.upload-container {
  max-width: 800px;
  margin: 0 auto;
}

.upload-header {
  text-align: center;
}

.upload-header h2 {
  margin: 0 0 8px 0;
  color: #333;
}

.upload-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.upload-demo {
  margin-bottom: 20px;
}

.upload-results {
  margin-top: 30px;
}

.upload-results h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
}

.result-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.result-item:last-child {
  border-bottom: none;
}

.filename {
  flex: 1;
  margin: 0 15px;
  font-size: 14px;
  color: #333;
}

.status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.status.success {
  background: #f0f9ff;
  color: #67c23a;
}

.status.error {
  background: #fef0f0;
  color: #f56c6c;
}

@media (max-width: 768px) {
  .upload-container {
    padding: 10px;
  }
  
  .result-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .filename {
    margin: 0;
  }
}
</style>