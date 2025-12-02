# BananaPod 项目状态记录
 
## 统一执行计划（合并）

### 背景和动机
- 统一源码入口至 `src/`，减少并行目录导致的重复与歧义。
- 模块化拆分核心逻辑，降低耦合并控制单文件 ≤250 行。
- 引入 PodUI 主题与通用基础组件，确保视觉一致且易于演进。
- 统一服务层与 i18n 位置，建立兼容层与路径别名以平滑迁移。

### 关键挑战和分析
- 双入口与跨源根引用（根与 `src` 并行、Worker/服务/i18n 分散）。
- 核心逻辑集中于 `App.tsx`，多功能交织、类型与状态复杂。
- 主题替换与交互回归风险；浏览器/服务端双环境下存储适配一致性。

### 执行顺序（分阶段、可回滚）
1. 基线分析与清单输出（重复/废弃/跨源根/拆分候选/样式硬编码/i18n）
2. UI 主题引入与顶层容器应用（`podui-theme-dark`）
3. 兼容层与路径别名搭建（re-export/`@` 指向 `src`）
4. 模块化迁移（boards/prompt/toolbar/settings 等），逐模块回归
5. i18n 归档与统一（迁移至 `src/i18n` 并提供钩子）
6. 清理与收尾（删除废弃文件、修正导入路径、更新经验记录）

### 高层任务拆分
- 服务层统一与桥接
- 组件迁移与桥接（分批次）
- Worker 引用统一
- 通用 UI 抽取与集成
- 主题与 tokens 落地与验证
- i18n 归档与兼容钩子
- 路径别名切换与导入修正
- 验收脚本与交互回归

### 成功标准
- 统一入口与目录布局，兼容层稳定，重构后 `lint/build/preview` 均通过。
- 执行看板中所有项完成并记录验证结果，无关键回归。

### 风险与缓解
- 入口冲突/路径异常：先桥接后切换别名，必要时回滚。
- Worker 与存储失效：统一位置与 `new URL(..., import.meta.url)` 语法。
- 视觉回归：先变量覆盖后组件替换，逐步验收 hover/active/focus-visible/disabled。

### 验收门槛
- 每阶段 `npm run lint`、`npx tsc --noEmit`、`npm run build`、`vite preview` 通过。
- 场景回归：画布、历史缩略图、导入、语言切换、Prompt 生成/编辑。

### 项目执行与状态看板（合并）
- [x] 服务层迁移：`services/geminiService.ts`、`services/httpClient.ts` → `src/services/api/*`（保留根 re-export）
- [x] 组件迁移第一批：`components/BoardPanel.tsx`、`components/LayerPanel.tsx` → `src/features/boards/*`（保留根桥接）
- [x] Worker 引用修正：统一 `new URL(..., import.meta.url)` 路径策略
- [x] i18n 桥接：新增 `src/i18n/translations.ts` 与 `useI18n` 钩子，根 `translations.ts` re-export
- [x] 顶层应用主题：在 `index.tsx` 应用 `podui-theme-dark` 并验收
- [x] 文档更新：同步 `.trae/scratchpad.md` 状态与队列
- [x] Toolbar 迁移与桥接：`src/features/toolbar/Toolbar.tsx`
- [x] PromptBar 迁移与桥接：`src/features/prompt/PromptBar.tsx`
- [x] QuickPrompts 迁移与桥接：`src/features/prompt/QuickPrompts.tsx`
- [x] 通用 UI 抽取与集成：`src/ui/*`（Panel/IconButton/Button/Chip/MenuItem/Toolbar/Select/Textarea）
- [x] Button 组件扩展：variants/sizes 并在 Toolbar/CanvasSettings 应用
- [x] BoardPanel 拆分与瘦身：单文件 ≤250 行
- [x] 路径别名切换准备与执行：将 `@` 指向 `src` 并验证
- [x] BananaSidebar 迁移与桥接：`src/features/sidebar/BananaSidebar.tsx`，根导出代理保持兼容
- [x] CanvasSettings 迁移并集成 Input：`src/features/settings/CanvasSettings.tsx` 使用 `src/ui/Input.tsx`
 - [x] 修复 `src/App.tsx` 类型错误（handleUngroup）并重新纳入 TS 检查
- [x] 验证所有迁移组件的功能与引用（PromptBar/Sidebar/Boards/SessionRestoreDialog）
- [x] 迁移剩余根组件或确认根目录仅保留配置与入口
- [x] 阶段验收：`npm run lint`、`npx tsc --noEmit`、`npm run build` 与预览交互回归

