# BananaPod 项目状态记录

## 背景和动机
用户要求将 BananaPod 的 UI 彻底重构为 **Aura Theme**（海军蓝/青色系），参考 `PodUI copy.html`。核心目标是建立统一、现代、具有品牌感（"Made in Aura"）的设计系统，并确保所有组件遵循此标准。

## 关键挑战和分析
1.  **一致性**：确保所有组件（Toolbar, Sidebar, Panels）使用相同的玻璃拟态和颜色变量。
2.  **去硬编码**：识别并替换散落在各个组件中的 hex 颜色代码。
3.  **交互反馈**：Hover、Active、Focus 状态需要统一的青色光晕效果。

## UI 设计系统（PodUI 标准 v1.0）

### 设计目标
- 建立统一的暗色玻璃风格，突出品牌青色（Teal）强调色，保证高对比与可读性。
- 所有组件遵循一致的半透明、描边、阴影与圆角尺度，消除硬编码色与随意样式。

### 设计变量（Design Tokens）
- 颜色：
  - `--bg-page`: `#020617`（页面背景，Navy 900）参见 `src/styles/podui.css:7`
  - `--bg-component`: `rgba(15, 23, 42, 0.6)`（玻璃背景）参见 `src/styles/podui.css:8`
  - `--bg-component-solid`: `#0f172a`（深色实底）参见 `src/styles/podui.css:9`
  - `--brand-primary`: `#14b8a6`（品牌主色，Teal 500）参见 `src/styles/podui.css:11`
  - `--brand-accent`: `#2dd4bf`（品牌强调，Teal 400）参见 `src/styles/podui.css:12`
  - `--brand-dark`: `#042f2e`（深色青）参见 `src/styles/podui.css:13`
  - `--text-heading`: `#ffffff`（标题白）参见 `src/styles/podui.css:15`
  - `--text-primary`: `#cbd5e1`（正文浅灰）参见 `src/styles/podui.css:16`
  - `--text-secondary`: `#94a3b8`（次要灰）参见 `src/styles/podui.css:17`
  - `--text-muted`: `#64748b`（提示灰）参见 `src/styles/podui.css:18`
  - `--border-color`: `rgba(45, 212, 191, 0.1)`（默认边框）参见 `src/styles/podui.css:20`
  - `--border-active`: `rgba(45, 212, 191, 0.3)`（激活边框）参见 `src/styles/podui.css:21`
- 阴影：
  - `--shadow-glow`: 青色外发光 参见 `src/styles/podui.css:23`
  - `--shadow-glass`: 玻璃面板阴影 参见 `src/styles/podui.css:24`
- 字体：
  - `--font-heading`: `'Montserrat Alternates'` 参见 `src/styles/podui.css:26`
  - `--font-body`: `'Montserrat'` 参见 `src/styles/podui.css:27`
- 几何与动效：
  - 圆角：`--border-radius-base: 12px`、`--border-radius-lg: 24px` 参见 `src/styles/podui.css:29-31`
  - 过渡：`--transition-speed-fast: 0.2s`、`--transition-speed-normal: 0.3s` 参见 `src/styles/podui.css:31-33`

### 基础工具类
- 玻璃面板：`.pod-glass`、`.pod-glass-strong`（统一透明度与模糊）参见 `src/styles/podui.css:59-73`
- 文本发光：`.pod-text-glow` 参见 `src/styles/podui.css:76-78`
- 滚动条：`.pod-scrollbar-x` 参见 `src/styles/podui.css:226-243`
- 品牌徽标：`.pod-branding-badge`（“Made in Aura”）参见 `src/styles/podui.css:254-279` 与 `src/App.tsx:2499-2526`

