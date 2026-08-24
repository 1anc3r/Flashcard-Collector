<script setup lang="ts">
/**
 * 首页统计卡片：
 * - 学习量统计：日程表（日历热力图）/ 柱状图 / 折线图切换，维度为"学习天数"和"学习次数"；
 * - 卡片熟练度分布：饼图（未学习 / 学习中 / 复习中 / 欠熟练 / 已熟练）。
 * ECharts 仅在本组件内动态导入、按需注册。
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ECharts, EChartsCoreOption } from 'echarts/core'
import { useDeckStore } from '@/stores/deckStore'
import { useSessionStore } from '@/stores/sessionStore'
import { PROFICIENCY_META } from '@/utils/sm2'
import type { Proficiency } from '@/types'

const props = defineProps<{ deckId: string }>()

const deckStore = useDeckStore()
const sessionStore = useSessionStore()

type VolumeChartType = 'calendar' | 'bar' | 'line'
const volumeType = ref<VolumeChartType>('calendar')

const volumeEl = ref<HTMLElement>()
const pieEl = ref<HTMLElement>()
const volumeChart = shallowRef<ECharts | null>(null)
const pieChart = shallowRef<ECharts | null>(null)

type EChartsCore = typeof import('echarts/core')
let echarts: EChartsCore | null = null
let echartsReady = false

function dateKey(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 当前牌组每日学习次数（按评分时间聚合） */
const dailyCounts = computed<Map<string, number>>(() => {
  const map = new Map<string, number>()
  for (const s of Object.values(sessionStore.sessions)) {
    if (s.deckId !== props.deckId) continue
    for (const a of s.answeredCards) {
      const key = dateKey(a.timestamp)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  }
  return map
})

/** 最近 30 天的日期序列 */
const last30Days = computed<string[]>(() => {
  const days: string[] = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    days.push(dateKey(d.getTime()))
  }
  return days
})

/** 卡片熟练度分布 */
const proficiencyDist = computed<Array<{ name: string; value: number }>>(() => {
  const cards = deckStore.getCards(props.deckId)
  const counter: Record<Proficiency, number> = {
    unlearned: 0,
    learning: 0,
    reviewing: 0,
    struggling: 0,
    mastered: 0
  }
  cards.forEach((c) => {
    counter[c.proficiency]++
  })
  return (Object.keys(counter) as Proficiency[]).map((p) => ({
    name: PROFICIENCY_META[p].label,
    value: counter[p]
  }))
})

function buildVolumeOption(): EChartsCoreOption {
  const counts = dailyCounts.value
  if (volumeType.value === 'calendar') {
    // 日程表：近约 6 个月的学习热力（值为当天学习次数）
    const end = new Date()
    const start = new Date()
    start.setMonth(end.getMonth() - 5)
    start.setDate(1)
    const data: Array<[string, number]> = []
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = dateKey(cursor.getTime())
      data.push([key, counts.get(key) ?? 0])
      cursor.setDate(cursor.getDate() + 1)
    }
    const max = Math.max(1, ...data.map((d) => d[1]))
    return {
      tooltip: {
        formatter: (p: unknown) => {
          const item = p as { data: [string, number] }
          return `${item.data[0]}<br/>学习次数：${item.data[1]}`
        }
      },
      visualMap: {
        min: 0,
        max,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#ebedf0', '#9be9a8', '#40c463', '#216e39'] },
        text: ['多', '少']
      },
      calendar: {
        top: 30,
        left: 40,
        right: 20,
        bottom: 50,
        range: [dateKey(start.getTime()), dateKey(end.getTime())],
        cellSize: ['auto', 14],
        splitLine: { show: true },
        itemStyle: { borderWidth: 2, borderColor: 'rgba(0,0,0,0)' },
        dayLabel: { firstDay: 1, nameMap: 'ZH' },
        monthLabel: { nameMap: 'ZH' },
        yearLabel: { show: false }
      },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data }]
    }
  }
  // 柱状图 / 折线图：近 30 天，双系列——"学习次数"（当日评分次数）与"学习天数"（累计）
  const days = last30Days.value
  const countsSeries = days.map((d) => counts.get(d) ?? 0)
  let cumulative = 0
  // 累计学习天数：以当日是否有学习记录递增
  const studiedBefore = new Set<string>()
  for (const key of counts.keys()) {
    if ((counts.get(key) ?? 0) > 0 && key < days[0]) studiedBefore.add(key)
  }
  cumulative = studiedBefore.size
  const daysSeries = days.map((d) => {
    if ((counts.get(d) ?? 0) > 0) cumulative += 1
    return cumulative
  })
  const isBar = volumeType.value === 'bar'
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['学习次数', '学习天数（累计）'], bottom: 0 },
    grid: { top: 20, left: 40, right: 40, bottom: 50 },
    xAxis: {
      type: 'category',
      data: days.map((d) => d.slice(5)),
      axisLabel: { interval: 4 }
    },
    yAxis: [
      { type: 'value', name: '次数', minInterval: 1 },
      { type: 'value', name: '天数', minInterval: 1 }
    ],
    series: [
      {
        name: '学习次数',
        type: isBar ? 'bar' : 'line',
        data: countsSeries,
        itemStyle: { color: '#409eff' },
        smooth: true
      },
      {
        name: '学习天数（累计）',
        type: 'line',
        yAxisIndex: 1,
        data: daysSeries,
        itemStyle: { color: '#67c23a' },
        smooth: true,
        lineStyle: { type: 'dashed' }
      }
    ]
  }
}

