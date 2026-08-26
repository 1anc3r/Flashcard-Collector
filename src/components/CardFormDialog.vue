<script setup lang="ts">
/**
 * 卡片管理窗口：新增 / 编辑单张卡片。
 * 字段：卡片名称（非必填，用于列表展示）、章节、标签、正面知识点、背面解析。
 * 正面 / 背面使用 Fluent Editor（富文本排版、图文并排、LaTeX 公式）。
 */
import { computed, reactive, ref, watch } from 'vue'
import type { Card } from '@/types'
import { useDeckStore } from '@/stores/deckStore.js'
import RichEditor from './RichEditor.vue'

const props = defineProps<{
  modelValue: boolean
  deckId: string
  /** null 表示新增模式 */
  card: Card | null
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const deckStore = useDeckStore()
const isMobile = ref(window.innerWidth <= 768)

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const isEdit = computed(() => props.card !== null)
const dialogTitle = computed(() => (isEdit.value ? '编辑卡片' : '新增卡片'))

const form = reactive({
  name: '',
  chapter: '',
  tags: [] as string[],
  front: '',
  back: ''
})

const saving = ref(false)

/** 打开窗口时回填表单（编辑模式）或清空（新增模式） */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.name = props.card?.name ?? ''
    form.chapter = props.card?.chapter ?? ''
    form.tags = [...(props.card?.tags ?? [])]
    form.front = props.card?.front ?? ''
    form.back = props.card?.back ?? ''
  }
)

async function save(): Promise<void> {
  if (!form.front.trim() || form.front === '<p><br></p>') {
    ElMessage.warning('请填写正面知识点')
    return
  }
  if (!form.back.trim() || form.back === '<p><br></p>') {
    ElMessage.warning('请填写背面解析')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      chapter: form.chapter.trim(),
      tags: form.tags,
      front: form.front,
      back: form.back
    }
    if (isEdit.value && props.card) {
      await deckStore.updateCard(props.deckId, props.card.id, payload)
      ElMessage.success('卡片已更新')
    } else {
      await deckStore.addCard(props.deckId, payload)
      ElMessage.success('卡片已新增')
    }
    emit('saved')
    visible.value = false
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="dialogTitle" :close-on-click-modal="false" top="3vh" 
    :style="{ padding: '20px', width: isMobile ? '92%' : '60vw' }"
    class="card-form-dialog"
    destroy-on-close>
    <el-form label-width="90px">
      <el-form-item label="卡片名称">
        <el-input v-model="form.name" placeholder="卡片的简短标题" maxlength="60" show-word-limit />
          <span class="muted" style="margin-left: 8px">非必填，用于列表展示</span>
      </el-form-item>
      <el-form-item label="章节">
        <el-input v-model="form.chapter" placeholder="例如：第一章 金融市场与资产管理；第一节 金融市场" />
      </el-form-item>
      <el-form-item label="标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="输入后回车创建标签"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="正面问题" required>
        <RichEditor v-model="form.front" placeholder="请输入正面问题（支持富文本、图片、LaTeX 公式）"  style="width: 100%;"/>
      </el-form-item>
      <el-form-item label="背面解析" required>
        <RichEditor v-model="form.back" placeholder="请输入背面解析（支持富文本、图片、LaTeX 公式）"  style="width: 100%;"/>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>
