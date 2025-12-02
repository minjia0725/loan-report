import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/loan-report/', // 設定您的 GitHub repo 名稱
  plugins: [vue()]
})