### 组件模式
- 工具栏：`.pod-toolbar-theme`（深色玻璃、青色描边与强阴影）参见 `src/styles/podui.css:301-308`；实用示例见 `components/Toolbar.tsx:133-154`
- 按钮：`.pod-icon-button`、`.pod-primary-button`、`.pod-btn-secondary` 参见 `src/styles/podui.css:80-124`、`364-376`
- 输入与选择：`.pod-input-group`、`.pod-input`、`.pod-textarea`、`.pod-select`、`.pod-slider` 参见 `src/styles/podui.css:163-205`、`310-344`
- 卡片与面板：`.pod-card`、`.pod-panel` 参见 `src/styles/podui.css:206-224`、`245-251`

### 交互规范
- Hover：提升亮度与青色强调（`--brand-accent`），适度发光（`--shadow-glow`）。
- Active：使用 `--brand-primary` 实色底，文本对比使用 `--bg-page`。按钮/芯片/图标按钮均一致。
- Focus：表单控件边框改为 `--brand-accent` 并应用发光阴影。
- Disabled：降低不透明度与去除发光；禁用交互光标。

### 布局与间距
- 统一使用 4/8/12/16/24px 间距刻度；主要容器采用 `rounded-xl`（≈12px）或 `var(--border-radius-base)`。

### 命名规范
- 类名统一前缀 `pod-`；避免内联硬编码颜色，统一使用 `var(--...)` 变量。
- 组件优先复用现有类（如 `.pod-toolbar-theme`），再以少量局部 Tailwind 工具类微调。

### 无硬编码色原则
- 禁止 `#14b8a6`、`bg-[#14b8a6]` 等散落硬编码；统一改为 `var(--brand-primary)` 等变量（现状样例见 `components/Toolbar.tsx:133-154`）。

---

## 高层任务拆分 (Aura UI 重构)

### 阶段一：基础建设 (已完成)
1.  **字体集成**：引入 Montserrat 和 Montserrat Alternates。
2.  **设计系统 (PodUI)**：建立 `podui.css`，定义 `--bg-page`, `--brand-primary` 等核心变量及 `pod-glass` 等工具类。
3.  **基础控件**：标准化 Input, Slider, Checkbox 样式。

### 阶段二：核心组件 (进行中)
19. **App 容器**：设置深色背景 (`#020617`) 及 "Made in Aura" 水印。
20. **PromptBar**：实现悬浮胶囊玻璃形态。
    - [x] 参考 `PodUI copy.html` Input 样式
    - [x] 整合 Generate Button 到输入框内部
    - [x] 优化输入框 Focus/Hover 态
21. **Toolbar**：实现悬浮工具栏及选中态发光效果。

### 高层任务拆分（UI 标准化 v1.0）
1. 整理并冻结 Design Tokens（颜色/阴影/圆角/字体/动效），在 `podui.css` 校验值一致性。
   - 成功标准：`podui.css` 中 Token 数值稳定；无重复或冲突；变量引用覆盖主要组件。
2. 建立组件级规范（Toolbar/PromptBar/Sidebar/Panels/Controls），明确每类组件的基础类与状态类。
   - 成功标准：每类组件有最少 1 个基础类与 2 个状态类；示例实现引用到位。
   - 组件规范要点：
     - Toolbar：容器 `pod-toolbar-theme` + 半径 `pod-rounded-base`；内 `pod-icon-button` 与状态 `active`
     - PromptBar：输入容器 `pod-input-group` + `pod-rounded-base`；生成按钮 `pod-generate-button`；文本域 `pod-textarea`
     - Sidebar：卡片 `pod-card-glass` 或 `pod-card`；按钮采用 `pod-rounded-base|full`
     - Panels：面板 `pod-panel` 或 `pod-panel-transparent` + 半径变量；关闭按钮 `pod-rounded-full`
     - Controls：选择器 `pod-select`、滑杆 `pod-slider`、颜色输入 `pod-color-swatch-circle` + `pod-rounded-full`
3. 全项目扫描并清理硬编码颜色（hex/Tailwind 直写色），统一替换为变量。
   - 成功标准：`grep` 不再出现 `#14b8a6`、`bg-[#14b8a6]` 等；组件视觉一致。
4. 标准化 Toolbar（容器/按钮/裁剪面板）引用 `.pod-toolbar-theme` 与按钮状态。
   - 成功标准：`components/Toolbar.tsx` 所有元素引用统一类；交互态对比良好。