## 执行日志 (2025-12-02)
- **完成 src/App.tsx 修复**：将根目录 `App.tsx` 的完整逻辑迁移至 `src/App.tsx`，并修正了所有相对引用（指向 `@/features`, `@/services` 等）。
- **切换入口**：修改 `index.tsx` 导入路径为 `import App from '@/App'`，正式启用 `src/App.tsx`。
- **清理冗余**：删除了根目录下的 `App.tsx`, `types.ts`, `translations.ts`, `components/`, `hooks/`, `services/`, `utils/`。
- **恢复必要文件**：发现 `src/utils/retry.ts` 为 re-export，从 git 恢复了原文件并覆盖迁移；确认 `src/components/BananaSidebar.tsx` 为废弃桥接文件并删除。
- **最终验证**：`npx tsc --noEmit` 与 `npm run build` 均通过。
## 代码基线分析计划（准备工作，2025-12-02）

### 背景和动机
- 为 UI 主题计划与模块化重构计划提供可靠底座：全面盘点代码结构、依赖与资产，找出重复/废弃文件与潜在问题，制定整理清单。
- 统一源码入口位置与目录布局，减少“根目录 vs src”双入口造成的重复与歧义，降低后续迁移成本。

### 关键挑战和分析
- 存在“根目录与 src 并行”的源码分布（如 `App.tsx` 与 `src/App.tsx`、`components/*` 与 `src/components/*`），需要确认哪一侧为权威入口并统一。
- Worker 文件从根组件引用 `../src/workers/...`，表明路径跨越两个源根，后续重构需收敛到 `src/`。
- i18n 与主题样式分散：`translations.ts` 位于根目录；主题变量在 `src/styles/podui.css` 规划中，需归档到统一层。
- 服务端/浏览器双环境已适配（`boardsStorage.ts`），需确保不存在旧版存储实现残留与重复。

### 分析范围与方法
- 目录与文件：
  - 枚举 `*.ts, *.tsx, *.js, *.jsx, *.css, *.html, *.md`，按相对路径归类，标记“重复命名/并行目录（root vs src）”。
  - 搜索典型入口与模块：`App.tsx`、`index.tsx`、`components/*`、`src/components/*`、`workers/*`、`src/workers/*`、`services/*`、`src/services/*`、`translations.*`、`electron/*`。
  - 标记大文件（>250 行）与混合职责文件，列入拆分候选。
- 代码内容：
  - 识别已废弃/不再引用文件（无 import/被排除构建），列入清理候选；保留证据与回滚路径。
  - 搜索硬编码颜色/尺寸/阴影等样式，纳入主题令牌替换清单。
  - 识别遗留语言代码或不一致命名（如 `zho` 残留），确认是否仍存在并清理。
- 依赖与构建：
  - 校验 `package.json` 脚本与依赖；确认 Electron 构建与 Web 构建路径是否一致且无重复入口。
  - 运行 `npm run lint`、`npm run build` 验证当前基线健康；如网络允许，执行 `npm audit` 进行安全扫描。

### 高层任务拆分（分析与整理）
1. 目录盘点：输出“重复与并行目录清单”（root vs src），锁定权威入口与迁移目标
2. 文件引用分析：生成“未引用/疑似废弃文件列表”与“跨源根引用列表”
3. 大文件与混合职责标记：形成“拆分候选清单”（目标单文件 ≤250 行）
4. 样式与 i18n 盘点：列出“硬编码样式替换清单”与“i18n 归档迁移清单（translations → src/i18n）”
5. 服务层核查：确认仅保留统一存储与 API 封装（剔除旧版或重复实现）
6. 验证与基线快照：lint/build/audit 通过；记录日志与输出报告至 `.trae/` 便于回溯

### 成功标准
- 形成可执行的“整理清单”：重复文件、废弃文件、拆分候选、样式硬编码替换项、i18n迁移项、跨源根引用项。
- 给出统一的源码入口位置（建议收敛至 `src/`），并明确迁移顺序与影响面。
- 运行 `lint/build` 无新增错误；若存在问题，在整理清单中标注与建议修复路径。

### 项目状态看板（分析阶段）（已合并至统一执行计划）
- [ ] 目录盘点与重复列表
- [ ] 未引用/废弃文件列表
- [ ] 大文件与混合职责拆分候选
- [ ] 样式硬编码替换清单
- [ ] i18n 迁移与统一路径方案
- [ ] 服务层重复/旧版实现清理方案
- [ ] lint/build/audit 验证与报告

### 产出物
- `.trae/analysis-report.md`：目录结构、重复/废弃清单、拆分候选、样式替换与 i18n 迁移建议、服务层清理建议、验证日志摘要。
- 为下一阶段的“UI主题标准”与“模块化重构计划”提供明确输入与优先级排序。

