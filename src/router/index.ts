/**
 * 路由：必须使用 createWebHashHistory，避免 GitHub Pages 刷新 404。
 * 学习设置页、卡片学习页、牌组管理页等共用 View，通过会话 mode 或路由参数渲染差异。
 */
import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: '首页' } },
    { path: '/records', name: 'records', component: () => import('@/views/RecordsView.vue'), meta: { title: '记录' } },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '设置' } },
    // 牌组管理页：新增模式 / 编辑模式共用同一 View
    { path: '/deck/new', name: 'deck-new', component: () => import('@/views/DeckManageView.vue'), meta: { title: '牌组管理' } },
    { path: '/deck/:deckId', name: 'deck-edit', component: () => import('@/views/DeckManageView.vue'), meta: { title: '牌组管理' }, props: true },
    // 学习设置页（记住上次参数，自动恢复）
    { path: '/setup', name: 'study-setup', component: () => import('@/views/StudySetupView.vue'), meta: { title: '学习设置' } },
    // 卡片学习页：凭 sessionId 从本地存储恢复完整会话，不通过路由传配置
    {
      path: '/study/:sessionId',
      name: 'study',
      component: () => import('@/views/StudyView.vue'),
      meta: { title: '学习' }, 
      props: true
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.afterEach((to) => {
  document.title = to.meta.title ? `Collector · ${String(to.meta.title)}` : 'Collector · 闪卡收藏家'
})


export default router