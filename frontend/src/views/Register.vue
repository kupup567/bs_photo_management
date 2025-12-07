<template>
  <div class="register-container">
    <div class="register-background"></div>
    <el-card class="register-card">
      <template #header>
        <div class="register-header">
          <h2>用户注册</h2>
          <p>创建您的图片管理账户</p>
        </div>
      </template>
      
      <el-form
        ref="registerForm"
        :model="form"
        :rules="rules"
        label-width="0"
        size="large"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名（至少6位）"
            :prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item prop="email">
          <el-input
            v-model="form.email"
            placeholder="请输入邮箱"
            :prefix-icon="Message"
          />
        </el-form-item>
        
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码（至少6位）"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请确认密码"
            :prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleRegister"
            class="register-button"
          >
            {{ loading ? '注册中...' : '注册' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="register-footer">
        <span>已有账号？</span>
        <el-link type="primary" @click="$router.push('/login')">
          立即登录
        </el-link>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Message } from '@element-plus/icons-vue'

const router = useRouter()

const registerForm = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 6, message: '用户名至少6个字符', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const handleRegister = async () => {
  if (!registerForm.value) return
  
  try {
    const valid = await registerForm.value.validate()
    if (!valid) return
    
    loading.value = true
    
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: form.username,
        email: form.email,
        password: form.password
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      ElMessage.success('注册成功')
      localStorage.setItem('token', data.token)
      localStorage.setItem('userInfo', JSON.stringify(data.user))
      router.push('/')
    } else {
      ElMessage.error(data.error || '注册失败')
    }
  } catch (error) {
    ElMessage.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  position: relative;
}

.register-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: -1;
}

.register-card {
  width: 400px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.register-header {
  text-align: center;
}

.register-header h2 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 24px;
}

.register-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.register-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
}

.register-footer {
  text-align: center;
  margin-top: 20px;
  color: #666;
}

.register-footer .el-link {
  margin-left: 8px;
}

@media (max-width: 480px) {
  .register-card {
    width: 90%;
    margin: 20px;
  }
}
</style>