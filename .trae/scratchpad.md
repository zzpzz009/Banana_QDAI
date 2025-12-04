# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）

### 背景和动机
- 统一 UI 设计令牌与基础组件，减少散落样式与重复实现，保证可维护性与一致视觉体验。
- 建立可执行的标准与验收流程，让后续功能迭代在不回归的前提下，渐进替换旧样式。
- 目标：以 `src/styles/podui.css` 为基础形成 Design System，覆盖颜色、排版、间距、圆角、阴影、动效、状态与无障碍规范。

| ui-preview-page | 创建 UI 预览页 (1页) | 已完成 | High | src/components/PodUIPreview.tsx |
| add-prompt-styles | 添加 PromptBar 样式到标准库 | 已完成 | High | 写入 podui.css，不替换现有 UI |
| fix-preview-crash | 修复 UI Preview 白屏问题 | 已完成 | High | 暂时禁用 ContextToolbar 预览 |
| limit-animations | 限定动效边界 | 已完成 | Medium | 检查全局污染 |
| adjust-grid-size | 调大背景网格 | 已完成 | Medium | podui.css, Canvas.tsx |
| remove-button-bold | 移除按钮加粗 | 已完成 | Low | podui.css |
| canvas-bg-setting | 画布背景颜色设置 | 已完成 | Medium | App.tsx, Canvas.tsx, CanvasSettings.tsx |
| unify-promptbar-bg | 统一 PromptBar 底色 | 已完成 | Low | PromptBar.tsx |
| update-default-bg | 更新默认画布背景色 | 已完成 | Low | App.tsx |

### 执行者反馈或请求帮助
- **配置更新**：响应用户指令（"默认背景底色默认为#0F0D13"），将 `App.tsx` 中 `createNewBoard` 的默认背景色从 `#1f2937` 更新为 `#0F0D13`，确保新创建的看板背景色符合最新标准。
- **功能新增**：在设置面板（`CanvasSettings.tsx`）中新增了“画布背景颜色”设置项，并在 `App.tsx` 和 `Canvas.tsx` 中打通了状态传递，现在用户可以自定义画布背景色。
- **样式调整**：响应用户反馈（"promptbar的底色没有与toolbar统一"），将 `PromptBar.tsx` 中的背景类从 `bg-[var(--bg-page)]/95` 修改为 `bg-[var(--bg-component)]`，使其与 `PodToolbar` 等组件的玻璃态背景保持一致。
- **样式调整**：响应用户反馈（"button的字体不要加粗"），移除了 `.pod-primary-button` (600)、`.pod-btn-secondary/ghost/outline` (500) 中的 `font-weight` 属性，恢复为默认字重。
- **修复**：用户反馈网格消失，原因是 SVG 属性（width/height/cx/cy/r）直接使用 CSS 变量兼容性不佳。已在 `Canvas.tsx` 中改回数值硬编码（Gap: 24, Dot: 1.5），以确保渲染正常，同时满足“调大”的需求。
- **样式调整**：响应用户反馈（"画背景的网格调大一点"及"默认网格按新标准"），在 `podui.css` 中更新了 `--grid-gap` (24px) 和 `--grid-dot-size` (1.5px) 变量（匹配 `--space-6` / `--border-radius-lg` 等新标准参数），并同步更新 `Canvas.tsx`。这一调整平衡了默认视图的疏密感与大图编辑时的可见性。
- **修复**：用户报告点击 UI Preview 白屏，定位到 `PodUIPreview.tsx` 中缺少 `PodToolbar` 的引用导致运行时错误，已补全引用。
- **新增**：已将 `PromptBar` 的样式提取为 `.pod-prompt-*` 类，并添加到 `podui.css` 中。
- **预览**：在 `PodUIPreview.tsx` 中添加了 PromptBar 的静态预览（Expanded 状态），验证了新样式。
- **全局样式更新**：已根据 Prompt Bar 的视觉风格（Glassmorphism, Pill Shape, Subtle Borders），全面更新了 `podui.css` 中的核心组件样式（Panel, Toolbar, Input, Buttons）。
  - 更新了 `:root` 变量，采用更通透的玻璃态背景 (`rgba(30, 30, 35, 0.7)`) 和更大的圆角 (`24px`)。
  - 为 `.pod-panel` 和 `.pod-toolbar` 添加了 `backdrop-filter: blur(24px)`。
  - 调整了 `.pod-icon-button` 和其他按钮的圆角与 Hover 状态，使其与 Prompt Bar 控件一致。