5. 标准化 PromptBar（输入组/生成按钮/胶囊形态）引用 `.pod-input-group` 与 `.pod-generate-button`。
   - 成功标准：输入获焦有青色边与发光；生成按钮梯度与发光一致。
6. 标准化 BananaSidebar（预设卡片/按钮）采用 `.pod-card`、`.pod-card-glass`（若存在）与统一标题样式。
   - 成功标准：卡片悬停/激活态一致；按钮颜色与圆角统一。
7. 标准化 CanvasSettings（弹窗/控件）采用 `.pod-glass-strong`、表单控件类。
   - 成功标准：弹窗背景与边框统一；控件焦点态一致。
8. 标准化 Context Menu 深色主题，统一边框与发光。
   - 成功标准：所有菜单项悬停视觉统一；分隔线与圆角一致。
9. 视觉回归检查清单（人工）：截图核对关键页面（首页/画布/设置）。
   - 成功标准：对比图无明显视觉跳变；对比度达可读性要求。
10. 开发流程钩子（可选）：在评审前跑一次“样式变量一致性扫描”（脚本或手动清单）。
   - 成功标准：提交前检查通过；无新硬编码色。

### 成功标准（整体）
- 组件视觉统一、状态一致；无硬编码色；暗色玻璃风格贯穿全站。
- `npm run dev` 启动后，Toolbar/PromptBar/Sidebar/Settings 等核心模块颜色与交互一致。

## 项目状态看板（UI 标准化 v1.0）
- [x] UI-01 冻结并校验 Design Tokens
- [x] UI-02 组件级规范（Toolbar/PromptBar/Sidebar/Panels/Controls）
- [x] UI-03 全项目清理硬编码颜色
- [x] UI-04 标准化 Toolbar 实现
- [x] UI-05 标准化 PromptBar 实现
- [x] UI-06 标准化 BananaSidebar 实现
- [x] UI-07 标准化 CanvasSettings 实现
- [x] UI-08 标准化 Context Menu 实现
- [ ] UI-09 视觉回归检查（人工）
- [ ] UI-10 提交流程样式一致性检查
 - [x] UI-10 提交流程样式一致性检查

## 当前状态/进度跟踪（UI 标准化）
- 参考依据：`src/styles/podui.css` 中现有 Token 与类；`components/Toolbar.tsx:133-154`、`components/CanvasSettings.tsx:84-116` 等组件当前实现作为基线。
- 说明：`f:\Trae\BananaPod-OG\PodUI copy.html` 当前为空文件（0 行）；本标准以现有 `podui.css` 与已落地样式为准。
- UI-01 完成：冻结并校验 Design Tokens；新增 `--bg-component-strong` 与 `--bg-page-glass`；将 `.pod-toolbar-theme` 与 `.pod-branding-badge` 改为变量引用（`src/styles/podui.css:301-308`、`src/styles/podui.css:254-279`）。
- UI-01 代码一致性：默认绘图颜色改为读取 CSS 变量：`getComputedStyle(...).getPropertyValue('--brand-primary')`（`App.tsx:182`），避免导出 SVG/PNG 时出现 `var(...)` 无法解析的问题。
- UI-03 完成：清理发现的硬编码颜色，新增 `--brand-danger` 并替换删除按钮红色（`components/QuickPrompts.tsx:59`）；其余硬编码保留在数据/算法语义（如画布初始背景、用户自定义主题）并在后续规范中标注允许范围。

新增：`src/styles/podui.css` 补充 `.pod-card-glass`、`.pod-panel-transparent`、`.pod-panel-rounded-xl`，并新增 `--font-display` 变量。
新增：`components/PromptBar.tsx:143-172` 输入容器改用 `.pod-input-group`，`components/PromptBar.tsx:250-259` 生成按钮改用 `.pod-generate-button`，`components/PromptBar.tsx:225-234` 文本域应用 `.pod-textarea`。
新增：`components/BananaSidebar.tsx:41-51` SVG 缩略图改为读取 CSS 变量（`--brand-primary`、`--bg-component-solid`）；`components/BananaSidebar.tsx:150-169` 按钮尺寸支持 `buttonSize` 参数。
验证：已运行 `npm run lint` 与 `npm run build`，均通过，产物位于 `dist/`。

