/**
 * localStorage 统一存取层：所有键带 collector: 前缀，便于全站备份与恢复。
 */
import type { BackupFile } from '@/types'

export const PREFIX = 'collector:'

export const KEYS = {
  settings: 'settings',
  currentDeckId: 'currentDeckId',
  userDecks: 'userDecks', // 用户新建/导入牌组的 DeckMeta 列表
  sessions: 'sessions', // { [sessionId]: StudySession }
  deckData: (deckId: string) => `deckData:${deckId}`, // 用户编辑后的牌组完整快照（DeckFile）
  progress: (deckId: string) => `progress:${deckId}` // { [cardId]: CardProgress }
} as const

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (e) {
    // 容量溢出等场景：控制台告警，避免应用崩溃
    console.error('[collector] localStorage 写入失败:', key, e)
  }
}

export function readString(key: string, fallback: string): string {
  const raw = localStorage.getItem(PREFIX + key)
  return raw === null ? fallback : raw
}

export function writeString(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch (e) {
    console.error('[collector] localStorage 写入失败:', key, e)
  }
}

export function removeKey(key: string): void {
  localStorage.removeItem(PREFIX + key)
}

/** 简单防抖（用于会话变更 300ms 落盘），带 cancel() 取消待执行的写入 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: A) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}

/** 导出全站应用数据（备份） */
export function exportBackup(): BackupFile {
  const data: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i)
    if (fullKey && fullKey.startsWith(PREFIX)) {
      try {
        data[fullKey] = JSON.parse(localStorage.getItem(fullKey) as string)
      } catch {
        /* 跳过损坏项 */
      }
    }
  }
  return {
    __collectorBackup: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  }
}

/** 恢复全站备份：清空 collector: 前缀键后完全覆盖 */
export function importBackup(backup: BackupFile): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i)
    if (fullKey && fullKey.startsWith(PREFIX)) toRemove.push(fullKey)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  Object.entries(backup.data).forEach(([k, v]) => {
    if (k.startsWith(PREFIX)) localStorage.setItem(k, v)
  })
}

export function isBackupFile(obj: unknown): obj is BackupFile {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as BackupFile).__collectorBackup === true &&
    typeof (obj as BackupFile).data === 'object'
  )
}

/** 触发浏览器下载一个 JSON 文件 */
export function downloadJSON(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 清理缓存：移除 localStorage 中全部 collector: 前缀的应用数据 */
export function clearAll(): void {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}