- **当前状态**：UI 预览页可正常访问，PromptBar 样式已入库，且全局 UI 组件库已同步更新为 Prompt Bar 风格。
- **修复**：用户反馈快捷效果和香蕉按钮的展开菜单看不见，原因是 PromptBar 存在 `overflow-hidden` 样式。已在 `PromptBar.tsx` 中移除该样式，确保菜单可以正常显示在 PromptBar 之外。

### 验收清单 (Acceptance Checklist)
#### 1. 基础组件 (Basic Components)
- [ ] **Button**:
  - [ ] Variants: Primary, Secondary, Ghost, Outline, Danger, Generate
  - [ ] Sizes: xs, sm, md
  - [ ] States: Hover, Active, Disabled, Loading
- [ ] **Input**:
  - [ ] Sizes: sm, md
  - [ ] States: Default, Focus, Error, Disabled
  - [ ] With Icons: Left, Right
- [ ] **Panel**:
  - [ ] Variants: Default, Yellow Gradient, Transparent, Black, Pill
  - [ ] Rounded: Standard vs xl

#### 2. 复杂组件 (Complex Components)
- [ ] **Context Toolbar**:
  - [ ] Appearance: Pill shape, Glassmorphism (blur), Shadow
  - [ ] Layout: Spacing (gap), Padding (horizontal/vertical)
  - [ ] Elements: Buttons (circle), Inputs (transparent), Separators
  - [ ] States: Hover on buttons, Focus on inputs
- [ ] **Main Toolbar**:
  - [ ] Appearance: Elevated vs Default
- [ ] **Selection Overlay**:
  - [ ] Correct positioning and sizing based on selection

#### 3. 设计系统 (Design System)
- [ ] **Tokens**:
  - [ ] Colors are using CSS variables
  - [ ] Spacing uses `--space-*` tokens
  - [ ] Breakpoints use `--bp-*` tokens
- [ ] **Typography**:
  - [ ] Font sizes and weights match hierarchy

### 关键挑战和分析
- 令牌分散与命名不一致：`:root` 与部分 `--pod-*` 令牌并存，需要归一化并建立语义分层。
- 组件状态风格不一：hover/active/focus/disabled 在不同组件的视觉强度与过渡不一致。
- 动效与渐变使用边界：动画层与渐变层较多，需要限定使用场景，避免信息层次被削弱。
- 响应式与布局缺少统一断点与间距刻度：存在固定像素值，建议以刻度变量替换。
- 命名前缀：应统一采用 `.pod-*` 前缀，避免未前缀类名混用导致样式穿透。
- 无障碍：焦点环与对比度在暗色主题下需统一阈值与风格，保证键盘可达性。

### UI 设计标准草案

#### 设计令牌（Design Tokens）
- 颜色与文本（`src/styles/podui.css:2`）：
  - 背景：`--bg-page`（页面）、`--bg-component`（组件面板）
  - 文本：`--text-primary`、`--text-secondary`、`--text-heading`、`--text-muted`
  - 边框：`--border-color`
  - 品牌/强调：`--brand-yellow`、`--text-accent`
  - 扩展：`--ui-green-color`、`--ui-green-hover-color`
  - 渐变基色：`--bg-gradient-1/2/3`
  - 栅格参考：`--grid-dot-color`、`--grid-dot-opacity`、`--grid-gap`、`--grid-dot-size`
- 圆角与阴影（`src/styles/podui.css:12-17`, `:20`, `:14-15`）：
  - 圆角：`--border-radius-lg`、`--border-radius-base`、`--pod-toolbar-radius`
  - 阴影：`--shadow-md`、`--shadow-lg`
- 过渡（`src/styles/podui.css:16-17`）：
  - `--transition-speed-fast`、`--transition-speed-normal`
