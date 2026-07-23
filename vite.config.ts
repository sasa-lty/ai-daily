import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 使用相对路径 './'，保证部署到 GitHub Pages 子路径（如 /repo-name/）时资源正常加载
export default defineConfig({
  base: './',
  plugins: [react()],
})
