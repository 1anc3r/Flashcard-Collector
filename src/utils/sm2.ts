/**
 * SM-2 简化算法：评分映射与熟练度判定。
 * 规则与需求文档严格对应。
 */
import type { CardProgress, Proficiency, Rating } from '@/types'

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

/** 一张全新卡片的默认学习数据 */
export function defaultProgress(): CardProgress {
  return {
    easeFactor: DEFAULT_EASE,
    interval: 1,
    repetitionCount: 0,
    dueDate: null,
    proficiency: 'unlearned',
    lastReviewedAt: null,
    everRated: false
  }
}

/**
 * 熟练度判定：
 * - 未学习：repetitionCount = 0 且从未评分
 * - 学习中：repetitionCount = 1
 * - 复习中：repetitionCount = 2
 * - 欠熟练：repetitionCount ≥ 3 且（interval < 7 天 或 easeFactor < 2.0）
 * - 已熟练：repetitionCount ≥ 3 且 interval ≥ 21 天 且 easeFactor ≥ 2.0
 *
 * 注：需求未覆盖的过渡区间（repetitionCount ≥ 3 且 7 ≤ interval < 21 且 easeFactor ≥ 2.0）
 * 归入"复习中"，表示已建立记忆但尚未达到长期熟练。
 */
export function computeProficiency(p: CardProgress): Proficiency {
  const rep = p.repetitionCount
  if (rep === 0) return 'unlearned'
  if (rep === 1) return 'learning'
  if (rep >= 3) {
    if (p.interval >= 21 && p.easeFactor >= 2.0) return 'mastered'
    if (p.interval < 7 || p.easeFactor < 2.0) return 'struggling'
    return 'reviewing'
  }
  return 'reviewing' // rep === 2
}

/** 在现有学习数据上应用一次评分，返回新的学习数据（不修改入参） */
export function applyRating(prev: CardProgress, rating: Rating): CardProgress {
  const next: CardProgress = { ...prev, everRated: true, lastReviewedAt: new Date().toISOString() }

  switch (rating) {
    case 'again':
      // 重来：repetitionCount 重置为 0，interval = 1 天，easeFactor = max(1.3, easeFactor - 0.2)，熟练度 = 未学习
      next.repetitionCount = 0
      next.interval = 1
      next.easeFactor = Math.max(MIN_EASE, round2(prev.easeFactor - 0.2))
      next.proficiency = 'unlearned'
      break
    case 'hard':
      // 困难：interval = max(1, interval × 1.2)，easeFactor = max(1.3, easeFactor - 0.15)
      next.repetitionCount = prev.repetitionCount
      next.interval = Math.max(1, round2(prev.interval * 1.2))
      next.easeFactor = Math.max(MIN_EASE, round2(prev.easeFactor - 0.15))
      next.proficiency = computeProficiency(next)
      break
    case 'good': {
      // 良好：repetitionCount += 1；rep 为 1 → interval = 1；为 2 → interval = 6；大于 2 → interval × easeFactor
      const rep = prev.repetitionCount + 1
      next.repetitionCount = rep
      if (rep === 1) next.interval = 1
      else if (rep === 2) next.interval = 6
      else next.interval = round2(prev.interval * prev.easeFactor)
      next.easeFactor = prev.easeFactor
      next.proficiency = computeProficiency(next)
      break
    }
    case 'easy':
      // 简单：repetitionCount += 1；interval ×= easeFactor × 1.3；easeFactor += 0.15
      next.repetitionCount = prev.repetitionCount + 1
      next.interval = round2(prev.interval * prev.easeFactor * 1.3)
      next.easeFactor = round2(prev.easeFactor + 0.15)
      next.proficiency = computeProficiency(next)
      break
  }

  // 更新下次到期日：今天 + interval 天
  const due = new Date()
  due.setDate(due.getDate() + Math.max(1, Math.round(next.interval)))
  next.dueDate = due.toISOString().slice(0, 10)

  return next
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 熟练度展示文案与标签类型 */
export const PROFICIENCY_META: Record<Proficiency, { label: string; tagType: 'info' | 'primary' | 'warning' | 'danger' | 'success' }> = {
  unlearned: { label: '未学习', tagType: 'info' },
  learning: { label: '学习中', tagType: 'primary' },
  reviewing: { label: '复习中', tagType: 'warning' },
  struggling: { label: '欠熟练', tagType: 'danger' },
  mastered: { label: '已熟练', tagType: 'success' }
}

/** 秒数格式化为 HH:MM:SS */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}
