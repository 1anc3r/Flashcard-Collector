/**
 * 牌组静态文件加载服务：
 * - DeckManifest 先加载；牌组文件懒加载 + 内存缓存。
 * - 路径使用 import.meta.env.BASE_URL 拼接，保证 GitHub Pages 子路径下可用。
 */
import type { DeckFile, DeckManifest } from '@/types'

const manifestCache: { value: DeckManifest | null } = { value: null }
const deckCache = new Map<string, DeckFile>()

function dataUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}data/${path}`
}

export async function fetchManifest(): Promise<DeckManifest> {
  if (manifestCache.value) return manifestCache.value
  const res = await fetch(dataUrl('DeckManifest.json'))
  if (!res.ok) throw new Error(`DeckManifest 加载失败（HTTP ${res.status}）`)
  const manifest = (await res.json()) as DeckManifest
  manifestCache.value = manifest
  return manifest
}

/** 懒加载单个牌组文件（带内存缓存）；force = true 时绕过缓存重新拉取 */
export async function fetchDeckFile(deckFile: string, force = false): Promise<DeckFile> {
  if (!force && deckCache.has(deckFile)) return deckCache.get(deckFile)!
  const res = await fetch(dataUrl(`decks/${deckFile}`))
  if (!res.ok) throw new Error(`牌组文件 ${deckFile} 加载失败（HTTP ${res.status}）`)
  const deck = (await res.json()) as DeckFile
  deckCache.set(deckFile, deck)
  return deck
}

export function clearDeckCache(deckFile?: string): void {
  if (deckFile) deckCache.delete(deckFile)
  else deckCache.clear()
}
