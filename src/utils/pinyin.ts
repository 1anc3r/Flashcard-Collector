/**
 * 牌组 ID 生成：名称中的中文转完整拼音全拼，非中文字符直接保留（空白归一为下划线），
 * 截断至 20 字符作为基础 ID；冲突时由调用方追加 _1、_2 等数字后缀。
 */
import { pinyin } from 'pinyin-pro'

export function nameToDeckId(name: string): string {
  const arr = pinyin(name, { toneType: 'none', type: 'array' })
  const joined = arr
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
  return joined || `bank_${Date.now().toString(36)}`
}

/** 在已有 ID 集合中生成唯一 ID：基础 ID 冲突时追加 _1、_2 ... 直至唯一 */
export function uniqueDeckkId(baseId: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds)
  const base = baseId || 'deck'
  if (!existing.has(base)) return base
  let i = 1
  while (existing.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}