- 命名规范：
  - 基础令牌采用 `--bg-* / --text-* / --border-* / --shadow-*` 语义命名，组件层令牌采用 `--pod-*` 前缀；旧桥接令牌（如 `--ui-*`）需标注来源并逐步合并。

#### 主题与背景层
- 根主题类 `podui-theme`（`src/styles/podui.css:41-44`）：应用于根容器，赋予基础文本与背景色。
- 背景渐变：
  - `.pod-dynamic-gradient` 用于应用容器静态渐变底；
  - `.pod-wave-gradient` 用于首页或主视觉区域的渐变动画层（`src/styles/podui.css:64-86`）；
  - `.pod-radial-gradient` / `.pod-radial-gradient-animated` 用于面板或分区背景（`src/styles/podui.css:419-449`）；
  - `.pod-solid-gray` 禁用渐变的纯色背景。
- 使用准则：渐变层仅用于大面积背景或强调区域，避免在交互密集区域叠加过多动画影响可读性。

#### 基础组件规范（类与状态）
- 面板（`src/styles/podui.css:88-93`）：`.pod-panel` 作为标准容器；变体 `.pod-panel-yellow-gradient`、`.pod-panel-pill`、`.pod-panel-transparent` 控制视觉等级。
- 工具栏（`src/styles/podui.css:95-108`）：`.pod-toolbar` 与 `.pod-toolbar-elevated`，圆角由 `--pod-toolbar-radius` 控制；提升态增加内外阴影层次。
- 输入组（`src/styles/podui.css:110-141`）：`.pod-input-group` / `.pod-input-group-expanded` 作为组合输入的容器，含渐近式内高光；聚焦或扩展态提升可视权重。
- 轮廓与环（`src/styles/podui.css:144-176`）：`.pod-elevated-outline`、`.pod-inner-gradient-ring` 提供高级边框/环视觉，可作为强调容器或按钮外层。
- 图标按钮（`src/styles/podui.css:178-211`）：`.pod-icon-button` 基础尺寸 44×44，hover 边框与前景提升，`[disabled]` 半透明禁用。
- 主按钮与变体（`src/styles/podui.css:213-267`）：`.pod-primary-button` 基础；`.pod-generate-button` 绿色变体；hover 使用 `color-mix` 增强对比与阴影。
- 次级/幽灵/描边按钮（`src/styles/podui.css:268-305`）：`.pod-btn-secondary`、`.pod-btn-ghost`、`.pod-btn-outline`；尺寸类 `.pod-btn-xs/sm/md` 控制高度与字号。
- 输入（`src/styles/podui.css:324-337`）：`.pod-input` 占位符弱化、focus 使用 `--pod-ring` 与 `--pod-accent`；禁用态降低透明度。
- 滑块与色块（`src/styles/podui.css:229-247`，`233-247`）：`.pod-slider`、`.pod-color-swatch-circle` 统一原生控件视觉。
- 对话遮罩（`src/styles/podui.css:338-347`）：`.pod-dialog-overlay` 固定居中与模糊遮罩。
- 选择 Chip（`src/styles/podui.css:349-374` 及后续变体）：基础 `.pod-chip`，类型 `.pod-chip-image`/`.pod-chip-video`，尺寸/圈形 `.pod-chip-circle(-sheen)`，强调态使用活跃背景与文本色；动画光泽 `pod-chip-sheen`。
- 文本域（`src/styles/podui.css:387-393`）：`.pod-textarea` 透明背景与无边框方案，统一前景色。
- 菜单与列表（`src/styles/podui.css:395-418`）：`.pod-menu-item` 与 `.pod-list-item`，活跃态/悬浮态提升背景与文本色。
- 滚动条（`src/styles/podui.css:457-504`）：`.pod-scrollbar-x` 与 `.pod-scrollbar-y`，确保弱侵入与主题协调。

