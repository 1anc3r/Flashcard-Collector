<script setup lang="ts">
/**
 * 牌组管理页：新增模式（/deck/new）与编辑模式（/deck/:deckId）共用本 View。
 * (1) 牌组基本信息卡片：名称输入框；ID 自动由名称转拼音全拼（截断 20 字符，冲突加数字后缀）；
 *     新建模式实时更新建议 ID，编辑模式 ID 不可变更。
 * (2) 卡片列表卡片：关键词查询（卡号 / 正面 / 背面 / 章节 / 标签），新增 / 编辑 / 删除 / 批量删除。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Delete, Plus, Search } from '@element-plus/icons-vue'
import { useDeckStore } from '@/stores/deck'
import { nameToBaseId } from '@/utils/pinyin'
import { summarize } from '@/utils/text'
import type { Card } from '@/types'
import CardFormDialog from '@/components/CardFormDialog.vue'

const route = useRoute()
const router = useRouter()
const deckStore = useDeckStore()
const isMobile = ref(window.innerWidth <= 768)

/** 新增模式：无 deckId 路由参数 */
const isNewMode = computed(() => route.name === 'deck-new')
const deckId = computed(() => (route.params.deckId as string) || '')

const deckForm = reactive({ name: '', id: '' })
const savingDeck = ref(false)

const keyword = ref('')
const selectedCards = ref<Card[]>([])

const cards = computed<Card[]>(() => (deckId.value ? deckStore.getCards(deckId.value) : []))

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

function onResize(): void {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  if (!deckStore.manifestLoaded) await deckStore.init()
  if (isNewMode.value) {
    deckForm.name = ''
    deckForm.id = ''
  } else if (deckId.value) {
    await deckStore.ensureDeckLoaded(deckId.value)
    const meta = deckStore.allDecks.find((d) => d.id === deckId.value)
    if (!meta) {
      ElMessage.error('未找到该牌组')
      router.replace({ name: 'home' })
      return
    }
    deckForm.name = meta.name
    deckForm.id = meta.id
  }
  window.addEventListener('resize', onResize)
})

let saveTimer: number | null = null

/** 编辑模式：防抖自动持久化 */
function persist(): void {
  if (isNewMode.value) return
  if (saveTimer !== null) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(async () => {
    await onCreateBank()
  const base = nameToBaseId(deckForm.name)
  deckForm.id = base ? deckStore.suggestDeckId(deckForm.name) : ''
  }, 300)
}

async function onCreateBank(): Promise<void> {
  if (!deckForm.name.trim()) {
    ElMessage.warning('请输入牌组名称')
    return
  }
  savingDeck.value = true
  try {
    if (isNewMode.value) {
      const meta = await deckStore.createDeck(deckForm.name)
      ElMessage.success(`牌组已创建：${meta.name}`)
      router.replace({ name: 'deck-edit', params: { deckId: meta.id } })
    } else {
      deckStore.renameDeck(deckId.value, deckForm.name)
      ElMessage.success('牌组已保存')
    }
  } finally {
    savingDeck.value = false
  }
}

async function onDeleteDeck(): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除牌组「${deckForm.name}」吗？该操作不可恢复。`, '删除牌组', {
      type: 'error',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  await deckStore.deleteDeck(deckForm.id)
  ElMessage.success('题库已删除')
  router.replace('/')
}

/* ---- 卡片管理 ---- */
const cardDialogVisible = ref(false)
const editingCard = ref<Card | null>(null)

function openAddCard(): void {
  editingCard.value = null
  cardDialogVisible.value = true
}

function openEditCard(card: Card): void {
  editingCard.value = card
  cardDialogVisible.value = true
}

async function deleteCard(card: Card): Promise<void> {
  await ElMessageBox.confirm(`确定删除卡片「${card.id}」吗？该卡片的学习记录将一并删除。`, '删除卡片', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
  await deckStore.deleteCards(deckId.value, [card.id])
  ElMessage.success('已删除')
}

async function deleteCardBatch(): Promise<void> {
  const count = selectedCards.value.length
  if (count === 0) {
    ElMessage.warning('请先勾选要删除的卡片')
    return
  }
  await ElMessageBox.confirm(`确定删除选中的 ${count} 张卡片吗？相关学习记录将一并删除。`, '批量删除', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
  await deckStore.deleteCards(
    deckId.value,
    selectedCards.value.map((c) => c.id)
  )
  ElMessage.success(`已删除 ${count} 张卡片`)
}
</script>

<template>
  <div v-if="isMobile" class="brand" style="margin-bottom: 16px;">Collector<span>闪卡收藏家 · {{ isNewMode ? '新增牌组' : '编辑牌组' }}</span></div>
  <div class="app-content">
    <el-card class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">{{ isNewMode ? '新增牌组' : '编辑牌组' }}</span>
        <div>
          <el-button v-if="isNewMode" type="success" plain @click="onCreateBank">创建牌组</el-button>
          <el-button v-else type="danger" plain :icon="Delete" @click="onDeleteDeck">删除牌组</el-button>
          <el-button @click="router.back()">返回</el-button>
        </div>
      </div>

      <!-- (1) 牌组基本信息卡片 -->
      <el-form label-width="90px" style="margin-top: 16px;">
        <el-form-item label="牌组名称" required>
          <el-input v-model="deckForm.name" 
            :disabled="!isNewMode" 
            placeholder="如：199_管理类综合能力"
            maxlength="100"
            @input="persist" />
        </el-form-item>
        <el-form-item label="牌组 ID">
          <el-tag>{{ deckForm.id || '（由名称自动生成拼音 ID）' }}</el-tag>
          <span class="muted" style="margin-left: 8px">名称自动转拼音，用于创建牌组 ID</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- (2) 卡片列表卡片 -->
    <el-card v-if="!isNewMode" class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">卡片列表（{{ filteredCards.length }} / {{ cards.length }}）</span>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <el-button type="success" plain :icon="Plus" @click="openAddCard()"
            style="margin-left: 0px;">新增卡片</el-button>
        </div>
      </div>
      <el-input
        v-model="keyword"
        placeholder="搜索：卡号 / 正面 / 背面 / 章节 / 标签"
        clearable
        :prefix-icon="Search"
        style="margin: 12px 0"
      />
      <el-button v-if="selectedCards.length > 0" type="danger" plain :disabled="!selectedCards.length" @click="deleteCardBatch"
        style="margin-left: 0px;">
        批量删除（{{ selectedCards.length }}）
      </el-button>
      <el-table
        :data="filteredCards"
        style="width: 100%"
        max-height="520"
        @selection-change="(rows: Card[]) => (selectedCards = rows)"
      >
        <el-table-column type="selection" width="44" />
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
        <el-table-column label="章节" min-width="50" show-overflow-tooltip>
          <template #default="{ row }">{{ row.chapter || '—' }}</template>
        </el-table-column>
        <!-- <el-table-column label="标签" width="80" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-for="tag in row.tags" :key="tag" size="small" style="margin-right: 4px">
              {{ tag }}
            </el-tag>
            <span v-if="row.tags.length === 0" class="muted">—</span>
          </template>
        </el-table-column> -->
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
              <el-button link type="primary" @click="openEditCard(row)">编辑</el-button>
              <el-button link type="danger" @click="deleteCard(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无卡片，点击右上角「新增」创建第一张卡片" :image-size="80" />
        </template>
      </el-table>
    </el-card>

    <CardFormDialog
      v-if="!isNewMode"
      v-model="cardDialogVisible"
      :deck-id="deckId"
      :card="editingCard"
    />
  </div>
</template>
