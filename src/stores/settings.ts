/**
 * 设置偏好 Store：主题、字号、滑动切卡、学习设置页参数记忆。
 * 全部持久化到 localStorage，并在变更时即时落盘 + 应用到 DOM。
 */
import { defineStore } from 'pinia'
import type { AppSettings, StudyParams } from '@/types'
import { KEYS, readJSON, writeJSON } from '@/services/storage'

function loadSettings(): AppSettings {
  const stored = readJSON<Partial<AppSettings>>(KEYS.settings, {})
  return {
    theme: stored.theme === 'dark' ? 'dark' : 'light',
    fontSize:
      stored.fontSize === 'small' || stored.fontSize === 'large' ? stored.fontSize : 'standard',
    swipeEnabled: stored.swipeEnabled !== false,
    study: {
      mode: stored.study?.mode === 'shuffled' ? 'shuffled' : 'sequential',
      count:
        typeof stored.study?.count === 'number' && stored.study.count >= 1
          ? Math.floor(stored.study.count)
          : 20,
      chapters: Array.isArray(stored.study?.chapters) ? stored.study.chapters.map(String) : [],
      tags: Array.isArray(stored.study?.tags) ? stored.study.tags.map(String) : []
    }
  }
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

function applyFontSize(fontSize: AppSettings['fontSize']): void {
  document.body.classList.remove('font-small', 'font-standard', 'font-large')
  document.body.classList.add(`font-${fontSize}`)
}

export const useSettingsStore = defineStore('settings', {
  state: (): AppSettings => loadSettings(),
  actions: {
    /** 应用启动时调用：把持久化的偏好应用到 DOM */
    applyToDom(): void {
      applyTheme(this.theme)
      applyFontSize(this.fontSize)
    },
    persist(): void {
      const snapshot: AppSettings = {
        theme: this.theme,
        fontSize: this.fontSize,
        swipeEnabled: this.swipeEnabled,
        study: this.study
      }
      writeJSON(KEYS.settings, snapshot)
    },
    setTheme(theme: 'light' | 'dark'): void {
      this.theme = theme
      applyTheme(theme)
      this.persist()
    },
    setFontSize(fontSize: AppSettings['fontSize']): void {
      this.fontSize = fontSize
      applyFontSize(fontSize)
      this.persist()
    },
    setSwipeEnabled(enabled: boolean): void {
      this.swipeEnabled = enabled
      this.persist()
    },
    /** 记住学习设置页的全部参数（学习模式、学习量、章节 / 标签筛选）；部分更新，未传字段保持原值 */
    setStudyParams(params: Partial<StudyParams>): void {
      this.study = {
        mode: params.mode ?? this.study.mode,
        count:
          params.count !== undefined ? Math.max(1, Math.floor(params.count)) : this.study.count,
        chapters: params.chapters ?? this.study.chapters,
        tags: params.tags ?? this.study.tags
      }
      this.persist()
    }
  }
})