#### 交互状态规范
- Hover：轻微背景提升与边框/前景增强；例：`.pod-primary-button:hover`（`src/styles/podui.css:248-253`）。
- Active：位移微调（如 `translateY(-1px)`）与阴影收敛，保证点击反馈一致。
- Focus：统一焦点环 `--pod-ring` 颜色与强度；输入类使用 `box-shadow: var(--pod-ring)` 并以 `--pod-accent` 控制边框颜色。
- Disabled：透明度至 `0.5~0.6`，禁用指针；保持可读性且避免过度淡化。

#### 键盘与无障碍（A11y）
- 焦点可见：所有可交互元素需在 `:focus-visible` 显示统一焦点环。
- 对比度：正文文本最小 4.5:1，次级文本最小 3:1；暗色主题优先使用 `--text-heading` 与 `--text-primary`。
- ARIA 与角色：切换类按钮需使用 `aria-pressed` 或 `role="switch"`；菜单项/列表项需明确 `role="menuitem"/"listitem"`。

#### 命名与前缀
- 统一采用 `.pod-*` 前缀；变体使用语义化后缀（如 `-elevated`、`-transparent`、`-outline`、`-ghost`）。
- 尺寸类以 `-xs/-sm/-md` 缩写；禁用样式采用属性选择器 `[disabled]`。
- 组件内部避免未前缀类名穿透；旧类名需建立映射并在迁移期保留桥接。

#### 响应式与布局建议
- 断点建议（新增令牌）：`--bp-sm: 640px`、`--bp-md: 768px`、`--bp-lg: 1024px`、`--bp-xl: 1280px`。
- 间距刻度（新增令牌）：`--space-2: 8px`、`--space-3: 12px`、`--space-4: 16px`、`--space-5: 20px`；替换固定像素值，统一组件内边距与间距。
- 容器：面板类 `.pod-panel` 作为分区容器；工具栏 `.pod-toolbar` 作为浮动操作条；输入组 `.pod-input-group` 作为表单行容器。

#### 动效与性能
- 动画：`podWaveShift`、`podRadialPulse`、`pod-chip-sheen` 使用时机限定在主视觉与强调元素；避免滚动区域与高频交互元素启用持续动画。
- 性能：为动画类添加 `will-change` 并控制时长在 `48–64s`；移动端屏幕禁用高昂动画或降低透明度。

#### 兼容策略
- 令牌桥接：保留 `--ui-bg-color`、`--button-bg-color` 作为过渡桥接，逐步映射到统一令牌。
- 组件桥接：旧组件可逐步注入 `.pod-*` 类名组合，完成一致视觉后再清理旧样式。

### 高层任务拆分（规划）
1. 归档 Design Tokens 到 `:root` 并建立语义分层与别名映射
2. 输出组件规范对照表（Button/IconButton/Panel/Input/Menu/Chip/Scrollbar/Dialog）
3. 建立命名前缀与类映射（旧类 → `.pod-*`），并给出迁移策略
4. 统一交互状态（hover/active/focus/disabled）与无障碍规则（焦点环、ARIA、对比度）
5. 限定动效与渐变的使用边界，输出“允许使用的场景清单”
6. 封装基础组件（`src/ui/*`）并在高价值页面试投产（PromptBar/Toolbar/BoardPanel）
7. 扫描并替换硬编码样式为令牌与 `.pod-*` 类组合
8. 引入响应式断点与间距令牌，调整主要面板与工具栏的布局
9. 建立验收清单与对照页，完成视觉与交互回归
10. 记录经验与回滚路径，完成迁移收尾与旧样式清理

### 成功标准
- 设计令牌归档与组件规范对照表形成且落盘；核心组件（按钮/图标按钮/面板/输入/菜单/Chip/滚动条/对话遮罩）具备一致的交互状态。
- 关键页面（画布、工具栏、PromptBar、BoardPanel）完成至少一次替换并通过交互回归。
- 运行 `npm run lint`、`npx tsc --noEmit`、`npm run build` 全部通过；视觉与可达性验收（焦点环、对比度、键盘导航）通过。

