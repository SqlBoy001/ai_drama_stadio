<template>
  <header class="studio-nav">
    <router-link class="studio-brand" to="/projects" aria-label="短剧工作室，返回项目"><span class="studio-mark">D<span>·</span></span><span>短剧工作室<small>DRAMA STUDIO</small></span></router-link>
    <nav aria-label="工作室导航">
      <router-link to="/create">AI 创作</router-link>
      <router-link to="/projects" :class="{ 'router-link-active': ['film', 'drama-detail'].includes(route.name) }">项目库</router-link>
      <router-link to="/agent-workbench">制作总控</router-link>
      <router-link to="/media-library">媒体素材</router-link>
    </nav>
    <div class="studio-tools"><router-link to="/ai-config" aria-label="模型设置"><el-icon><Setting /></el-icon><span>模型设置</span></router-link><button @click="toggle" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" :title="isDark ? '切换浅色主题' : '切换深色主题'"><el-icon><Sunny v-if="isDark"/><Moon v-else/></el-icon></button></div>
  </header>
</template>
<script setup>
import { useRoute } from 'vue-router'
import { Setting, Sunny, Moon } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
const route = useRoute()
const { isDark, toggle } = useTheme()
</script>
