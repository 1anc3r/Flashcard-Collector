/**
 * 学习会话 Store：
 * - 创建 / 恢复会话（凭 sessionId 从 localStorage 恢复完整会话）；
 * - 评分后自动推进，防抖 300ms 落盘 + beforeunload 强制落盘（多标签 / 刷新安全）；
 * - 未完成会话检测（存在未评分卡片即视为未完成，无时间阈值）。
 */
import { defineStore } from 'pinia'
import type { Rating, StudySession } from '@/types'
import { KEYS, debounce, readJSON, writeJSON } from '@/utils/storage'
import { uuid } from '@/utils/uuid'
import { useDeckStore } from './deck'

type SessionMap = Record<string, StudySession>

function loadSessions(): SessionMap {
  return readJSON<SessionMap>(KEYS.sessions, {})
}

interface SessionState {
  sessions: SessionMap
  /** 当前活动会话（学习页使用中） */
  active: StudySession | null
  /** 当前活动会话的恢复基准：进入页面时的单调时钟秒数 */
  resumeAtMs: number
}

const persistSessions = debounce((sessions: SessionMap) => {
  writeJSON(KEYS.sessions, sessions)
}, 300)

function forcePersist(sessions: SessionMap): void {
  writeJSON(KEYS.sessions, sessions)
}

export const useSessionStore = defineStore('sessions', {
  state: (): SessionState => ({
    sessions: loadSessions(),
    active: null,
    resumeAtMs: 0
  }),

  getters: {
    /** 指定牌组是否有未完成会话（存在未评分卡片即视为未完成） */
    hasUnfinished:
      (state) =>
      (deckId: string): boolean => {
        return Object.values(state.sessions).some(
          (s) => s.deckId === deckId && !s.isCompleted && s.answeredCards.length < s.cardIds.length
        )
      }
  },

  actions: {
    /** 找出指定牌组最近一个未完成会话 */
    findUnfinished(deckId: string, sessions?: SessionMap): StudySession | null {
      const map = sessions ?? this.sessions
      const candidates = Object.values(map).filter(
        (s) => s.deckId === deckId && !s.isCompleted && s.answeredCards.length < s.cardIds.length
      )
      if (candidates.length === 0) return null
      candidates.sort((a, b) => b.startTime - a.startTime)
      return candidates[0]
    },

    /** 创建新会话并立即落盘 */
    createSession(deckId: string, mode: 'sequential' | 'shuffled', count: number): StudySession {
      const deckStore = useDeckStore()
      const allIds = deckStore.getCards(deckId).map((c) => c.id)
      let cardIds = [...allIds]
      if (mode === 'shuffled') {
        // Fisher-Yates 洗牌
        for (let i = cardIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[cardIds[i], cardIds[j]] = [cardIds[j], cardIds[i]]
        }
      }
      cardIds = cardIds.slice(0, Math.max(1, Math.min(count, cardIds.length)))
      const session: StudySession = {
        sessionId: uuid(),
        deckId,
        mode,
        cardIds,
        currentIndex: 0,
        answeredCards: [],
        startTime: Date.now(),
        elapsedTime: 0,
        isCompleted: false
      }
      this.sessions[session.sessionId] = session
      forcePersist(this.sessions)
      return session
    },

    /** 凭 sessionId 从 localStorage 恢复完整会话（多标签下以磁盘为准） */
    resumeSession(sessionId: string): StudySession | null {
      this.sessions = loadSessions()
      const session = this.sessions[sessionId]
      if (!session) return null
      this.active = session
      this.resumeAtMs = Date.now()
      return session
    },

    /** 当前活动会话的实时累计秒数（含恢复前的 elapsedTime） */
    liveElapsed(): number {
      if (!this.active) return 0
      if (this.active.isCompleted) return this.active.elapsedTime
      return this.active.elapsedTime + Math.floor((Date.now() - this.resumeAtMs) / 1000)
    },

    /** 把实时计时并入 elapsedTime（退出 / 完成 / 周期性落盘时调用） */
    settleTimer(): void {
      if (!this.active || this.active.isCompleted) return
      this.active.elapsedTime = this.liveElapsed()
      this.resumeAtMs = Date.now()
    },

    /**
     * 评分：写入学习数据 → 记录 answeredCards → 自动推进到下一张。
     * 返回 true 表示本会话已完成（最后一张已评分）。
     */
    rate(rating: Rating): boolean {
      const session = this.active
      if (!session || session.isCompleted) return true
      const cardId = session.cardIds[session.currentIndex]
      if (!cardId) return true

      const deckStore = useDeckStore()
      deckStore.rateCard(session.deckId, cardId, rating)

      // 同一张卡重复评分（右滑回看后改评）时覆盖旧记录
      const existing = session.answeredCards.findIndex((a) => a.cardId === cardId)
      const record = { cardId, rating, timestamp: Date.now() }
      if (existing >= 0) session.answeredCards.splice(existing, 1, record)
      else session.answeredCards.push(record)

      // 自动进入下一张未评分卡片；全部评分完成则会话结束
      const nextIndex = session.cardIds.findIndex(
        (id, idx) => idx > session.currentIndex && !session.answeredCards.some((a) => a.cardId === id)
      )
      if (nextIndex === -1) {
        // 检查是否仍存在未评分卡片（可能前面有跳过的）
        const anyUnrated = session.cardIds.findIndex(
          (id) => !session.answeredCards.some((a) => a.cardId === id)
        )
        if (anyUnrated === -1) {
          session.isCompleted = true
          this.settleTimer()
          this.persistActive()
          return true
        }
        session.currentIndex = anyUnrated
      } else {
        session.currentIndex = nextIndex
      }
      this.persistActive()
      return false
    },

    /** 滑动切卡：左滑下一卡 / 右滑上一卡（不评分，仅导航） */
    goTo(index: number): void {
      const session = this.active
      if (!session) return
      if (index < 0 || index >= session.cardIds.length) return
      session.currentIndex = index
      this.persistActive()
    },

    /** 防抖 300ms 落盘（评分 / 切卡后自动持久化） */
    persistActive(): void {
      if (!this.active) return
      this.sessions[this.active.sessionId] = { ...this.active }
      persistSessions(this.sessions)
    },

    /** beforeunload 强制落盘 */
    flushNow(): void {
      if (this.active && !this.active.isCompleted) this.settleTimer()
      if (this.active) this.sessions[this.active.sessionId] = { ...this.active }
      forcePersist(this.sessions)
    },

    /** 离开学习页：结算计时并落盘，清空活动会话 */
    leave(): void {
      if (this.active && !this.active.isCompleted) this.settleTimer()
      this.persistActive()
      this.flushNow()
      this.active = null
    }
  }
})

/** 注册 beforeunload 强制落盘（应用启动时调用一次） */
export function registerBeforeUnloadFlush(): void {
  window.addEventListener('beforeunload', () => {
    const store = useSessionStore()
    store.flushNow()
  })
}
