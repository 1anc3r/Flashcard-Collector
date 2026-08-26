<script setup lang="ts">
/**
 * 应用导航栏：桌面端固定顶部；移动端固定页面最下端（图标 + 文字标签栏）。
 * 3 个入口：首页、记录、设置。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { HomeFilled, List, Tools } from '@element-plus/icons-vue'

const route = useRoute()

const items = [
  { path: '/', label: '首页', icon: HomeFilled },
  { path: '/records', label: '记录', icon: List },
  { path: '/settings', label: '设置', icon: Tools }
]

const currentPath = computed(() => route.path)

function isActive(path: string): boolean {
  if (path === '/') {
    return (
      currentPath.value === '/' ||
      currentPath.value.startsWith('/deck') ||
      currentPath.value.startsWith('/setup') ||
      currentPath.value.startsWith('/study')
    )
  }
  return currentPath.value.startsWith(path)
}
</script>

<template>
  <nav class="app-nav">
    <div class="brand">Collector<span>闪卡收藏家</span></div>
    <router-link
      v-for="item in items"
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <el-icon :size="18"><component :is="item.icon" /></el-icon>
      <span>{{ item.label }}</span>
    </router-link>
  </nav>
</template>