### 项目状态看板（UI 设计）
- [x] 归档 Design Tokens 并建立语义分层
- [x] 输出组件规范对照表
- [x] 建立命名前缀与类映射（旧类 → `.pod-*`）
- [x] 统一交互状态与无障碍规则
- [x] 限定动效与渐变使用边界
- [ ] 封装并试投产基础组件（1 页）
- [x] 替换硬编码样式为令牌与类组合 (PromptBar)
  - 已移除 PromptBar 输入框的 Focus Ring（响应用户反馈）
- [x] 替换硬编码样式 (BananaSidebar/Toolbar/ContextToolbar)
  - 已将 BananaSidebar 卡片与遮罩样式提取至 `podui.css`
  - 已将 Toolbar 颜色选择器与滑块样式提取至 `podui.css`
  - 已将 ContextToolbar 样式提取至 `podui.css` 并修复错位问题
- [ ] 封装并试投产基础组件（1 页）
- [ ] 引入断点与间距令牌并调整布局
- [ ] 建立验收清单与对照页
- [ ] 清理旧样式与记录迁移经验

### 当前状态/进度跟踪
- 规划者：已输出 UI 设计标准草案，并将来源与引用标注至本文件；后续由执行者按“状态看板”逐项推进与验收。
- 执行者：
  - 已完成类名映射表。
  - 已在 `podui.css` 统一交互状态（Global Focus Ring, Disabled Opacity）。
  - 已完成 `PromptBar.tsx` 的硬编码样式替换。
  - 已完成 `BananaSidebar.tsx` 和 `Toolbar.tsx` 的硬编码样式替换，消除内联样式与复杂 Tailwind 类组合。
  - 已完成 `ContextToolbar.tsx` 的硬编码样式替换，引入 `.pod-context-*` 系列类，并修复了对齐错位问题。
  - **样式调整**：响应用户反馈（"紫色的选中按钮大太了"），调整了 ContextToolbar 按钮尺寸（36px -> 28px）与形状（圆形 -> 8px 圆角方形），并同步压缩了工具栏高度与间距，使其视觉更紧凑和谐。
  - **样式调整**：响应用户反馈（"PromptBar底色深一些"），将 PromptBar 背景色从硬编码的 `rgba(15, 13, 19, 0.95)` 统一为 `var(--bg-component)`，以确保与其他工具栏（如 PodToolbar）的视觉效果一致。
  - 已在 `podui.css` 中添加 Motion Safety Boundaries，并标准化了组件内的渐变使用。
- 关键发现：`GenerateButton` 的深绿色文本 `#062102` 尚无 Token 对应，已直接在 `.pod-generate-button` 中硬编码；建议后续增加 `--text-on-accent`。

### 命名前缀与类映射及迁移策略

#### 1. 颜色与令牌映射
| 硬编码 / Tailwind | PodUI Token / Class | 说明 |
| :--- | :--- | :--- |
| `bg-[#18181b]`, `bg-zinc-950` | `var(--bg-page)` | 基础底色，深黑色 |
| `bg-[#27272a]`, `bg-zinc-800` | `var(--bg-component)` | 组件/面板背景，深灰色 |
| `bg-[#3f3f46]`, `bg-zinc-700` | `var(--border-color)` (作为背景) | 较亮的组件背景或激活态 |
| `text-yellow-400` | `var(--brand-yellow)` / `var(--text-accent)` | 品牌强调色 |
| `text-neutral-200/300` | `var(--text-primary)` | 主要文本 |
| `text-neutral-400/500` | `var(--text-secondary)` | 次要文本 |
| `border-white/10`, `border-white/5` | `var(--border-color)` | 边框色 (需统一透明度或使用实色) |
| `bg-white/5`, `bg-white/10` | `.pod-btn-ghost` / `var(--bg-component)` | 幽灵按钮或半透明背景 |

#### 2. 组件类映射
| 旧组件模式 | PodUI 类 | 迁移策略 |
| :--- | :--- | :--- |
| `rounded-xl bg-white/5 ...` (菜单项) | `.pod-menu-item` | 替换 `className`，保留特定布局属性 |
| `p-1.5 rounded-full ...` (图标按钮) | `.pod-icon-button` | 替换并移除 `p-*`, `rounded-*` |
| `bg-[#18181b]/95 ... shadow-2xl` (浮动面板) | `.pod-toolbar-elevated` / `.pod-panel` | 统一使用 PodUI 面板类 |
| `border-white/10` | `border-[var(--border-color)]` | 优先使用 Token，逐步过渡到类 |