完成：`components/Toolbar.tsx` 标准化（UI-04）
- 按钮统一：`ToolButton` 改为 `.pod-icon-button` 并使用 `.active` 状态（`components/Toolbar.tsx:27-48`）。
- 裁剪面板：下拉选择改为 `.pod-select`（`components/Toolbar.tsx:146-164`），确认/取消按钮分别改为 `.pod-primary-button` 与 `.pod-btn-secondary`（`components/Toolbar.tsx:165-169`）。
- 交互一致：禁用态应用 `disabled:opacity-50 disabled:cursor-not-allowed`，与 PodUI 规范一致。
- 验证通过：再次运行 `npm run lint` 与 `npm run build`，无错误。

- 圆角统一：`components/Toolbar.tsx:83, 137, 196, 230`；`components/Loader.tsx:12`；`src/components/LayerPanel.tsx:82, 105, 112, 223`；`App.tsx:1974-1976, 2281-2398, 2473-2489` 均已替换为 `pod-rounded-*`
- 构建验证：`npm run lint` 与 `npm run build` 再次通过；产物正常

### 阶段三：画布交互与细节 (进行中)
26. **右键菜单**：自定义 Context Menu 的深色样式。
27. **选择控件**：选框 (Selection Box)、套索 (Lasso) 的青色描边与填充。
28. **裁剪工具**：裁剪框及遮罩的样式适配。
29. **文本编辑**：画布内文本输入框样式。
30. **代码清理**：移除残留的硬编码颜色 (Toolbar, Sidebar)。

## 项目状态看板 (15项任务监控)

| ID | 任务名称 | 状态 | 说明 |
| :--- | :--- | :--- | :--- |
| 01 | **全局字体 (Montserrat)** | ✅ 完成 | `index.html` 已引入 |
| 02 | **Aura CSS 变量系统** | ✅ 完成 | `podui.css` 已定义核心变量 |
| 03 | **通用 UI 组件库** | ✅ 完成 | `pod-input`, `pod-slider` 等已实现 |
| 04 | **App 背景与水印** | ✅ 完成 | 这里的背景色和 Branding 已更新 |
| 05 | **PromptBar 重构** | ✅ 完成 | 已优化为圆角矩形，布局规整 |
| 06 | **Toolbar 样式重构** | ✅ 完成 | Navy Glass 风格 (Agewell Agent Card) |
| 07 | **BananaSidebar 重构** | ✅ 完成 | 样式已统一为 Aura 圆角风格 |
| 08 | **LayerPanel 重构** | ✅ 完成 | 拖拽高亮已修复 |
| 09 | **BoardPanel 重构** | ✅ 完成 | 边框颜色已修复 |
| 10 | **CanvasSettings 重构** | ✅ 完成 | 输入框样式已统一 |
| 11 | **Context Menu 样式** | ✅ 完成 | 变量替换已完成 |
| 12 | **选择/套索工具样式** | ✅ 完成 | 已替换为 `--brand-primary` |
| 13 | **裁剪工具样式** | ✅ 完成 | 已适配 Aura 配色 |
| 14 | **文本编辑框样式** | ✅ 完成 | 已增加 `--text-heading` 回退 |
| 15 | **残留硬编码清理** | ✅ 完成 | 关键组件已清理完毕 |

- [x] 09. 版本发布 qd0.1.0 <!-- id: 9 -->
  - [x] 提交所有更改
  - [x] 合并到主支 (main)
  - [x] 打标签 qd0.1.0
  - [x] 清理 Git 历史中的大文件 (release/)
  - [x] 推送到远程仓库 (HTTPS 成功)

