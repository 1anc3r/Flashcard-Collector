/**
 * 路由：必须使用 createWebHashHistory，避免 GitHub Pages 刷新 404。
 * 学习设置页、卡片学习页、牌组管理页等共用 View，通过会话 mode 或路由参数渲染差异。
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import RecordsView from '@/views/RecordsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import DeckManageView from '@/views/DeckManageView.vue'
import StudySetupView from '@/views/StudySetupView.vue'
import StudyView from '@/views/StudyView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/records', name: 'records', component: RecordsView },
    { path: '/settings', name: 'settings', component: SettingsView },
    // 牌组管理页：新增模式 / 编辑模式共用同一 View
    { path: '/deck/new', name: 'deck-new', component: DeckManageView },
    { path: '/deck/:deckId', name: 'deck-edit', component: DeckManageView, props: true },
    // 学习设置页（记住上次参数，自动恢复）
    { path: '/setup', name: 'study-setup', component: StudySetupView },
    // 卡片学习页：凭 sessionId 从本地存储恢复完整会话，不通过路由传配置
    {
      path: '/study/:sessionId',
      name: 'study',
      component: StudyView,
      props: true,
      meta: { immersive: true }
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.afterEach((to) => {
  document.title = to.meta.title ? `Collector · ${String(to.meta.title)}` : 'Collector · 闪卡收藏家'
})

export default router
