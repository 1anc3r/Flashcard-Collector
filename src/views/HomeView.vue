<script setup lang="ts">
/**
 * 首页：
 * (2) 牌组切换区（下拉菜单 + 新增牌组按钮）；
 * (3) 统计卡片（学习量统计 + 熟练度分布，基于当前牌组）；
 * (4) 学习卡片（继续上次学习 / 开始学习）；
 * (5) 牌组卡片（卡片列表，关键字实时过滤，点击进入卡片管理窗口）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Edit, Plus, Search } from '@element-plus/icons-vue'
import { useDeckStore } from '@/stores/deckStore'
import { useSessionStore } from '@/stores/sessionStore'
import { summarize } from '@/utils/text'
import type { Card } from '@/types'
import HomeStats from '@/components/HomeStats.vue'
import CardFormDialog from '@/components/CardFormDialog.vue'

const router = useRouter()
const deckStore = useDeckStore()
const sessionStore = useSessionStore()
const isMobile = ref(window.innerWidth <= 768)

const keyword = ref('')

const currentDeck = computed(() => deckStore.currentDeck)
const cards = computed(() => deckStore.currentCards)

/** 关键字实时过滤（卡号 / 正面 / 背面 / 章节 / 标签） */
const filteredCards = computed<Card[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return cards.value
  return cards.value.filter((c) => {
    const haystack = [
      c.id,
      c.name ?? '',
      summarize(c.front, 1000),
      summarize(c.back, 1000),
      c.chapter,
      ...c.tags
    ]
      .join('\n')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

/** 当前牌组的未完成会话（存在未评分卡片即视为未完成） */
const unfinishedSession = computed(() =>
  currentDeck.value ? sessionStore.findUnfinished(currentDeck.value.id) : null
)

// 切换牌组时确保牌组内容已加载
watch(
  () => deckStore.currentDeckId,
  (id) => {
    if (id) void deckStore.ensureDeckLoaded(id)
  },
  { immediate: true }
)

function onSwitchDeck(deckId: string): void {
  deckStore.setCurrentDeck(deckId)
}

function goNewDeck(): void {
  router.push({ name: 'deck-new' })
}

function goEditDeck(): void {
  if (currentDeck.value) {
    router.push({ name: 'deck-edit', params: { deckId: currentDeck.value.id } })
  }
}

function continueStudy(): void {
  const s = unfinishedSession.value
  if (s) router.push({ name: 'study', params: { sessionId: s.sessionId } })
}

function startStudy(): void {
  if (!currentDeck.value) return
  if (cards.value.length === 0) {
    ElMessage.warning('当前牌组暂无卡片，请先新增卡片')
    return
  }
  router.push({ name: 'study-setup' })
}

/* ---- 卡片管理窗口（编辑模式） ---- */
const cardDialogVisible = ref(false)
const editingCard = ref<Card | null>(null)

function openCardEditor(card: Card): void {
  editingCard.value = card
  cardDialogVisible.value = true
}

function onResize(): void {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  window.addEventListener('resize', onResize)
})
</script>

<template>
  <div v-if="isMobile" class="brand" style="margin-bottom: 16px;">Collector<span>闪卡收藏家 · 首页</span></div>
  <div class="app-content">
    <el-alert
      v-if="deckStore.error"
      type="error"
      :title="`题库加载失败：${deckStore.error}`"
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- (2) 下拉菜单卡片：牌组切换区 -->
    <el-card class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">牌组</span>
        <el-button type="success" plain :icon="Plus" @click="goNewDeck">新增牌组</el-button>
      </div>
      <div style="margin-top: 12px">
        <el-select
          :model-value="deckStore.currentDeckId"
          placeholder="选择牌组"
          style="width: 100%"
          :loading="deckStore.loading"
          @change="onSwitchDeck"
        >
          <el-option
            v-for="deck in deckStore.allDecks"
            :key="deck.id"
            :value="deck.id"
            :label="`${deck.name}（共 ${deck.cardCount} 张卡片）`"
          >
            <span>{{ deck.name }}</span>
            <span class="muted" style="float: right">共 {{ deck.cardCount }} 张卡片</span>
          </el-option>
        </el-select>
      </div>
    </el-card>

    <template v-if="currentDeck">
      <!-- (3) 统计卡片（基于当前牌组） -->
      <el-card class="page-card" shadow="never">
        <div class="card-title">
          <span class="title-text">学习统计</span>
        </div>
        <HomeStats :deck-id="currentDeck.id" />
      </el-card>

      <!-- (4) 学习卡片（快速入口） -->
      <el-card class="page-card" shadow="never">
        <div class="card-title">
          <span class="title-text">学习</span>
        </div>
        
      <div v-if="unfinishedSession" style="margin-top: 12px">
        <el-alert type="success" :closable="false" show-icon>
          <template #title>
            检测到未完成的学习会话（第 {{ unfinishedSession.currentIndex + 1 }} / {{ unfinishedSession.cardIds.length }} 张）
          </template>
        </el-alert>
        <el-button type="success" size="large" style="flex: 1; width: 100%; margin-top: 12px"
          @click="continueStudy">继续上次学习</el-button>
      </div>
      <el-button type="primary" size="large" style="flex: 1; width: 100%; margin-top: 12px" @click="startStudy">开始学习</el-button>
      </el-card>

      <!-- (5) 牌组卡片（卡片列表） -->
      <el-card class="page-card" shadow="never">
        <div class="card-title">
          <span class="title-text">卡片列表（{{ filteredCards.length }} / {{ cards.length }}）</span>
        <el-button type="primary" plain :icon="Edit" @click="goEditDeck">编辑牌组</el-button>
        </div>
        <el-input
          v-model="keyword"
          placeholder="输入关键字实时过滤（卡号 / 正面 / 背面 / 章节 / 标签）"
          clearable
          :prefix-icon="Search"
          style="margin: 12px 0"
        />
        <el-table stripe :data="filteredCards">
            <el-table-column label="卡号" width="80">
              <template #default="{ row }">
                <span
                 :title="row.id"
                style="
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  color: var(--c-text-secondary);
                  flex: none;
                "
              >{{ row.id.slice(-6) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="卡面" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
              <div class="card-summary">
                <span class="summary-line">
                  <span class="side-label">正面</span>{{ summarize(row.front, 50) || '（空）' }}
                </span>
                <span class="summary-line">
                  <span class="side-label">背面</span>{{ summarize(row.back, 50) || '（空）' }}
                </span>
              </div>
              </template>
            </el-table-column>
        </el-table>
      </el-card>
    </template>

    <CardFormDialog
      v-if="currentDeck"
      v-model="cardDialogVisible"
      :deck-id="currentDeck.id"
      :card="editingCard"
    />
  </div>
</template>