## 计划合理性评审与执行顺序调整（保障不影响现有功能）

### 原则
- 一次只引入一个可验证的变更，配合兼容层与回滚路径，保证 UI 与逻辑不回归。
- 建立“兼容导入层”（re-export/别名）与“特性开关”（主题类与配置），老代码与新模块可并存一段时间。
- 每个阶段以 lint/build/预览为门槛，通过后再进入下一阶段。

### 建议执行顺序（分阶段、可回滚）
1. 基线分析（当前阶段）
   - 输出重复/废弃文件清单、跨源根引用清单、拆分候选与样式硬编码清单。
   - 建议将权威源码入口统一收敛到 `src/`，根目录仅保留少量顶层文件（如配置/脚本）。
2. UI主题引入（非侵入式）
   - 在 `src/styles/podui.css` 定义 Design Tokens 与基础组件类，并在 `index.tsx` 全局引入。
   - 顶层容器添加 `podui-theme-dark` 类，但仅用变量覆盖视觉，不更换组件结构；确保预览无回归。
3. 兼容层搭建（导入路径与模块别名）
   - 在新目录下创建 `index.ts` re-export，维持旧路径可用；必要时在构建配置设置路径别名（如 `@/components` 指向 `src/components`）。
   - 为 i18n 提供 `useI18n(language)` 兼容钩子，先在旧组件中试接入。
4. 模块化迁移（先易后难）
   - 先迁移 `types/` 与 `services/storage`（已适配服务端/浏览器），保持 API 不变。
   - 迁移 `features/history` 与 Worker 接线（路径统一到 `src/`），检查 `new URL(..., import.meta.url)` 工作正常。
   - 迁移 `features/boards`（渲染与图层面板），将逻辑拆分为小文件；保留旧导出作桥接一版。
   - 迁移 `features/prompt`（PromptBar/QuickPrompts/香蕉面板），统一动作与状态来源。
5. UI组件替换（通用基础组件）
   - 在 `PromptBar/Toolbar/CanvasSettings/BoardPanel` 逐步用 `pod-*` 组件替换散落类名组合；每替换一个组件后进行预览与交互验证。
6. i18n 归档与统一（最后收敛）
   - 将 `translations.ts` 迁移到 `src/i18n`，统一语言代码 `ZH/en`，确保 `translations[language]` 与钩子兼容。
7. 清理与收尾
   - 删除废弃/重复文件；修正导入路径；更新文档与经验记录，形成最终模块图。

### 风险与缓解
- 重复入口（根与 src）导致的运行时引用错乱：以路径别名与 re-export 过渡，确保旧引用不报错。
- Worker 路径在迁移中失效：统一 Worker 位置，保留 `new URL(..., import.meta.url)` 语法，不使用相对跨源根路径。
- 主题替换引入视觉回归：先变量覆盖，再组件替换；每步都有预览与交互验收（hover/active/focus-visible/disabled）。
- 服务端适配不一致：`boardsStorage` 已统一；迁移期间保持 API 不变，新增功能走新模块。

### 验收门槛（每阶段）
- `npm run lint`、`npm run build` 通过；打开预览页面进行交互验收。
- 指定页面场景（画布操作、历史缩略图、导入历史、语言切换、Prompt 生成/编辑）逐项回归。
- 遇到问题先回滚当前阶段变更，保证主线稳定。

### 执行顺序调整后的状态看板映射
- 分别对应分析看板、UI主题看板、重构看板的第一至第七项，按上面的顺序推进；每一项完成都进行验收与记录。

## 动态调整模块化拆分计划（基于实际分析结果）

### 关键发现（目录与引用）
- 重复入口与并行目录：
  - `App.tsx` 同时存在于根与 `src/`（`App.tsx:7`，`src/App.tsx:16`）。
  - 组件并行：`components/LayerPanel.tsx` 与 `src/components/LayerPanel.tsx`。
  - 服务并行：根有 `services/geminiService.ts` 与 `services/httpClient.ts`，而历史/会话存储在 `src/services/boardsStorage.ts`。
- 跨根引用：
  - 根组件引用 `src` 服务（`components/BoardPanel.tsx:4`、`App.tsx:21`）。
  - `StartupGate` 在 `src` 内部正确引用 `../services/boardsStorage`（`src/bootstrap/StartupGate.tsx:2`）。
- i18n 位置：`translations.ts` 位于根目录，被两套入口引用（`translations.ts:86`、`App.tsx:20`、`src/App.tsx:16`）。
- 构建与别名：
  - Vite 将 `@` 指向根（`vite.config.ts:55-57`），`tsconfig.json` 的 `paths` 同样指向根（`tsconfig.json:21-25`），且 `exclude` 排除了 `src/App.tsx` 与 `src/components/**`（`tsconfig.json:29-32`）。

