/**
 * Collector 集卡者 — 全局类型定义
 * 数据结构与需求文档严格对应；Card 额外扩展了可选字段 name（卡片管理窗口的"卡片名称"，
 * 非必填、仅用于列表展示，向后兼容静态题库文件）。
 */

/** 牌组元数据索引（从 DeckManifest 加载后，合并用户新建牌组） */
export interface DeckMeta {
  id: string // 拼音全拼 ID
  name: string // 显示名称
  deckFile: string // 静态文件名（用户新建牌组可为空）
  cardCount: number
  isUserCreated: boolean // 区分静态文件牌组 vs 用户新建牌组
}

/** DeckManifest.json 文件结构 */
export interface DeckManifest {
  decks: Array<{
    id: string
    name: string
    deckFile: string
    cardCount: number
  }>
}

/** 静态牌组文件中的卡片（不含用户学习数据） */
export interface StaticCard {
  id: string
  chapter: string
  front: string // HTML 富文本
  back: string // HTML 富文本
  tags: string[]
  name?: string // 可选：卡片简短标题，用于列表展示
}

/** 静态牌组文件结构（导出牌组 JSON 同样使用该结构） */
export interface DeckFile {
  id: string
  name: string
  cardIds: string[]
  cards: StaticCard[]
}

/** 单张卡片的学习数据（存 localStorage，按牌组 + 卡片 ID 索引） */
export interface CardProgress {
  easeFactor: number // 默认 2.5
  interval: number // 默认 1（天）
  repetitionCount: number // 默认 0
  dueDate: string | null // ISO 日期字符串
  proficiency: Proficiency
  lastReviewedAt: string | null // ISO 时间字符串
  /** 是否曾经评过分（用于区分"重来后 repetitionCount=0"与"从未评分"） */
  everRated?: boolean
}

export type Proficiency = 'unlearned' | 'learning' | 'reviewing' | 'struggling' | 'mastered'

/** 单张卡片（运行时合并静态数据与用户学习数据） */
export interface Card extends StaticCard {
  easeFactor: number
  interval: number
  repetitionCount: number
  dueDate: string | null
  proficiency: Proficiency
  lastReviewedAt: string | null
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'

/** 学习会话 */
export interface StudySession {
  sessionId: string // UUID
  deckId: string
  mode: 'sequential' | 'shuffled'
  cardIds: string[] // 本次会话的卡片顺序
  currentIndex: number // 当前进行到的索引
  answeredCards: Array<{
    cardId: string
    rating: Rating
    timestamp: number
  }>
  startTime: number // 时间戳
  elapsedTime: number // 累计秒数（用于恢复计时器）
  isCompleted: boolean
}

/** 学习设置页参数（每次进入自动恢复） */
export interface StudyParams {
  mode: 'sequential' | 'shuffled'
  count: number // 学习量，默认 20
  chapters: string[] // 章节筛选（空数组 = 不限）
  tags: string[] // 标签筛选（空数组 = 不限）
}

/** 用户设置偏好 */
export interface AppSettings {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'standard' | 'large'
  swipeEnabled: boolean // 滑动切卡开关，默认开启
  study: StudyParams
}

/** 全站备份文件结构 */
export interface BackupFile {
  __collectorBackup: true
  version: 1
  exportedAt: string
  data: Record<string, string> // localStorage 中所有 collector: 前缀键值对
}