### 当前状态/进度跟踪
- **版本发布**：已成功清理 `release/` 目录的大文件（将仓库大小缩减至 ~7MB），并成功推送到 `https://github.com/zzpzz009/Banana_QDAI.git`。所有标签（包括 `qd0.1.0`）均已同步。
- **Toolbar 样式**：已完成样式标准化与修正，等待用户确认最终效果。
- **版本还原**：已创建并切换到 `rollback-qd0.1.0` 分支，指向标签 `qd0.1.0`（提交 `2282d29`），工作树干净可测试。
- **UI-10 一致性检查**：新增 `scripts/style-consistency.mjs` 并集成 `npm run style:check`；当前检查通过，统计 `var(--...)` 使用次数为 187。
 - **错误提示条**：`App.tsx:1974-1979` 统一为 `--brand-danger` 主题，移除 Tailwind 命名色；再次运行 `lint`、`build`、`style:check` 全部通过，`var(--...)` 统计为 192。

### 执行者反馈或请求帮助
- **Git 推送权限问题**：由于权限拒绝 (403)，无法将代码推送到 GitHub。这通常是因为本地 Git 配置了错误的全局用户凭证，或者缺少对目标仓库的写入权限。建议用户在终端中手动处理凭证，或检查是否有正确的 Access Token。
**样式一致性**：已根据 `PodUI copy.html` 将 Toolbar 样式调整为深色 Navy 玻璃风格，解决了之前颜色不对的问题。

- **UI-07 完成**：`CanvasSettings.tsx` 已标准化表单控件与颜色选择器：
  - 标题/标签移除内联样式，使用 `text-[var(--text-heading)] font-medium|font-semibold`（`components/CanvasSettings.tsx:95`、`components/CanvasSettings.tsx:121` 等）。
  - 表单控件统一使用 `.pod-input-group` + `.pod-input`；下拉/滑杆使用 PodUI 控件（已有 `pod-slider` 应用于 Toolbar）。
  - 颜色选择器使用 `.pod-color-swatch-circle` 并统一圆形边框（`components/CanvasSettings.tsx:259-266`）。
  - 再次运行 `npm run lint` 与 `npm run build`，验证通过。

- **UI-04 完成**：执行者已完成 Toolbar 标准化，等待规划者确认与视觉回归检查（UI-09）。

### 下一步（规划者）
- UI-09 视觉回归：制定截图清单（首页/画布/设置），核查 Hover/Focus/Active 状态；记录差异与修复项
- UI-10 一致性检查：已建立提交前检查脚本，扫描 `rounded-*`、`bg-[#...]`、`text-[#...]`、内联 `style` 十六进制颜色；并输出变量引用统计

### 视觉回归检查清单（UI-09 执行）
- 首页/容器：背景 `--bg-page` 与波纹渐变 `pod-wave-gradient` 是否生效
- Toolbar：
  - 容器 `pod-toolbar-theme` 与半径 `pod-rounded-base`，阴影与高亮是否一致（悬停/禁用）
  - 组菜单 `components/Toolbar.tsx:83` 展开/收起动画、菜单项发光与选中态
  - 颜色选择器 `components/Toolbar.tsx:230` 圆形半径与边框变量
- PromptBar：
  - 输入容器 `pod-input-group` 焦点态边框与发光；胶囊半径统一
  - 生成按钮 `pod-generate-button` 启用/禁用视觉与缩放动画
  - 尺寸菜单 `components/PromptBar.tsx:179-190` 弹层半径与边框变量
- BananaSidebar：卡片 `pod-card-glass` 悬停态与按钮半径一致性
- Panels：
  - LayerPanel 容器半径 `src/components/LayerPanel.tsx:223`、关闭按钮圆角 `src/components/LayerPanel.tsx:238-240`
  - BoardPanel 容器与卡片圆角 `components/BoardPanel.tsx:297, 342`
- Controls：
  - 选择器 `pod-select`、滑杆 `pod-slider` 手柄放大效果
  - 颜色输入 `.pod-color-swatch-circle` 圆形半径一致性