### 动态拆分策略（按优先级执行，随分析更新）
1. 统一“权威入口”与路径策略（低风险先行）
   - 暂维持 `@` 指向根，新增过渡导出层：在根目录为新模块提供 `index.ts` re-export，避免全面替换 import。
   - 在重构末期再将 `@` 切换到 `src`，同时移除 `tsconfig.json:29-32` 的 `exclude`；确保切换前已有桥接层。
2. 服务层优先收敛（API/存储/工具）
   - 目标：所有服务统一位于 `src/services/*`。
   - 行动：
     - 将 `services/geminiService.ts` 与 `services/httpClient.ts` 迁入 `src/services/api/*`；根目录保留同名文件，内部仅 re-export `src` 实现。
     - 历史/会话存储已在 `src/services/boardsStorage.ts`（`src/services/boardsStorage.ts:214/288/332/389/428/457`），保持不变；移除旧版或重复实现（分析未见旧版）。
     - 工具函数按领域迁入 `src/services/imaging` 或 `src/utils`，保留旧路径 re-export。
3. 组件层分段迁移（先少依赖、后多依赖）
   - 第一批：`src/components/SessionRestoreDialog.tsx` 维持，迁移根的 `components/BoardPanel.tsx` 与 `components/LayerPanel.tsx` 到 `src/features/boards`，保留根导出桥。
   - 第二批：`components/Toolbar.tsx` 与 `components/PromptBar.tsx` 迁至 `src/features/toolbar` 与 `src/features/prompt`；抽离通用按钮/面板为 `src/ui/*`。
   - 第三批：`components/CanvasSettings.tsx` 与 `components/QuickPrompts.tsx` 分别迁至 `src/features/settings` 与 `src/features/prompt`。
4. Worker 路径与接线统一
   - 保持 Worker 位于 `src/workers/thumbWorker.ts`（当前已如此，`components/BoardPanel.tsx:154` 使用 `new URL('../src/workers/thumbWorker.ts', import.meta.url)`）。
   - 调整根组件中的 Worker 引用为相对至同源根的路径（重构完成后统一为 `new URL('../workers/thumbWorker.ts', import.meta.url)`）。
5. i18n 统一与兼容
   - 将 `translations.ts` 迁入 `src/i18n/translations.ts` 并提供 `useI18n(language)` 钩子；
   - 保留根 `translations.ts` re-export 到新位置，确保两套入口无感切换；语言代码已统一为 `ZH/en`。
6. UI主题渐进替换
   - 先引入 `src/styles/podui.css`（已存在），在顶层应用 `podui-theme-dark` 覆盖变量；
   - 逐步在高交互组件用 `pod-*` 基础组件替换散落类名组合（每替换一个组件即回归测试）。

### 动态调整原则
- 每次迁移一个模块（或一组低耦合模块），立即执行 `npm run lint` 与 `npm run build` 并在画布/历史/Prompt/语言切换场景下人工回归。
- 若发现路径、Worker、别名导致构建或运行时问题，先回滚桥接层和导入，再调整路径别名映射与 re-export。
- 在最终切换 `@` 到 `src` 之前，确保所有根导入已被桥接到新位置且通过预览回归。

### 初始任务队列（第一轮执行，完成后再更新）
- [x] 服务层迁移：`services/geminiService.ts` 与 `services/httpClient.ts` → `src/services/api/*`（保留根 re-export）
- [x] 组件迁移第一批：`components/BoardPanel.tsx`、`components/LayerPanel.tsx` → `src/features/boards/*`（保留根 re-export）
- [x] Worker 引用修正：根组件对 `thumbWorker.ts` 的相对路径优化（保持 `new URL` 模式）
- [x] i18n 桥接：新增 `src/i18n/translations.ts` 与 `useI18n` 钩子，根 `translations.ts` re-export
- [x] UI主题覆盖验证：顶层 `podui-theme-dark` 与变量覆盖，通过预览（hover/active/focus-visible/disabled）
- [x] 阶段验收：lint/build/交互回归；更新此计划中的“动态调整”内容与下一轮任务队列

### 第二轮任务队列（进行中）
（已合并至“项目执行与状态看板（合并）”，保留此标题以便追溯）

### 第三轮任务队列（模块化收尾与功能修复）
（已合并至“项目执行与状态看板（合并）”，保留此标题以便追溯）

### 项目状态看板（当前执行）
（已合并至“项目执行与状态看板（合并）”，保留此标题以便追溯）

