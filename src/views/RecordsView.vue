<script setup lang="ts">
/**
 * 记录页：单卡片展示当前牌组的学习记录。
 * - 支持展开 / 折叠查看学习明细：卡号、正面（纯文本摘要）、背面（纯文本摘要）、熟练度；
 * - 列表按最近学习 / 评分时间倒序排列（未学习的卡片排在最后）。
 */
import { computed, onMounted } from 'vue'
import { useDeckStore } from '@/stores/deckStore'
import { PROFICIENCY_META } from '@/utils/sm2'
import { summarize } from '@/utils/text'
import type { Card } from '@/types'

const deckStore = useDeckStore()

const currentDeck = computed(() => deckStore.currentDeck)

/** 当前牌组的记录列表：最近学习 / 评分时间倒序，未学习（null）排最后 */
const records = computed<Card[]>(() => {
  if (!currentDeck.value) return []
  return [...deckStore.getCards(currentDeck.value.id)].sort((a, b) => {
    if (!a.lastReviewedAt && !b.lastReviewedAt) return 0
    if (!a.lastReviewedAt) return 1
    if (!b.lastReviewedAt) return -1
    return b.lastReviewedAt.localeCompare(a.lastReviewedAt)
  })
})

const ratedCount = computed(() => records.value.filter((c) => c.lastReviewedAt).length)

onMounted(async () => {
  if (!deckStore.manifestLoaded) await deckStore.init()
  if (currentDeck.value) await deckStore.ensureDeckLoaded(currentDeck.value.id)
})

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="app-content">
    <el-card class="page-card" shadow="never">
      <div class="card-title">
        <span class="title-text">
          学习记录（{{ currentDeck ? `${currentDeck.name}` : '' }}）
        </span>
        <span class="muted">已评分 {{ ratedCount }} / {{ records.length }} 张</span>
      </div>

      <el-empty v-if="records.length === 0" description="当前牌组暂无卡片" :image-size="80" />

      <el-collapse v-else style="margin-top: 12px">
        <el-collapse-item v-for="card in records" :key="card.id" :name="card.id">
          <template #title>
            <div
              style="
                display: flex;
                align-items: center;
                gap: 10px;
                width: 100%;
                min-width: 0;
                padding-right: 8px;
              "
            >
              <span
                style="
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  color: var(--c-text-secondary);
                  flex: none;
                "
              >
                {{ card.id.slice(-6) }}
              </span>
              <span
                style="
                  flex: 1;
                  min-width: 0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  font-size: 14px;
                "
              >
                {{ card.name || summarize(card.front, 30) || '（空）' }}
              </span>
              <el-tag :type="PROFICIENCY_META[card.proficiency].tagType" size="small">
                {{ PROFICIENCY_META[card.proficiency].label }}
              </el-tag>
            </div>
          </template>
          <div style="padding: 4px 8px 8px">
            <div class="muted" style="margin-bottom: 6px">
              最近学习 / 评分时间：{{ formatTime(card.lastReviewedAt) }} ｜ 复习次数：{{
                card.repetitionCount
              }}
              ｜ 间隔：{{ card.interval }} 天 ｜ 难度系数：{{ card.easeFactor }} ｜ 下次到期：{{
                card.dueDate ?? '—'
              }}
            </div>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="卡号">{{ card.id }}</el-descriptions-item>
              <el-descriptions-item label="正面">
                {{ summarize(card.front, 30) || '（空）' }}
              </el-descriptions-item>
              <el-descriptions-item label="背面">
                {{ summarize(card.back, 30) || '（空）' }}
              </el-descriptions-item>
              <el-descriptions-item label="熟练度">
                <el-tag :type="PROFICIENCY_META[card.proficiency].tagType" size="small">
                  {{ PROFICIENCY_META[card.proficiency].label }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>
