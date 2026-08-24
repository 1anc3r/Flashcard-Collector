/**
 * 牌组 ID 生成：名称中的中文转完整拼音全拼，非中文字符直接保留（空白归一为下划线），
 * 截断至 20 字符作为基础 ID；冲突时由调用方追加 _1、_2 等数字后缀。
 */
import { pinyin } from 'pinyin-pro'

const MAX_ID_LENGTH = 20

export function nameToBaseId(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  // toneType: 'none' 去声调；nonZh: 'consecutive' 让连续非中文片段原样保留
  const full = pinyin(trimmed, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .join('')
    .replace(/\s+/g, '_') // 空白归一为下划线
    .replace(/_+/g, '_') // 合并连续下划线
    .replace(/^_+|_+$/g, '') // 去除首尾下划线
  return full.slice(0, MAX_ID_LENGTH)
}

/** 在已有 ID 集合中生成唯一 ID：基础 ID 冲突时追加 _1、_2 ... 直至唯一 */
export function uniqueId(baseId: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds)
  const base = baseId || 'deck'
  if (!existing.has(base)) return base
  let i = 1
  while (existing.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}