### 项目执行与状态看板（合并）
- [x] 服务层迁移：`services/geminiService.ts`、`services/httpClient.ts` → `src/services/api/*`（保留根 re-export）
- [x] 组件迁移第一批：`components/BoardPanel.tsx`、`components/LayerPanel.tsx` → `src/features/boards/*`（保留根桥接）
- [x] Worker 引用修正：统一 `new URL(..., import.meta.url)` 路径策略
- [x] i18n 桥接：新增 `src/i18n/translations.ts` 与 `useI18n` 钩子，根 `translations.ts` re-export
- [x] 顶层应用主题：在 `index.tsx` 应用 `podui-theme-dark` 并验收
- [x] 文档更新：同步 `.trae/scratchpad.md` 状态与队列
- [x] Toolbar 迁移与桥接：`src/features/toolbar/Toolbar.tsx`
- [x] PromptBar 迁移与桥接：`src/features/prompt/PromptBar.tsx`
- [x] QuickPrompts 迁移与桥接：`src/features/prompt/QuickPrompts.tsx`
- [x] 通用 UI 抽取与集成：`src/ui/*`（Panel/IconButton/Button/Chip/MenuItem/Toolbar/Select/Textarea）
- [x] Button 组件扩展：variants/sizes 并在 Toolbar/CanvasSettings 应用
- [x] BoardPanel 拆分与瘦身：单文件 ≤250 行
- [x] 路径别名切换准备与执行：将 `@` 指向 `src` 并验证
- [x] BananaSidebar 迁移与桥接：`src/features/sidebar/BananaSidebar.tsx`，根导出代理保持兼容
- [x] CanvasSettings 迁移并集成 Input：`src/features/settings/CanvasSettings.tsx` 使用 `src/ui/Input.tsx`
 - [ ] 修复 `src/App.tsx` 类型错误（handleUngroup）并重新纳入 TS 检查
 - [x] 验证所有迁移组件的功能与引用（PromptBar/Sidebar/Boards/SessionRestoreDialog）
 - [x] 迁移剩余根组件或确认根目录仅保留配置与入口
 - [x] 阶段验收：`npm run lint`、`npx tsc --noEmit`、`npm run build` 与预览交互回归

### 执行者反馈或请求帮助
 - 路径别名切换将安排在所有桥接稳定后再进行，避免入口冲突。
 - PodUI 变量覆盖已应用，后续组件替换会逐步推进并在预览中人工回归交互状态。
 - 若需要增加自动化快验脚本（如 Worker 引用统一、i18n 覆盖率），可在下一轮补充。
 - 已保留“掩膜修复”行为：
   - 服务层在 `src/services/api/geminiService.ts:595` 增加 `mask` 可选参数，并在 `images/edits` 请求体写入 `mask` 文件（`src/services/api/geminiService.ts:636-642`）。
   - `App.tsx:1485-1488` 的 inpainting 流程向 `editImage` 传入 `mask`（由 `rasterizeMask` 生成）。
   - 变更已通过 `npm run lint` 与类型检查验证，未引入新错误。
 - 通用 UI 抽取进展：
   - 已新增 `Panel/IconButton/Button/Chip/MenuItem/Toolbar/Select/Textarea` 基础组件，均在 `src/ui/*` 下；统一在 `src/ui/index.ts` 导出。
   - 集成范围：`QuickPrompts`（按钮/面板/菜单项）、`PromptBar`（工具条容器/模式切换/尺寸芯片/保存按钮/生成按钮/文本域）、`Toolbar`（工具按钮/弹框面板/裁剪选择与确认）、`CanvasSettings`（面板/关闭按钮/保存按钮/芯片选项）、`BoardPanel`（面板容器/头部按钮/条目菜单弹层，菜单项已替换为 `MenuItem`）。
    - 构建与预览验证通过：`npm run lint`、`npx tsc --noEmit`、`npm run build`、`vite preview`（本机 `http://localhost:4173/`）。
  - 新增：Button 变体（primary/secondary/ghost/outline）与尺寸（xs/sm/md）已落地；在 `src/features/toolbar/Toolbar.tsx:160` 裁剪确认/取消按钮应用 `size="sm"`，在 `components/CanvasSettings.tsx:114-118` 保存按钮应用 `size="sm"`；通过 `npm run lint`、`npx tsc --noEmit` 与 `npm run build` 验证。
  - 新增：完成 BoardPanel 拆分与瘦身（单文件 ≤250 行）。创建 `src/features/boards/components/BoardItem.tsx:1`、`src/features/boards/components/BoardGrid.tsx:1`、`src/features/boards/components/HistoryList.tsx:1`，并将原 `BoardPanel.tsx` 精简为 63 行。验证通过：`npm run lint`、`npx tsc --noEmit`、`npm run build`。
  - 新增：完成路径别名切换准备，清理所有 `@/src/*` 导入为相对或统一 `@/*`（已无匹配项）。并已切换 `@` 指向 `src`：`vite.config.ts:56` 与 `tsconfig.json:21-25` 已更新，同时新增 `baseUrl` 以支持 TS 路径。
  - 桥接层：新增 `src/components/BananaSidebar.tsx:1`、`src/hooks/useBoardActions.ts:1`、`src/utils/canvas.ts:1`、`src/utils/retry.ts:1`、`src/services/httpClient.ts:1`、`src/types/index.ts:1`；`src/i18n/translations.ts:1` 指向根 `translations.ts`。修复 `PromptBar` 命名导入：在 `src/components/BananaSidebar.tsx:1-2` 同时导出默认与命名 `BananaSidebar`。
  - 验证：`npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过；预览可用：`http://localhost:4173/`。
  - 新增：引入通用 `Input/Dialog` 组件（`src/ui/Input.tsx`、`src/ui/Dialog.tsx`），并在 `src/components/SessionRestoreDialog.tsx:1-2,8-33` 集成 `Dialog`；`CanvasSettings` 暂保持原 `<input>` 以避免 TS 类型与行为耦合，后续视需要再统一。

