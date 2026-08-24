# Collector · 集卡者

纯静态闪卡重复学习 Web 应用（类似 Anki），无后端、无登录。题库以 JSON 静态文件承载，用户数据（学习记录、设置、会话状态）全部保存在浏览器 localStorage，构建产物可直接发布到 GitHub Pages。

## 技术栈

- Vue 3（Composition API + `<script setup>`）+ TypeScript + Vite
- Pinia（状态管理）+ Vue Router（`createWebHashHistory`，避免 GitHub Pages 刷新 404）
- Element Plus（按需引入，`unplugin-auto-import` + `unplugin-vue-components`）
- ECharts（仅首页统计组件动态导入、按需注册）
- Fluent Editor（`@opentiny/fluent-editor`，卡片正/背面富文本：排版、图文并排、LaTeX 公式）
- KaTeX（公式渲染）、pinyin-pro（牌组 ID 拼音全拼生成）
- 不引入任何后端、数据库、鉴权、API Key

## 目录结构

```
collector/
├── .github/workflows/deploy.yml   # GitHub Pages 自动部署工作流
├── public/
│   └── data/
│       ├── DeckManifest.json      # 牌组索引（新增静态牌组只需加文件 + 在此登记）
│       └── decks/
│           └── Deck_fund_law.json # 示例牌组（基金从业资格，20 张卡片）
├── src/
│   ├── main.ts / App.vue / env.d.ts
│   ├── styles/index.css           # 主题变量、深浅色、字号档位、移动端自适应
│   ├── types/index.ts             # 全部数据结构定义
│   ├── utils/
│   │   ├── storage.ts             # localStorage 统一存取、防抖、备份/恢复
│   │   ├── text.ts                # 富文本转纯文本摘要（前 30 字）
│   │   ├── pinyin.ts              # 名称 → 拼音全拼 ID（截断 20 字符 + 冲突后缀）
│   │   ├── sm2.ts                 # SM-2 简化算法与熟练度判定
│   │   └── uuid.ts                # 会话 UUID
│   ├── services/deckService.ts    # DeckManifest 加载、牌组懒加载 + 内存缓存
│   ├── stores/
│   │   ├── settingsStore.ts       # 主题 / 字号 / 滑动切卡 / 学习参数记忆
│   │   ├── deckStore.ts           # 牌组与卡片 CRUD、学习数据覆盖层、导入导出
│   │   └── sessionStore.ts        # 会话创建/恢复/评分推进、防抖落盘 + beforeunload 强制落盘
│   ├── router/index.ts            # Hash 路由
│   ├── components/
│   │   ├── AppNav.vue             # 桌面顶部 / 移动端底部导航（首页、记录、设置）
│   │   ├── RichEditor.vue         # Fluent Editor 封装（图片 >500KB 提示不阻止）
│   │   ├── RichText.vue           # 富文本 + LaTeX 渲染
│   │   ├── CardFormDialog.vue     # 卡片管理窗口（新增/编辑）
│   │   └── HomeStats.vue          # 学习量统计（日程表/柱状图/折线图）+ 熟练度饼图
│   └── views/
│       ├── HomeView.vue           # 首页
│       ├── DeckManageView.vue     # 牌组管理页（新增/编辑共用）
│       ├── StudySetupView.vue     # 学习设置页
│       ├── StudyView.vue          # 卡片学习页（全屏沉浸式，sessionId 恢复会话）
│       ├── RecordsView.vue        # 记录页
│       └── SettingsView.vue       # 设置页（外观/学习偏好/滑动切卡/导入导出）
├── index.html / favicon.svg
├── vite.config.ts                 # base: './'，产物可部署到任意子路径
├── tsconfig.json / tsconfig.node.json
└── package.json
```

## 本地启动

要求 Node.js ≥ 18（推荐 20）。

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173/`）。

其他命令：

```bash
npm run build      # TypeScript 检查 + 生产构建（输出 dist/）
npm run build:only # 跳过 TS 检查，仅构建
npm run preview    # 本地预览构建产物
```

## GitHub Pages 部署

### 方式一：GitHub Actions（推荐）

1. 将本项目推送到 GitHub 仓库（默认分支 `main`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送到 `main` 分支即可自动构建并发布（工作流见 `.github/workflows/deploy.yml`）。
4. 发布后访问 `https://<用户名>.github.io/<仓库名>/`。

> 本项目的 `vite.config.ts` 使用 `base: './'` 相对路径、路由使用 Hash 模式，因此无需按仓库名修改配置，也不会出现刷新 404。

### 方式二：手动上传 `dist/`

```bash
npm run build
```

把 `dist/` 目录推到仓库的 `gh-pages` 分支（或使用 `gh-pages` 包 / Pages 的 "Deploy from a branch" 选项）即可。

## 数据说明

- **牌组与代码分离**：静态题库放在 `public/data/`，运行时通过 `fetch` 加载（路径用 `import.meta.env.BASE_URL` 拼接）。新增静态牌组 = 在 `public/data/decks/` 放一个 `Deck_*.json` 并在 `DeckManifest.json` 登记，无需改代码。
- **用户数据全在 localStorage**（键统一带 `collector:` 前缀）：
  - `settings`：主题 / 字号 / 滑动切卡 / 学习参数；
  - `currentDeckId`：当前牌组；
  - `userDecks`：用户新建/导入牌组的元数据；
  - `deckData:<deckId>`：用户编辑后的牌组完整快照（静态牌组被编辑后也在此存覆盖层，静态文件永不修改）；
  - `progress:<deckId>`：每张卡片的 SM-2 学习数据；
  - `sessions`：全部学习会话（含未完成会话，支持断点续答）。
- **断点续答**：每次评分后防抖 300ms 自动落盘，`beforeunload` 强制落盘；刷新或关闭重开后凭路由参数 `sessionId` 恢复完整会话；首页对存在未评分卡片的会话始终提示"继续上次学习"。
- **分享与迁移**：设置页支持导出单个牌组（仅 Deck + Cards，不含学习记录）、备份全站数据、导入牌组（ID 冲突自动加后缀）、恢复备份（覆盖本地全部数据并刷新）。

## SM-2 简化算法映射

| 评分 | 规则 |
| ---- | ---- |
| 重来 | repetitionCount 重置 0，interval = 1 天，easeFactor = max(1.3, easeFactor − 0.2)，熟练度 = 未学习 |
| 困难 | interval = max(1, interval × 1.2)，easeFactor = max(1.3, easeFactor − 0.15) |
| 良好 | repetitionCount += 1；rep=1 → interval=1，rep=2 → interval=6，rep>2 → interval × easeFactor |
| 简单 | repetitionCount += 1；interval ×= easeFactor × 1.3；easeFactor += 0.15 |

熟练度判定：未学习（rep=0 且从未评分）/ 学习中（rep=1）/ 复习中（rep=2）/ 欠熟练（rep≥3 且 interval<7 天或 easeFactor<2.0）/ 已熟练（rep≥3 且 interval≥21 天且 easeFactor≥2.0）。过渡区间（rep≥3 且 7≤interval<21 且 easeFactor≥2.0）按"复习中"处理。

## 备注

- `Card` 接口在需求数据结构基础上扩展了可选字段 `name`（卡片管理窗口的"卡片名称"，非必填、仅用于列表展示），向后兼容静态题库文件。
- 图片存储支持 Base64 内嵌与外链 URL 混合；粘贴/上传的单张图片超过 500KB 时提示"图片较大，建议使用外链以减小牌组体积"，不强制阻止。
