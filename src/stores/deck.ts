/**
 * 牌组 Store：
 * - 加载 DeckManifest 并合并用户新建 / 导入的牌组；
 * - 牌组文件懒加载 + 运行时合并学习数据（localStorage 覆盖层）；
 * - 牌组 / 卡片的增删改查，用户编辑结果写入 localStorage（静态文件永不修改）；
 * - 牌组导出与导入。
 */
import { defineStore } from 'pinia'
import type { Card, CardProgress, DeckFile, DeckMeta, Rating, StaticCard } from '@/types'
import { fetchDeckFile, fetchManifest } from '@/services/service'
import { KEYS, readJSON, removeKey, writeJSON, writeString, readString } from '@/services/storage'
import { applyRating, defaultProgress } from '@/utils/sm2'
import { nameToDeckId, uniqueDeckkId } from '@/utils/pinyin'

interface DeckState {
  manifestLoaded: boolean
  loading: boolean
  error: string
  staticDecks: DeckMeta[] // 来自 DeckManifest.json
  userDecks: DeckMeta[] // 用户新建 / 导入（localStorage）
  currentDeckId: string
  /** 牌组内容缓存：deckId -> 合并学习数据前的 DeckFile 快照 */
  deckContents: Record<string, DeckFile>
  /** 学习数据缓存：deckId -> { cardId -> CardProgress } */
  progressMap: Record<string, Record<string, CardProgress>>
}