## 自验证测试矩阵与脚本

### 测试脚本
- `scripts/validate-structure.mjs`：结构与约束检查（目录存在、关键文件与别名、i18n 键）。
  - 运行：`node scripts/validate-structure.mjs`
  - 当前结果：已创建 `src/features`、`src/ui`、`src/i18n` 占位并通过脚本；其余检查通过。
- 现有：`npm run lint`、`npm run build` 用于静态与构建验证；`vite preview` 用于交互回归。
- 后续补充：在迁移阶段增加轻量脚本验收（如 `scripts/validate-workers.mjs` 检查 Worker 引用统一；`scripts/validate-i18n.mjs` 检查词条覆盖率）。

### 分阶段自验证清单
- 分析阶段：
  - 运行 `node scripts/validate-structure.mjs`、`npm run lint`、`npm run build`；若网络允许，`npm audit`。
  - 输出 `.trae/analysis-report.md`（重复/废弃/拆分候选/样式硬编码/i18n 迁移建议）。
- UI主题阶段：
  - `npm run lint`、`npm run build`；`vite preview` 检查 hover/active/focus-visible/disabled 与 tokens 覆盖。
  - 对关键组件的视觉快照与交互清单进行人工验收。
- 兼容层与迁移阶段：
  - 每迁移一组模块：运行 `node scripts/validate-structure.mjs`、`npm run lint`、`npm run build`；打开预览执行画布、历史、导入、语言切换与 Prompt 场景。
  - Worker 与路径统一：新增脚本检查 Worker 引用；确保 `new URL(..., import.meta.url)` 可用。
- i18n 归档阶段：
  - 运行 i18n 覆盖率脚本与预览检查；确保 `translations[language]` 与 `useI18n` 钩子在 `ZH/en` 两种语言下无缺词与异常。
- 收尾阶段：
  - 清理废弃文件后再次 `node scripts/validate-structure.mjs` 与完整回归；更新文档与经验记录。

## UI主题风格标准（PodUI）（已合并至统一执行计划）

### 目标
- 建立可继承、可演进的统一视觉系统（颜色、排版、尺寸、状态、动效）。
- 以 CSS 变量为基础的 Design Tokens，实现“主题切换不改组件逻辑”。
- 通过通用基础组件（Button/Panel/Chip/Menu/Toolbar）复用风格，减少散落类名组合。

