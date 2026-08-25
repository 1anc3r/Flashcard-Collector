<script setup lang="ts">
/**
 * 应用根组件：
 * - 启动时恢复设置偏好（主题 / 字号）、加载牌组索引、注册 beforeunload 强制落盘；
 * - 卡片学习页为全屏沉浸式（无导航栏、无页面留白）。
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import AppNav from '@/components/AppNav.vue'
import { useSettingsStore } from '@/stores/settings'
import { useDeckStore } from '@/stores/deck'
import { registerBeforeUnloadFlush } from '@/stores/session'

const route = useRoute()
const settingsStore = useSettingsStore()
const deckStore = useDeckStore()

const immersive = computed(() => Boolean(route.meta.immersive))

onMounted(() => {
  settingsStore.applyToDom()
  registerBeforeUnloadFlush()
  void deckStore.init()
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <AppNav v-if="!immersive" />
    <main class="app-main" :class="{ immersive }">
      <router-view />
    </main>
  </el-config-provider>
</template>
