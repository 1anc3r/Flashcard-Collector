<script setup lang="ts">
/**
 * 学习设置页：单卡片布局。
 * - 模式切换：顺序学习 / 乱序学习；
 * - 章节 / 标签筛选：多选，空选表示不限，两者同时设置时取交集，应用到学习会话；
 * - 学习量：1 ~ 符合条件的卡片数，步长 1，默认 20；
 * - 设置记忆：记住上次进入本页的全部参数（含筛选），每次打开自动恢复；
 * - 点击"开始学习"创建新会话并进入卡片学习页。
 */
import { computed, onMounted, ref, watch } from 'vue'
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

// 进入页面时从设置偏好恢复上次参数（模式、学习量、章节 / 标签筛选）
const mode = ref<'sequential' | 'shuffled'>(settingsStore.study.mode)
const count = ref<number>(Math.min(settingsStore.study.count || 20, Math.max(1, total.value || 20)))
const chapters = ref<string[]>([...settingsStore.study.chapters])
const tags = ref<string[]>([...settingsStore.study.tags])

/** 当前牌组的全部章节选项（去重、去除空值） */
const chapterOptions = computed<string[]>(() => {
  const set = new Set<string>()
  deckStore.currentCards.forEach((c) => {
    if (c.chapter) set.add(c.chapter)
  })
  return [...set]
})

/** 当前牌组的全部标签选项（去重） */
const tagOptions = computed<string[]>(() => {
  const set = new Set<string>()
  deckStore.currentCards.forEach((c) => c.tags.forEach((t) => set.add(t)))
  return [...set]
})

/** 应用章节 / 标签筛选后的卡片数（空选 = 不限，两者同时设置取交集） */
const filteredTotal = computed(() => {
  return deckStore.currentCards.filter((c) => {
    if (chapters.value.length > 0 && !chapters.value.includes(c.chapter)) return false
    if (tags.value.length > 0 && !c.tags.some((t) => tags.value.includes(t))) return false
    return true
  }).length
})

// 筛选变化后校正学习量上限
watch(filteredTotal, (n) => {
  if (count.value > n) count.value = Math.max(1, n)
})

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
  // 清除当前牌组中已不存在的章节 / 标签选项（例如卡片被编辑或删除后）
  chapters.value = chapters.value.filter((c) => chapterOptions.value.includes(c))
  tags.value = tags.value.filter((t) => tagOptions.value.includes(t))
  // 牌组变化后校正学习量上限
  if (count.value > filteredTotal.value) count.value = Math.max(1, filteredTotal.value)
  window.addEventListener('resize', onResize)
})

function start(): void {
  const deck = deckStore.currentDeck
  if (!deck) return
  if (total.value === 0) {
    ElMessage.warning('当前牌组暂无卡片，请先新增卡片')
    return
  }
  if (filteredTotal.value === 0) {
    ElMessage.warning('当前筛选条件下没有符合条件的卡片，请调整章节或标签筛选')
    return
  }
  // 记住本次参数（学习模式、学习量、章节 / 标签筛选）
  settingsStore.setStudyParams({
    mode: mode.value,
    count: count.value,
    chapters: chapters.value,
    tags: tags.value
  })
  const session = sessionStore.createSession(deck.id, mode.value, count.value, {
    chapters: chapters.value,
    tags: tags.value
  })
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

        <el-form-item label="章节筛选（可多选，不选 = 不限章节）">
          <el-select
            v-model="chapters"
            multiple
            clearable
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="不限章节"
            style="width: 100%"
          >
            <el-option v-for="ch in chapterOptions" :key="ch" :value="ch" :label="ch" />
          </el-select>
        </el-form-item>

        <el-form-item label="标签筛选（可多选，不选 = 不限标签；与章节筛选取交集）">
          <el-select
            v-model="tags"
            multiple
            clearable
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="不限标签"
            style="width: 100%"
          >
            <el-option v-for="tag in tagOptions" :key="tag" :value="tag" :label="tag" />
          </el-select>
        </el-form-item>

        <el-form-item :label="`学习量（符合条件 ${filteredTotal} 张）`">
          <el-input-number
            v-model="count"
            :min="1"
            :max="Math.max(1, filteredTotal)"
            :step="1"
          />
          <div class="muted" style="margin-left: 12px">默认值 20，进入学习设置页时自动恢复</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" @click="start">开始学习</el-button>
        </el-form-item>
      </el-form>

      <div class="muted">本页参数（学习模式、学习量、章节 / 标签筛选）会自动记忆，下次进入时自动恢复。</div>
    </el-card>
  </div>
</template>