### 设计令牌（Design Tokens）
```css
:root {
  /* 语义色与中性色 */
  --pod-bg: #0f0f10;
  --pod-panel-bg: #151517;
  --pod-panel-bg-transparent: transparent;
  --pod-border-color: #2a2a2a;
  --pod-text-primary: #e5e7eb;
  --pod-text-heading: #f5f7fa;
  --pod-text-accent: #ffd84a;
  --pod-accent: #ffd84a;      /* 主题黄 */
  --pod-success: #22c55e;
  --pod-warning: #f59e0b;
  --pod-danger:  #ef4444;

  /* 排版与尺寸 */
  --pod-font-sans: ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
  --pod-radius-xs: 6px;
  --pod-radius-sm: 10px;
  --pod-radius-md: 14px;
  --pod-radius-lg: 16px;  /* toolbar 与面板统一倒角 */
  --pod-shadow-card: 0 2px 8px rgba(0,0,0,.25);
  --pod-shadow-hover: 0 4px 12px rgba(0,0,0,.35);
  --pod-ring: 0 0 0 2px rgba(255,216,74,.6);
  --pod-spacing-1: 4px;  --pod-spacing-2: 8px;  --pod-spacing-3: 12px;  --pod-spacing-4: 16px;

  /* 交互动效 */
  --pod-transition-fast: 120ms ease-out;
  --pod-transition:       220ms ease-out;
}

/* 向后兼容的别名（现有代码引用的变量名） */
:root {
  --text-primary: var(--pod-text-primary);
  --text-heading: var(--pod-text-heading);
  --text-accent:  var(--pod-text-accent);
  --border-color: var(--pod-border-color);
}

/* 主题切换（可选 dark/light 或高对比） */
.podui-theme-dark { /* 暗色默认 */ }
.podui-theme-light {
  --pod-bg: #fafafa; --pod-panel-bg: #ffffff; --pod-border-color: #e5e7eb;
  --pod-text-primary: #1f2937; --pod-text-heading: #111827; --pod-text-accent: #b45309;
  --pod-accent: #f59e0b;
}
```

### 通用基础组件标准
- `pod-panel`：统一面板容器（背景、倒角、边框、阴影、内边距），支持透明变体 `pod-panel-transparent` 与渐变 `pod-panel-yellow-gradient`。
- `pod-icon-button`/`pod-button`：按钮基类，含尺寸（xs/sm/md）、变体（primary/outline/ghost）、状态（hover/active/disabled/focus-ring）。
- `pod-chip`：选项/标签胶囊，支持 active 与禁用态，边框与文字颜色遵循 tokens。
- `pod-toolbar`：工具条外框，统一倒角半径 `var(--pod-radius-lg)` 与背景/阴影策略，内部按钮继承 `pod-button`。
- `pod-scrollbar-x`：横向滚动条统一样式（深灰轨道、白边圆形拇指），含 hover/active 态。
- `pod-menu-item`：菜单项，支持选中/禁用态与键盘导航聚焦样式（focus-visible）。

### 交互与状态规范
- hover：颜色轻度提升（文本 heading→accent/边框加深），卡片阴影从 `--pod-shadow-card` → `--pod-shadow-hover`。
- active：按钮/芯片边框与背景对比增强，保持动效 `--pod-transition-fast`。
- focus（无障碍）：统一环样式 `--pod-ring`，仅在键盘导航时启用 `:focus-visible`。
- disabled：降低不透明度与禁用指针事件，不改变布局尺寸。

### 组件结构与命名
- 原子（atoms）：`Button`、`IconButton`、`Chip`、`Panel`、`MenuItem`。
- 复合（molecules）：`Toolbar`、`Card`、`SidebarPanel`、`Dialog`。
- 主题类统一以 `pod-` 前缀；变体使用后缀 `--primary`、`--outline`、`--ghost`、`--transparent`。

### 集成策略
- 在 `index.tsx` 全局引入 `src/styles/podui.css`，顶层容器应用 `podui-theme` 或 `podui-theme-dark` 类。
- 逐步将组件的类名组合替换为通用基础组件（不改布局与逻辑）；优先替换交互强的区域：`PromptBar`、`Toolbar`、`CanvasSettings`、`BoardPanel`、`QuickPrompts`。
- 保留 Tailwind 工具类用于布局与细节；视觉与状态由 `pod-*` 类承载。
- 所有颜色与尺寸使用 CSS 变量，不直接写死颜色值。

### 验证与成功标准
- 统一主题变量与基础组件覆盖后，预览界面无回归；交互（点击、悬浮、键盘导航、禁用态）一致。
- 变量命名与别名稳定（`--text-*/--border-color` 仍可用），新旧代码混用不破坏视觉一致性。
- `npm run lint`、`npm run build` 无错误；关键页面视觉对齐至 PodUI 参考图。

### 落地步骤（行动项）
1. 创建并完善 `src/styles/podui.css`，定义上述 Design Tokens 与基础组件类。
2. 在 `index.tsx` 引入样式，并为顶层容器添加 `podui-theme-dark` 类。
3. 将 `PromptBar/Toolbar/CanvasSettings/BoardPanel` 替换为通用基础组件；保留原布局。
4. 增加滚动条样式类并应用到香蕉面板与历史网格的容器。
5. 增加 `focus-visible` 与 `ring` 统一样式，完成无障碍检查（Tab 导航序与焦点可见性）。
6. 记录与修正不一致项（颜色、阴影、倒角、按钮尺寸），以 tokens 为单一真相源更新。

