<script setup lang="ts">
/**
 * 设置页：
 * (1) 外观偏好：主题（浅色 / 深色，默认浅色）、字号（小 / 标准 / 大）；
 * (2) 学习偏好：学习设置页参数（学习模式、学习量）自动记忆，每次进入自动恢复；
 * (3) 滑动切卡：开关，默认开启；
 * (4) 导入导出：导出牌组 / 备份全站数据 / 导入牌组 / 恢复备份。
 */
import { computed, onMounted, ref } from 'vue'
import { useDeckStore } from '@/stores/deckStore'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  collectBackup,
  downloadJSON,
  isBackupFile,
  restoreBackup
} from '@/utils/storage'
import type { DeckFile } from '@/types'

const deckStore = useDeckStore()
const settingsStore = useSettingsStore()
const isMobile = ref(window.innerWidth <= 768)

const currentDeck = computed(() => deckStore.currentDeck)

function onResize(): void {
  isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
  if (!deckStore.manifestLoaded) await deckStore.init()
  window.addEventListener('resize', onResize)
})

/* ---- 外观偏好 ---- */
const theme = computed({
  get: () => settingsStore.theme === 'dark',
  set: (v: boolean) => settingsStore.setTheme(v ? 'dark' : 'light')
})
const fontSize = computed({
  get: () => settingsStore.fontSize,
  set: (v: 'small' | 'standard' | 'large') => settingsStore.setFontSize(v)
})

/* ---- 滑动切卡 ---- */
const swipeEnabled = computed({
  get: () => settingsStore.swipeEnabled,
  set: (v: boolean) => settingsStore.setSwipeEnabled(v)
})

/* ---- (4) 导入导出 ---- */
const deckFileInput = ref<HTMLInputElement>()
const backupFileInput = ref<HTMLInputElement>()

/** 导出当前选中牌组的 JSON（仅 Deck 定义 + Cards，不含学习记录） */
async function onExportDeck(): Promise<void> {
  const deck = currentDeck.value
  if (!deck) {
    ElMessage.warning('当前没有可导出的牌组')
    return
  }
  await deckStore.ensureDeckLoaded(deck.id)
  const data = deckStore.exportDeckFile(deck.id)
  if (!data) {
    ElMessage.error('牌组数据尚未加载，请稍后重试')
    return
  }
  downloadJSON(`Deck_${deck.id}.json`, data)
  ElMessage.success(`已导出牌组：${deck.name}`)
}

/** 备份全站数据：导出包含所有 localStorage 数据的 JSON 文件 */
function onExportBackup(): void {
  downloadJSON(`collector_backup_${new Date().toISOString().slice(0, 10)}.json`, collectBackup())
  ElMessage.success('全站备份已导出')
}

/** 导入牌组 JSON：自动注册到牌组索引并写入 localStorage */
async function onImportDeckFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text) as unknown
    if (isBackupFile(json)) {
      ElMessage.warning('这是全站备份文件，请使用「恢复备份」功能导入')
      return
    }
    const meta = await deckStore.importDeckFile(json as Partial<DeckFile>)
    deckStore.setCurrentDeck(meta.id)
    ElMessage.success(`牌组「${meta.name}」已导入（${meta.cardCount} 张卡片）`)
  } catch (err) {
    ElMessage.error(`导入失败：${err instanceof Error ? err.message : String(err)}`)
  }
}

/** 恢复备份：完全覆盖 localStorage 并刷新页面（不可逆，先确认） */
async function onRestoreBackupFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text) as unknown
    if (!isBackupFile(json)) {
      ElMessage.error('备份文件格式不正确')
      return
    }
    await ElMessageBox.confirm(
      '恢复备份将完全覆盖当前全部本地数据（牌组、卡片、学习记录、设置偏好、会话状态），且不可撤销。确定继续吗？',
      '恢复备份',
      { type: 'warning', confirmButtonText: '覆盖并恢复', cancelButtonText: '取消' }
    )
    restoreBackup(json)
    ElMessage.success('备份已恢复，页面即将刷新')
    setTimeout(() => window.location.reload(), 600)
  } catch (err) {
    if (err === 'cancel') return
    ElMessage.error(`恢复失败：${err instanceof Error ? err.message : String(err)}`)
  }
}
</script>

