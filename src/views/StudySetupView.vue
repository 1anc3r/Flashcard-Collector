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
import { useSettingsStore } from '@/stores/settingsStore'
import { useSessionStore } from '@/stores/sessionStore'

const router = useRouter()
const deckStore = useDeckStore()
const settingsStore = useSettingsStore()
const sessionStore = useSessionStore()

const total = computed(() => deckStore.currentCards.length)

// 进入页面时从设置偏好恢复上次参数
const mode = ref<'sequential' | 'shuffled'>(settingsStore.study.mode)
const count = ref<number>(Math.min(settingsStore.study.count || 20, Math.max(1, total.value || 20)))

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
    <el-card class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">学习设置</span>
        <el-button size="small" @click="router.push({ name: 'home' })">返回首页</el-button>
      </div>

      <el-form label-position="top" style="margin-top: 16px; max-width: 560px">
        <el-form-item :label="`当前牌组：${deckStore.currentDeck?.name ?? '—'}（共 ${total} 张卡片）`">
          <el-select v-model="mode" style="width: 100%">
            <el-option value="sequential" label="顺序学习模式" />
            <el-option value="shuffled" label="乱序学习模式" />
          </el-select>
        </el-form-item>

        <el-form-item :label="`学习量：${count} 张（范围 1 ~ ${Math.max(1, total)}）`">
          <el-slider
            v-model="count"
            :min="1"
            :max="Math.max(1, total)"
            :step="1"
            show-input
            :show-input-controls="false"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" @click="start">开始学习</el-button>
        </el-form-item>
      </el-form>

      <div class="muted">本页参数（学习模式、学习量）会自动记忆，下次进入时自动恢复。</div>
    </el-card>
  </div>
</template>