### 项目状态看板（UI主题）
- [ ] 定义 Design Tokens 与变量别名
- [ ] 建立基础组件类并引入到页面
- [ ] 关键组件替换为通用基础组件
- [ ] 验证交互与无障碍（focus-visible/ring/禁用态）
- [ ] 全量 lint/build 验证与问题清单

## 模块化重构计划（2025-12-02）（已合并至统一执行计划）

### 背景和动机
- 将整个项目的功能与界面“模块化、去中心化”，不再集中于单一文件，降低耦合、提升迭代效率与维护性。
- 明确模块边界（功能域、服务层、通用UI、状态层、i18n），以便按需替换与独立测试。
- 控制单文件不超过约 250 行，遵循小型、可组合的组件与服务设计。

### 关键挑战和分析
- 现有核心逻辑集中在 `App.tsx` 与少量服务函数，导致跨功能依赖、历史与会话、UI与逻辑混杂。
- 图版（Board）渲染、历史、缩略图生成、Prompt 与工具栏等功能交织，需要边迁移边保证稳定。
- 在浏览器与服务端两种运行模式下，存储适配需要保持统一接口（IndexedDB 与文件系统已打通）。
- i18n 与 PodUI 通用样式需要抽出为可复用层，避免各组件独立拼接类名而造成重复与不一致。

### 模块与目录结构草案
```text
src/
  state/                 # 全局状态与上下文（AppProvider、useAppState）
  features/
    boards/             # 画布与板书：BoardCanvas、LayerPanel、BoardPanel、hooks
    history/            # 历史与缩略图：HistoryPanel、thumbWorker 接线、hooks
    prompt/             # PromptBar、QuickPrompts、香蕉面板（BananaSidebar）
    settings/           # CanvasSettings 等配置面板
    toolbar/            # Toolbar 与工具按钮
  services/
    api/                # 对接 whatai.qwen/gemini 的统一 API 封装
    storage/            # 会话与历史存储（IndexedDB/FS），当前 boardsStorage 已适配
    imaging/            # 栅格化、缩放、合并图层、图片处理工具
  ui/                   # PodUI 通用基础组件（Button、Panel、Chip、Menu 等）
  i18n/                 # 翻译与语言切换（translations、useI18n）
  workers/              # Web Worker（缩略图等）
  types/                # 领域类型（Board、Element、ImageElement 等）
```

### 高层任务拆分
1. 建立目录骨架与 index 导出（不改逻辑，仅迁移组织）
2. 抽取全局状态到 `state/AppProvider` 与 `useAppState`，将 `App.tsx` 仅保留路由或容器职责
3. 迁移 Board 相关组件到 `features/boards/` 并按职责拆分（渲染、面板、图层、交互）
4. 迁移历史与缩略图逻辑到 `features/history/`，保持与 `services/storage` 接口一致
5. 迁移 Prompt/QuickPrompts/香蕉面板到 `features/prompt/`，统一动作与数据流
6. 抽取 PodUI 基础组件到 `ui/`，逐步替换原有类名组合为通用组件（不改布局）
7. 抽取 i18n 到 `i18n/`，提供 `useI18n(language)` 钩子，统一 `ZH/en`
8. services 层按域拆分：`api/`、`storage/`、`imaging/`，分离纯函数与副作用
9. 对迁移后的模块进行 lint/typecheck 与构建验证，补充最小单元测试
10. 清理残留交叉依赖，完善 re-export 与公共入口，更新导入路径

### 成功标准
- 构建与预览无回归错误；`npm run lint`、`npm run build` 全部通过。
- 主要功能（图像生成/编辑、板书操作、历史缩略图、导入导出、语言切换）行为一致。
- 单文件控制在合理大小（≈250 行），模块边界清晰、依赖从上层向下层单向流动。
- 模块内可独立替换与测试；通用 UI 组件复用度提升、类名与主题一致。

### 项目状态看板（重构）
- [ ] 建立目录骨架与 index 导出
- [ ] 抽取 App 全局状态到 `state/`
- [ ] 迁移 Board 组件到 `features/boards/`
- [ ] 迁移 History 逻辑到 `features/history/`
- [ ] 迁移 Prompt/QuickPrompts 到 `features/prompt/`
- [ ] 抽取 PodUI 基础组件到 `ui/`
- [ ] 抽取 i18n 到 `i18n/` 并统一语言钩子
- [ ] 拆分 services：`api/`、`storage/`、`imaging/`
- [ ] 全量 lint/typecheck/build 验证与最小测试
- [ ] 清理导入路径与 re-export，完成文档与经验记录

