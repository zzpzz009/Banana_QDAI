# BananaPod 项目状态记录

## UI 设计标准（PodUI v1.x）

### 背景和动机
- 统一 UI 设计令牌与基础组件，减少散落样式与重复实现，保证可维护性与一致视觉体验。
- 建立可执行的标准与验收流程，让后续功能迭代在不回归的前提下，渐进替换旧样式。
- 目标：以 `src/styles/podui.css` 为基础形成 Design System，覆盖颜色、排版、间距、圆角、阴影、动效、状态与无障碍规范。

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
  - 栅格参考：`--grid-dot-color`、`--grid-dot-opacity`
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
- [ ] 输出组件规范对照表
- [ ] 建立命名前缀与类映射（旧类 → `.pod-*`）
- [ ] 统一交互状态与无障碍规则
- [ ] 限定动效与渐变使用边界
- [ ] 封装并试投产基础组件（1 页）
- [ ] 替换硬编码样式为令牌与类组合
- [ ] 引入断点与间距令牌并调整布局
- [ ] 建立验收清单与对照页
- [ ] 清理旧样式与记录迁移经验

### 当前状态/进度跟踪
- 规划者：已输出 UI 设计标准草案，并将来源与引用标注至本文件；后续由执行者按“状态看板”逐项推进与验收。
- 执行者：已在 `:root` 归档并补齐 PodUI 令牌别名（`--pod-panel-bg`、`--pod-border-color`、`--pod-text-primary`、`--pod-radius-xs`、`--pod-transition-fast`、`--pod-ring`、`--pod-accent`、`--toolbar-bg-color`），保证 `.pod-input`、`.pod-input-group`、`.pod-icon-button` 等使用到的变量有定义。
- 关键引用：令牌与类定义见 `src/styles/podui.css:2`（令牌）、`src/styles/podui.css:88`（`.pod-panel`）、`src/styles/podui.css:178`（`.pod-icon-button`）、`src/styles/podui.css:213`（`.pod-primary-button`）、`src/styles/podui.css:110`（`.pod-input-group`）。
- 已修复：运行时报错 `TypeError: (p || []).slice(...).map is not a function`。原因：`useI18n.t` 统一返回字符串后，`BananaSidebar/QuickPrompts` 对内置数组使用了 `t('bananaCards'/'quickPrompts')`；现已在 `PromptBar` 传入 `language` 并在组件层使用 `translations[language].bananaCards/quickPrompts`。验证通过：`npm run lint`、`npx tsc --noEmit`、`npm run build` 与预览。

### 执行者反馈或请求帮助
- 执行时请保持“单文件 ≤ 250 行”的约束；基础组件拆分为小文件与变体文件，逐步替换并每次验收。
- 若发现未定义但被引用的 `--pod-*` 令牌，请在 `:root` 建立别名并记录桥接关系，再发起替换。
- 在大范围替换前请先于一页试投产（PromptBar 或 Toolbar），通过后再扩大覆盖面。

### 历史记录（简要）
- `App.tsx` 模块化重构（v1.1.0 基线）已完成并通过最终验收；本次 UI 标准化将在不改变逻辑的前提下进行视觉统一与组件化替换。