<template>
  <div v-if="isMobile" class="brand" style="margin-bottom: 16px;">Collector<span>闪卡收藏家 · 设置</span></div>
  <div class="app-content">
    <!-- (1) 外观偏好 -->
    <el-card class="page-card" shadow="never">
      <div class="card-title"><span class="title-text">外观偏好</span></div>
      <el-form label-width="110px" style="margin-top: 12px; max-width: 560px">
        <el-form-item label="深色模式">
          <el-switch v-model="theme" active-text="深色" inactive-text="浅色" />
        </el-form-item>
        <el-form-item label="字号">
          <el-radio-group v-model="fontSize">
            <el-radio-button value="small">小</el-radio-button>
            <el-radio-button value="standard">标准</el-radio-button>
            <el-radio-button value="large">大</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- (2) 学习偏好 + (3) 滑动切卡 -->
    <el-card class="page-card" shadow="never">
      <div class="card-title"><span class="title-text">学习偏好</span></div>
      <el-form label-position="left" label-width="96px" style="margin-top: 12px; max-width: 560px">
        <el-form-item label="学习模式">
          <el-radio-group
            :model-value="settingsStore.study.mode"
            @change="(v: string | number | boolean | undefined) => settingsStore.setStudyParams({ mode: v === 'shuffled' ? 'shuffled' : 'sequential', count: settingsStore.study.count })"
          >
            <el-radio-button value="sequential">顺序学习模式</el-radio-button>
            <el-radio-button value="shuffled">乱序学习模式</el-radio-button>
          </el-radio-group>
          <div class="muted" style="margin-left: 12px">进入学习设置页时自动恢复</div>
        </el-form-item>
        <el-form-item label="学习量">
          <el-input-number
            :model-value="settingsStore.study.count"
            :min="1"
            :max="9999"
            :step="1"
            @change="(v: number | undefined) => settingsStore.setStudyParams({ mode: settingsStore.study.mode, count: v ?? 20 })"
          />
          <div class="muted" style="margin-left: 12px">默认值 20，进入学习设置页时自动恢复</div>
        </el-form-item>
        <el-form-item label="滑动切卡">
          <el-switch v-model="swipeEnabled" />
          <div class="muted" style="margin-left: 12px">开启后学习页支持左滑下一卡、右滑上一卡（移动端手势）</div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- (4) 导入导出 -->
    <el-card class="page-card" shadow="never">
      <div class="card-title"><span class="title-text">导入导出</span></div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px">
        <el-button type="warning" plain @click="onExportDeck" style="margin: 0px;">导出牌组 JSON</el-button>
        <el-button type="success" plain @click="deckFileInput?.click()" style="margin: 0px;">导入牌组 JSON</el-button>
        <el-button type="warning" plain @click="onExportBackup" style="margin: 0px;">导出备份 JSON</el-button>
        <el-button type="success" plain @click="backupFileInput?.click()" style="margin: 0px;">导入备份 JSON</el-button>
      </div>
      <el-alert type="info" :closable="false" show-icon style="margin-top: 12px">
        导出牌组：仅包含 Deck 定义 + Cards 数据（不含学习记录），用于分享；备份全站数据：包含牌组、卡片、学习记录、设置偏好、会话状态，用于完整恢复。
      </el-alert>
      <input
        ref="deckFileInput"
        type="file"
        accept=".json,application/json"
        style="display: none"
        @change="onImportDeckFile"
      />
      <input
        ref="backupFileInput"
        type="file"
        accept=".json,application/json"
        style="display: none"
        @change="onRestoreBackupFile"
      />
    </el-card>
  </div>
</template>