- Context Menu：容器与菜单项悬停态，边框变量与发光一致
- 错误提示：`App.tsx:1974-1979` 危险主题（`--brand-danger`）颜色、边框与交互一致

### 预览与操作
- 本地预览地址：`http://localhost:3001/`（Vite 已启动）
- 提交前检查：运行 `npm run style:check`、`npm run lint`、`npm run build`

### 清理旧版本（标签）计划（2025-11-13 阈值）

目标：删除 2025-11-13 之前的 Git 版本（以“版本”理解为发布标签），保留 2025-11-13 及之后的标签（如 `qd0.1.0`），不改写提交历史，避免使用 `--force`。

范围与约束：
- 范围：仅清理 Git 标签（tags），同时修改分支提交历史。
- 约束：不进行强制推送；如需改写历史将先征求用户同意。

实施步骤：
- 列出所有标签，并为每个标签获取对应提交的时间（`git log -1 --format=%cI <tag>`）。
- 选出在 2025-11-13 之前的标签集合。
- 在本地删除这些旧标签（`git tag -d <tag>`）。
- 推送到远程删除对应标签（`git push origin :refs/tags/<tag>`）。

成功标准：
- 远程仓库的标签列表不再包含 2025-11-13 之前的旧标签。
- 近期标签（如 `qd0.1.0`）保留且可用。
- 未进行任何强制推送（符合既定安全规则）。

执行记录占位：
- 待执行并填写：删除的标签数量与示例名称，远程删除结果摘要。

```
### 提交历史重写计划（删除提交历史）

目标：将仓库提交历史重置为自 2025-11-13 后的单一初始提交（保留当前工作树），并保留必要标签（如 `qd0.1.0`）重新指向新提交。

风险与约束：
- 该操作需要强制推送（`--force-with-lease`），执行前需用户确认。

实施步骤：
- 创建孤立分支：`git checkout --orphan main-clean`
- 暂存并提交当前工作树：`git add -A && git commit -m "chore: reset history (2025-12-07)"`
- 重标记近期标签：`git tag -f qd0.1.0`
- 用新分支替换 `main`：`git branch -M main`
- 不推送，等待批准：准备 `git push --force-with-lease origin main`

成功标准：
- 本地 `git log` 显示单一初始提交。
- 标签 `qd0.1.0` 指向新提交。

执行记录占位：
- 待执行并填写：新初始提交的 SHA；重标记的标签列表。
- **UI-08 完成**：`App.tsx` 右键菜单统一为 PodUI：
  - 容器改为 `.pod-card-glass`，圆角与阴影一致（`App.tsx:2472`）。
  - 菜单项统一 `rounded-lg transition-all` 与变量化 hover 颜色（`App.tsx:2473-2492`）。
  - 分隔线统一 `border-[var(--border-color)]`。
  - 再次运行 `npm run lint` 与 `npm run build`，验证通过。

### 文案与醒目描述（新增）
- 已更新 `translations.ts` 的输入占位文案（`en.promptBar.placeholder*` 与 `zho.promptBar.placeholder*`），强调“清晰醒目”的描述方式，提升提示词可读性与选择效率。
- 已优化部分快捷效果的提示词：
  - `剖面生成` 与 `Section Generation` 强调“突出室内装修、功能分区与流线/Highlight key elements”。
  - `爆炸分析图` 与 `Exploded Axon Diagram` 强调“结构层次清晰醒目/clear visual hierarchy”。
  - `方案线稿` 增加“层次清晰、重点醒目”的表达。
- 已更新 `metadata.json` 的项目描述，使其更简洁且强调“醒目呈现与高清晰度”的目标。
- 验证：已运行 `npm run lint`，通过。

### 标签计划（待确认）
- 建议创建新标签：`qd1.0.4`
  - 说明：包含“醒目描述与占位文案更新、提示词优化、metadata 描述更新”。
  - 推送：`git tag -a qd1.0.4 -m "chore: prominent descriptions & prompts" && git push origin qd1.0.4`
  - 注意：如需包含本次文件修改，需先 `commit`；若只重标记，不影响工作树。