function normalizeStaticCard(raw: Partial<StaticCard>, fallbackId: string): StaticCard {
  return {
    id: String(raw.id ?? fallbackId),
    chapter: String(raw.chapter ?? ''),
    front: String(raw.front ?? ''),
    back: String(raw.back ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    ...(raw.name ? { name: String(raw.name) } : {})
  }
}

/** manifest 初始化的并发去重：多个调用方（App onMounted、各页面 immediate watcher）共享同一次加载 */
let manifestPromise: Promise<void> | null = null

export const useDeckStore = defineStore('decks', {
  state: (): DeckState => ({
    manifestLoaded: false,
    loading: false,
    error: '',
    staticDecks: [],
    userDecks: readJSON<DeckMeta[]>(KEYS.userDecks, []),
    currentDeckId: readString(KEYS.currentDeckId, ''),
    deckContents: {},
    progressMap: {}
  }),

  getters: {
    /** 全部牌组元数据（静态 + 用户） */
    allDecks(state): DeckMeta[] {
      return [...state.staticDecks, ...state.userDecks]
    },
    currentDeck(): DeckMeta | null {
      return this.allDecks.find((d) => d.id === this.currentDeckId) ?? this.allDecks[0] ?? null
    },
    /** 当前牌组的运行时卡片（静态数据合并学习数据），按 cardIds 顺序排列 */
    currentCards(): Card[] {
      const deck = this.currentDeck
      if (!deck) return []
      const content = this.deckContents[deck.id]
      if (!content) return []
      const progress = this.progressMap[deck.id] ?? {}
      const byId = new Map(content.cards.map((c) => [c.id, c]))
      return content.cardIds
        .map((id) => byId.get(id))
        .filter((c): c is StaticCard => Boolean(c))
        .map((c) => ({ ...c, ...(progress[c.id] ?? defaultProgress()) }))
    }
  },

  actions: {
    /** 应用启动：加载 DeckManifest 并合并用户牌组（并发调用共享同一次加载，可安全重复调用） */
    async init(): Promise<void> {
      if (this.manifestLoaded) return
      if (!manifestPromise) {
        this.loading = true
        this.error = ''
        manifestPromise = (async () => {
          try {
            const manifest = await fetchManifest()
            this.staticDecks = (manifest.decks ?? []).map((d) => ({
              id: String(d.id),
              name: String(d.name),
              deckFile: String(d.deckFile),
              cardCount: Number(d.cardCount ?? 0),
              isUserCreated: false
            }))
            // 清理 userDecks 中与静态牌组重复的 ID（以静态为准的场景不会出现，防御性处理）
            const staticIds = new Set(this.staticDecks.map((d) => d.id))
            this.userDecks = this.userDecks.filter((d) => !staticIds.has(d.id))
            this.manifestLoaded = true
          } catch (e) {
            this.error = e instanceof Error ? e.message : String(e)
            // 失败时重置 promise，允许后续调用重试
            manifestPromise = null
          } finally {
            this.loading = false
          }
        })()
      }
      await manifestPromise
      if (!this.manifestLoaded) return // 加载失败（error 已记录）
      // 选定当前牌组
      if (!this.currentDeckId || !this.allDecks.some((d) => d.id === this.currentDeckId)) {
        this.setCurrentDeck(this.allDecks[0]?.id ?? '')
      }
      // 预载当前牌组
      if (this.currentDeckId) await this.ensureDeckLoaded(this.currentDeckId)
    },

    setCurrentDeck(deckId: string): void {
      this.currentDeckId = deckId
      writeString(KEYS.currentDeckId, deckId)
    },

    /** 确保牌组内容与学习数据已加载进内存 */
    async ensureDeckLoaded(deckId: string): Promise<void> {
      // manifest 未加载时先完成初始化——例如首页 immediate watcher 早于 App onMounted 触发，
      // 此时 staticDecks 尚为空，直接查 allDecks 会误判"未找到牌组"
      if (!this.manifestLoaded) await this.init()
      if (!this.deckContents[deckId]) {
        const meta = this.allDecks.find((d) => d.id === deckId)
        if (!meta) throw new Error(`未找到牌组：${deckId}`)
        // 用户编辑过的完整快照优先（用户新建牌组只有快照）；否则拉取静态文件
        const localSnapshot = readJSON<DeckFile | null>(KEYS.deckData(deckId), null)
        if (localSnapshot) {
          this.deckContents[deckId] = this.normalizeDeckFile(localSnapshot)
        } else if (meta.deckFile) {
          this.deckContents[deckId] = this.normalizeDeckFile(await fetchDeckFile(meta.deckFile))
        } else {
          this.deckContents[deckId] = { id: deckId, name: meta.name, cardIds: [], cards: [] }
        }
      }
      if (!this.progressMap[deckId]) {
        this.progressMap[deckId] = readJSON<Record<string, CardProgress>>(
          KEYS.progress(deckId),
          {}
        )
      }
    },

    normalizeDeckFile(raw: DeckFile): DeckFile {
      const cards = (raw.cards ?? []).map((c) => normalizeStaticCard(c, ''))
      const cardIds =
        Array.isArray(raw.cardIds) && raw.cardIds.length > 0
          ? raw.cardIds.map(String)
          : cards.map((c) => c.id)
      return { id: String(raw.id), name: String(raw.name), cardIds, cards }
    },

    /** 运行时卡片：静态数据 + 学习数据合并 */
    getCards(deckId: string): Card[] {
      const deck = this.deckContents[deckId]
      if (!deck) return []
      const progress = this.progressMap[deckId] ?? {}
      const byId = new Map(deck.cards.map((c) => [c.id, c]))
      return deck.cardIds
        .map((id) => byId.get(id))
        .filter((c): c is StaticCard => Boolean(c))
        .map((c) => ({
          ...c,
          ...(progress[c.id] ?? defaultProgress())
        }))
    },

    getCard(deckId: string, cardId: string): Card | null {
      return this.getCards(deckId).find((c) => c.id === cardId) ?? null
    },

    persistDeckData(deckId: string): void {
      const deck = this.deckContents[deckId]
      if (deck) writeJSON(KEYS.deckData(deckId), deck)
      this.syncCardCount(deckId)
    },

    persistProgress(deckId: string): void {
      writeJSON(KEYS.progress(deckId), this.progressMap[deckId] ?? {})
    },

    /** 同步 cardCount 到元数据（用户牌组写 localStorage；静态牌组仅更新内存显示） */
    syncCardCount(deckId: string): void {
      const count = this.deckContents[deckId]?.cardIds.length ?? 0
      const userDeck = this.userDecks.find((d) => d.id === deckId)
      if (userDeck) {
        userDeck.cardCount = count
        writeJSON(KEYS.userDecks, this.userDecks)
      }
      const staticDeck = this.staticDecks.find((d) => d.id === deckId)
      if (staticDeck) staticDeck.cardCount = count
    },

    persistUserDecks(): void {
      writeJSON(KEYS.userDecks, this.userDecks)
    },

    /** 由名称生成唯一牌组 ID（拼音全拼，截断 20 字符，冲突追加数字后缀） */
    suggestDeckId(name: string): string {
      return uniqueDeckkId(nameToDeckId(name), this.allDecks.map((d) => d.id))
    },

    /** 新建牌组（用户牌组，写入 localStorage） */
    async createDeck(name: string): Promise<DeckMeta> {
      const id = this.suggestDeckId(name)
      const meta: DeckMeta = {
        id,
        name: name.trim(),
        deckFile: '',
        cardCount: 0,
        isUserCreated: true
      }
      this.userDecks.push(meta)
      this.persistUserDecks()
      this.deckContents[id] = { id, name: meta.name, cardIds: [], cards: [] }
      this.persistDeckData(id)
      return meta
    },

    /** 重命名牌组（ID 不可变更） */
    renameDeck(deckId: string, name: string): void {
      const trimmed = name.trim()
      if (!trimmed) return
      const userDeck = this.userDecks.find((d) => d.id === deckId)
      if (userDeck) {
        userDeck.name = trimmed
        this.persistUserDecks()
      }
      const staticDeck = this.staticDecks.find((d) => d.id === deckId)
      if (staticDeck) staticDeck.name = trimmed
      const content = this.deckContents[deckId]
      if (content) {
        content.name = trimmed
        this.persistDeckData(deckId)
      }
    },

    /** 删除牌组（连同卡片与学习数据）。静态牌组删除后仅移除本地覆盖层。 */
    async deleteDeck(deckId: string): Promise<void> {
      const idx = this.userDecks.findIndex((d) => d.id === deckId)
      if (idx >= 0) {
        this.userDecks.splice(idx, 1)
        this.persistUserDecks()
      }
      removeKey(KEYS.deckData(deckId))
      removeKey(KEYS.progress(deckId))
      delete this.deckContents[deckId]
      delete this.progressMap[deckId]
      if (this.currentDeckId === deckId) {
        this.setCurrentDeck(this.allDecks[0]?.id ?? '')
      }
    },

    /** 生成下一张卡片 ID：deckId + '_' + 6 位序号（取现有最大序号 + 1） */
    nextCardId(deckId: string): string {
      const deck = this.deckContents[deckId]
      let max = 0
      const re = new RegExp(`^${deckId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)$`)
      for (const id of deck?.cardIds ?? []) {
        const m = id.match(re)
        if (m) max = Math.max(max, parseInt(m[1], 10))
      }
      return `${deckId}_${String(max + 1).padStart(6, '0')}`
    },

    async addCard(deckId: string, card: Omit<StaticCard, 'id'> & { id?: string }): Promise<Card> {
      await this.ensureDeckLoaded(deckId)
      const deck = this.deckContents[deckId]
      const id = card.id?.trim() || this.nextCardId(deckId)
      const staticCard = normalizeStaticCard({ ...card, id }, id)
      deck.cards.push(staticCard)
      deck.cardIds.push(id)
      this.persistDeckData(deckId)
      return { ...staticCard, ...defaultProgress() }
    },

    async updateCard(deckId: string, cardId: string, patch: Partial<StaticCard>): Promise<void> {
      await this.ensureDeckLoaded(deckId)
      const deck = this.deckContents[deckId]
      const target = deck.cards.find((c) => c.id === cardId)
      if (!target) return
      if (patch.name !== undefined) {
        if (patch.name) target.name = patch.name
        else delete target.name
      }
      if (patch.chapter !== undefined) target.chapter = patch.chapter
      if (patch.front !== undefined) target.front = patch.front
      if (patch.back !== undefined) target.back = patch.back
      if (patch.tags !== undefined) target.tags = patch.tags
      this.persistDeckData(deckId)
    },

    async deleteCards(deckId: string, cardIds: string[]): Promise<void> {
      await this.ensureDeckLoaded(deckId)
      const deck = this.deckContents[deckId]
      const ids = new Set(cardIds)
      deck.cards = deck.cards.filter((c) => !ids.has(c.id))
      deck.cardIds = deck.cardIds.filter((id) => !ids.has(id))
      // 同步清理这些卡片的学习数据
      const progress = this.progressMap[deckId] ?? {}
      cardIds.forEach((id) => delete progress[id])
      this.persistProgress(deckId)
      this.persistDeckData(deckId)
    },

    /** 对单张卡片应用评分（SM-2 简化算法），并立即持久化学习数据 */
    rateCard(deckId: string, cardId: string, rating: Rating): void {
      if (!this.progressMap[deckId]) this.progressMap[deckId] = {}
      const prev = this.progressMap[deckId][cardId] ?? defaultProgress()
      this.progressMap[deckId][cardId] = applyRating(prev, rating)
      this.persistProgress(deckId)
    },

    /** 导出当前牌组（仅 Deck 定义 + Cards，不含学习记录） */
    exportDeckFile(deckId: string): DeckFile | null {
      const deck = this.deckContents[deckId]
      if (!deck) return null
      return JSON.parse(JSON.stringify(deck)) as DeckFile
    },

    /**
     * 导入牌组 JSON：自动注册到牌组索引（用户牌组）并写入 localStorage。
     * ID 冲突时自动追加数字后缀；返回最终牌组元数据。
     */
    async importDeckFile(raw: unknown): Promise<DeckMeta> {
      const obj = raw as Partial<DeckFile>
      if (!obj || typeof obj.name !== 'string' || !Array.isArray(obj.cards)) {
        throw new Error('牌组文件格式不正确：缺少 name 或 cards 字段')
      }
      const normalized = this.normalizeDeckFile({
        id: String(obj.id ?? ''),
        name: obj.name,
        cardIds: Array.isArray(obj.cardIds) ? obj.cardIds : [],
        cards: obj.cards as StaticCard[]
      })
      const id = uniqueDeckkId(nameToDeckId(normalized.id || normalized.name) || 'deck', [
        ...this.allDecks.map((d) => d.id),
        ...this.userDecks.map((d) => d.id)
      ])
      normalized.id = id
      const meta: DeckMeta = {
        id,
        name: normalized.name,
        deckFile: '',
        cardCount: normalized.cardIds.length,
        isUserCreated: true
      }
      this.userDecks.push(meta)
      this.persistUserDecks()
      this.deckContents[id] = normalized
      this.persistDeckData(id)
      return meta
    }
  }
})
