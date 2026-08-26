<script setup lang="ts">
/**
 * 学习设置页：单卡片布局。
 * - 模式切换：顺序学习 / 乱序学习；
 * - 学习量：滑块 1 ~ 当前牌组卡片总数，步长 1，默认 20；
 * - 设置记忆：记住上次进入本页的全部参数，每次打开自动恢复；
 * - 点击"开始学习"创建新会话并进入卡片学习页。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDeckStore } from '@/stores/deckStore'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const deckStore = useDeckStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()
const isMobile = ref(window.innerWidth <= 768)

const total = computed(() => deckStore.currentCards.length)

// 进入页面时从设置偏好恢复上次参数
const mode = ref<'sequential' | 'shuffled'>(settingsStore.study.mode)
const count = ref<number>(Math.min(settingsStore.study.count || 20, Math.max(1, total.value || 20)))

function onResize(): void {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  if (!deckStore.manifestLoaded) await deckStore.init()
  const deck = deckStore.currentDeck
  if (!deck) {
    ElMessage.warning('请先创建或选择一个牌组')
    router.replace({ name: 'home' })
    return
  }
  await deckStore.ensureDeckLoaded(deck.id)
  // 牌组变化后校正学习量上限
  if (count.value > total.value) count.value = Math.max(1, total.value)
  window.addEventListener('resize', onResize)
})

function start(): void {
  const deck = deckStore.currentDeck
  if (!deck) return
  if (total.value === 0) {
    ElMessage.warning('当前牌组暂无卡片，请先新增卡片')
    return
  }
  // 记住本次参数（学习模式、学习量）
  settingsStore.setStudyParams({ mode: mode.value, count: count.value })
  const session = sessionStore.createSession(deck.id, mode.value, count.value)
  router.push({ name: 'study', params: { sessionId: session.sessionId } })
}
</script>

<template>
  <div class="app-content">
    <div v-if="isMobile" class="brand" style="margin-bottom: 16px;">Collector<span>闪卡收藏家 · 学习设置</span></div>
    <el-card class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">学习设置</span>
        <el-button size="small" @click="router.push({ name: 'home' })">返回首页</el-button>
      </div>

      <el-form label-position="top" style="margin-top: 16px; max-width: 560px">
        <el-form-item :label="`当前牌组：${deckStore.currentDeck?.name ?? '—'}（共 ${total} 张卡片）`">
        </el-form-item>

        <el-form-item label="学习模式">
          <el-radio-group
            v-model="mode" style="width: 100%">
            <el-radio-button value="sequential">顺序学习模式</el-radio-button>
            <el-radio-button value="shuffled">乱序学习模式</el-radio-button>
          </el-radio-group>
          <div class="muted" style="margin-left: 12px">进入学习设置页时自动恢复</div>
        </el-form-item>
        <el-form-item label="学习量">
          <el-input-number
            v-model="count"
            :min="1"
            :max="9999"
            :step="1"
          />
          <div class="muted" style="margin-left: 12px">默认值 20，进入学习设置页时自动恢复</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" @click="start">开始学习</el-button>
        </el-form-item>
      </el-form>

      <div class="muted">本页参数（学习模式、学习量）会自动记忆，下次进入时自动恢复。</div>
    </el-card>
  </div>
</template>