#### 3. 迁移策略
1.  **Token 优先**：第一阶段不改变 DOM 结构，仅将硬编码颜色值（HEX/RGB）替换为 `var(--...)`。这将确保颜色系统的一致性，同时风险最小。
2.  **原子类清理**：识别重复出现的原子类组合（如 `flex items-center justify-center w-10 h-10 rounded-full`），将其替换为对应的 PodUI 组件类（如 `.pod-icon-button`）。
3.  **视觉回归验证**：由于 `--bg-component` (#2a2a30) 可能比硬编码的 `#18181b` 更亮，替换时需在 `PromptBar` 等关键区域进行视觉比对。如果差异过大，考虑引入新的语义 Token（如 `--bg-floating`）。
4.  **渐进式替换**：按组件粒度进行（如先 `PromptBar`，后 `BananaSidebar`），每次替换后运行 lint 和 build 检查。

### 组件规范对照表（首版）
- Button（`src/styles/podui.css:213`）
  - 类：`pod-primary-button`、`pod-btn-secondary`、`pod-btn-ghost`、`pod-btn-outline`、尺寸：`pod-btn-xs/sm/md`
  - 默认：背景 `--text-accent`，文本 `--bg-page`，边框 `--text-accent`
  - Hover：背景/边框 `color-mix(in srgb, var(--brand-yellow), white 15%)`（`src/styles/podui.css:248-253`）
  - Disabled：`opacity: 0.6`，禁用指针（`src/styles/podui.css:255-257`）
  - 变体：Secondary/Outline/Ghost 以透明或浅色背景，悬浮加深（`src/styles/podui.css:268-305`）

- IconButton（`src/styles/podui.css:178`）
  - 类：`pod-icon-button`、`quick-prompts-button`
  - 默认：透明背景、44×44、圆角 15
  - Hover：浅色背景、边框 `--border-color`、文本升亮（`src/styles/podui.css:193-197`）
  - Disabled：`opacity: 0.5`，禁用指针（`src/styles/podui.css:208-211`）

- Panel（`src/styles/podui.css:88`）
  - 类：`pod-panel`、变体：`pod-panel-yellow-gradient`、`pod-panel-pill`、`pod-panel-transparent`
  - 背景 `--bg-component`，边框 `--border-color`，圆角 `--border-radius-lg`，阴影 `--shadow-md`
  - 变体提供渐变、磨砂与透明层次（`src/styles/podui.css:510-534`）

- Input（`src/styles/podui.css:324`）
  - 类：`pod-input`、尺寸：`pod-input-sm/md`
  - 默认：背景 `--pod-panel-bg`，边框 `--pod-border-color`，文本 `--pod-text-primary`
  - Focus：`box-shadow: var(--pod-ring)`，边框 `--pod-accent`（`src/styles/podui.css:332-334`）
  - Disabled：`opacity: 0.6`，禁用指针

- MenuItem / ListItem（`src/styles/podui.css:395`、`410`）
  - 类：`pod-menu-item`、`pod-list-item`（`selected` 高亮）
  - Hover/Active：浅色背景、文本升亮（`src/styles/podui.css:405-408`、`416-418`）

- Chip（`src/styles/podui.css:349`）
  - 类：`pod-chip`、变体：`pod-chip-image`、`pod-chip-video`、`pod-chip-circle(-sheen)` 等
  - Active：类型色背景、文本白色；悬浮：轻度加亮（`src/styles/podui.css:361-368`、`645-650`）
  - 动效：`pod-chip-sheen` 轻光泽动画（`src/styles/podui.css:571-574`）

- Scrollbar（`src/styles/podui.css:457`、`482`）
  - 类：`pod-scrollbar-x/y`，分别针对横向与纵向；主题协调、弱侵入

- Dialog Overlay（`src/styles/podui.css:338`）
  - 类：`pod-dialog-overlay`，固定覆盖、半透明遮罩、模糊遮罩