function buildPieOption(): EChartsCoreOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} 张（{d}%）' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['38%', '65%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{c} 张' },
        data: proficiencyDist.value.map((d) => {
          const colorMap: Record<string, string> = {
            未学习: '#909399',
            学习中: '#409eff',
            复习中: '#e6a23c',
            欠熟练: '#f56c6c',
            已熟练: '#67c23a'
          }
          return { ...d, itemStyle: { color: colorMap[d.name] } }
        })
      }
    ]
  }
}

async function ensureECharts(): Promise<void> {
  if (echartsReady) return
  // 动态导入 + 按需注册（仅统计组件使用，不打入主包）
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers')
  ])
  core.use([
    charts.BarChart,
    charts.LineChart,
    charts.PieChart,
    charts.HeatmapChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.CalendarComponent,
    components.VisualMapComponent,
    renderers.CanvasRenderer
  ])
  echarts = core
  echartsReady = true
}

function renderCharts(): void {
  if (!echarts) return
  if (volumeEl.value) {
    if (!volumeChart.value) volumeChart.value = echarts.init(volumeEl.value)
    volumeChart.value.setOption(buildVolumeOption(), true)
  }
  if (pieEl.value) {
    if (!pieChart.value) pieChart.value = echarts.init(pieEl.value)
    pieChart.value.setOption(buildPieOption(), true)
  }
}

function onResize(): void {
  volumeChart.value?.resize()
  pieChart.value?.resize()
}

onMounted(async () => {
  await ensureECharts()
  renderCharts()
  window.addEventListener('resize', onResize)
})

watch([volumeType, dailyCounts, proficiencyDist, () => props.deckId], renderCharts)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  volumeChart.value?.dispose()
  pieChart.value?.dispose()
})
</script>

<template>
  <div class="home-stats">
    <div class="stats-block">
      <div class="stats-header">
        <span class="stats-title">学习量统计</span>
        <el-radio-group v-model="volumeType" size="small">
          <el-radio-button value="calendar">日程表</el-radio-button>
          <el-radio-button value="bar">柱状图</el-radio-button>
          <el-radio-button value="line">折线图</el-radio-button>
        </el-radio-group>
      </div>
      <div ref="volumeEl" class="chart volume-chart"></div>
    </div>
    <div class="stats-block">
      <div class="stats-header">
        <span class="stats-title">卡片熟练度分布</span>
      </div>
      <div ref="pieEl" class="chart pie-chart"></div>
    </div>
  </div>
</template>

<style scoped>
.home-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.stats-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-secondary, #909399);
}

.chart {
  width: 100%;
}

.volume-chart {
  height: 240px;
}

.pie-chart {
  height: 260px;
}
</style>
