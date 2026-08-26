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

// 必须使用 hash 模式：GitHub Pages 为纯静态托管，history 模式刷新会 404
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => HomeView, meta: { title: '首页' } },
    { path: '/records', name: 'records', component: () => RecordsView, meta: { title: '记录' } },
    { path: '/settings', name: 'settings', component: () => SettingsView, meta: { title: '设置' } },
    { path: '/deck/new', name: 'deck-new', component: () => DeckManageView, meta: { title: '牌组管理' } },
    { path: '/deck/:deckId', name: 'deck-edit', component: () => DeckManageView, meta: { title: '牌组管理' } , props: true },
    { path: '/setup', name: 'study-setup', component: () => StudySetupView, meta: { title: '学习设置' } },
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
