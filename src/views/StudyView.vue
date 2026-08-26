<script setup lang="ts">
/**
 * 卡片学习页（全屏沉浸式）：
 * - 顶部栏：退出按钮（返回首页）、会话总计时器、进度（第 N 张 / 共 M 张）；
 * - 初始仅展示正面 → "显示答案" → 展示背面 + 4 个评分按钮（重来 / 困难 / 良好 / 简单）；
 * - 评分按 SM-2 简化算法更新学习数据，自动进入下一张；最后一张评分后显示"学习完成"；
 * - 滑动切卡（设置页开关控制，默认开启）：左滑下一卡、右滑上一卡；
 * - 凭路由参数 sessionId 从 localStorage 恢复完整会话（含剩余卡片与计时器状态）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Clock } from '@element-plus/icons-vue'
import { useDeckStore } from '@/stores/deckStore'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { formatElapsed } from '@/utils/sm2'
import type { Card, Rating } from '@/types'
import RichText from '@/components/RichText.vue'

const props = defineProps<{ sessionId: string }>()

const router = useRouter()
const deckStore = useDeckStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

const session = computed(() => sessionStore.active)
const currentCard = computed<Card | null>(() => {
  const s = session.value
  if (!s) return null
  const cardId = s.cardIds[s.currentIndex]
  return cardId ? deckStore.getCard(s.deckId, cardId) : null
})

/** 背面是否已展示：已评分卡片回看时直接展示 */
const showBack = computed(() => {
  const s = session.value
  if (!s || !currentCard.value) return false
  return revealed.value || s.answeredCards.some((a) => a.cardId === currentCard.value!.id)
})
const revealed = ref(false)

/** 计时器显示值（每秒刷新） */
const elapsedDisplay = ref('00:00:00')
let timerHandle: ReturnType<typeof setInterval> | null = null

/** 会话完成 */
const completed = computed(() => Boolean(session.value?.isCompleted))

onMounted(async () => {
  if (!deckStore.manifestLoaded) await deckStore.init()
  const restored = sessionStore.resumeSession(props.sessionId)
  if (!restored) {
    ElMessage.error('未找到该学习会话，可能已被清除')
    router.replace({ name: 'home' })
    return
  }
  await deckStore.ensureDeckLoaded(restored.deckId)
  // 会话中的卡片若被删除，收敛 cardIds 并校正进度
  const validIds = restored.cardIds.filter((id) => deckStore.getCard(restored.deckId, id))
  if (validIds.length !== restored.cardIds.length) {
    restored.cardIds = validIds
    if (restored.currentIndex >= validIds.length) restored.currentIndex = Math.max(0, validIds.length - 1)
    sessionStore.persistActive()
  }
  if (restored.cardIds.length === 0) {
    ElMessage.warning('该会话的卡片已不存在')
    router.replace({ name: 'home' })
    return
  }
  timerHandle = setInterval(() => {
    elapsedDisplay.value = formatElapsed(sessionStore.liveElapsed())
  }, 1000)
  elapsedDisplay.value = formatElapsed(sessionStore.liveElapsed())
})

onBeforeUnmount(() => {
  if (timerHandle !== null) clearInterval(timerHandle)
  sessionStore.leave()
})

function exit(): void {
  sessionStore.leave()
  router.push({ name: 'home' })
}

function revealAnswer(): void {
  revealed.value = true
}

function rate(rating: Rating): void {
  const done = sessionStore.rate(rating)
  revealed.value = false
  elapsedDisplay.value = formatElapsed(sessionStore.liveElapsed())
  if (done) ElMessage.success('学习完成')
}

/* ---- 滑动切卡（移动端手势，设置页开关控制） ---- */
const touchStartX = ref(0)
const touchStartY = ref(0)

function onTouchStart(e: TouchEvent): void {
  if (!settingsStore.swipeEnabled) return
  const t = e.changedTouches[0]
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
}

function onTouchEnd(e: TouchEvent): void {
  if (!settingsStore.swipeEnabled || !session.value) return
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX.value
  const dy = t.clientY - touchStartY.value
  // 横向滑动距离超过 50px 且明显大于纵向位移才判定为切卡
  if (Math.abs(dx) < 50 || Math.abs(dy) > 80) return
  if (dx < 0) {
    // 左滑：下一卡
    sessionStore.goTo(session.value.currentIndex + 1)
  } else {
    // 右滑：上一卡
    sessionStore.goTo(session.value.currentIndex - 1)
  }
  revealed.value = false
}

const ratingButtons: Array<{ rating: Rating; label: string; color: string }> = [
  { rating: 'again', label: '重来', color: '#f56c6c' },
  { rating: 'hard', label: '困难', color: '#e6a23c' },
  { rating: 'good', label: '良好', color: '#409eff' },
  { rating: 'easy', label: '简单', color: '#67c23a' }
]
</script>

<template>
  <div class="study-page">
    <!-- (1) 顶部栏 -->
    <div class="study-top">
      <el-button :icon="ArrowLeft" text @click="exit">退出</el-button>
      <span class="timer">
        <el-icon><Clock /></el-icon>
        {{ elapsedDisplay }}
      </span>
      <span class="spacer"></span>
      <span v-if="session" class="progress">
        第 {{ session.currentIndex + 1 }} 张 / 共 {{ session.cardIds.length }} 张
      </span>
    </div>

    <!-- 学习完成 -->
    <div v-if="completed" class="study-done">
      <div class="done-text">🎉 学习完成</div>
      <div class="muted">
        本次共学习 {{ session?.cardIds.length ?? 0 }} 张卡片，用时 {{ elapsedDisplay }}
      </div>
      <el-button type="primary" size="large" @click="exit">返回首页</el-button>
    </div>

    <!-- (2) 卡片展示与评分 -->
    <div v-else-if="session && currentCard" class="study-body">
      <div class="flash-card" @touchstart="onTouchStart" @touchend="onTouchEnd">
        <div class="side-tag">正面 · {{ currentCard.id }}</div>
        <div class="flash-content">
          <RichText :content="currentCard.front" />
        </div>

        <template v-if="showBack">
          <hr class="flash-divider" />
          <div class="side-tag">背面解析</div>
          <div class="flash-content">
            <RichText :content="currentCard.back" />
          </div>
        </template>
      </div>

      <div class="study-actions">
        <el-button v-if="!showBack" type="primary" size="large" @click="revealAnswer">
          显示答案
        </el-button>
        <template v-else>
          <el-button
            v-for="btn in ratingButtons"
            :key="btn.rating"
            class="rate-btn"
            size="large"
            :style="{ backgroundColor: btn.color, borderColor: btn.color, color: '#fff' }"
            @click="rate(btn.rating)"
          >
            {{ btn.label }}
          </el-button>
        </template>
      </div>
    </div>
  </div>
</template>
