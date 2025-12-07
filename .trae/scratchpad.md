# BananaPod 项目状态记录

## 背景和动机
用户要求将 BananaPod 的 UI 彻底重构为 **Aura Theme**（海军蓝/青色系），参考 `PodUI copy.html`。核心目标是建立统一、现代、具有品牌感（"Made in Aura"）的设计系统，并确保所有组件遵循此标准。

## 关键挑战和分析
1.  **一致性**：确保所有组件（Toolbar, Sidebar, Panels）使用相同的玻璃拟态和颜色变量。
2.  **去硬编码**：识别并替换散落在各个组件中的 hex 颜色代码。
3.  **交互反馈**：Hover、Active、Focus 状态需要统一的青色光晕效果。

## 高层任务拆分 (Aura UI 重构)

### 阶段一：基础建设 (已完成)
1.  **字体集成**：引入 Montserrat 和 Montserrat Alternates。
2.  **设计系统 (PodUI)**：建立 `podui.css`，定义 `--bg-page`, `--brand-primary` 等核心变量及 `pod-glass` 等工具类。
3.  **基础控件**：标准化 Input, Slider, Checkbox 样式。

### 阶段二：核心组件 (进行中)
19. **App 容器**：设置深色背景 (`#020617`) 及 "Made in Aura" 水印。
20. **PromptBar**：实现悬浮胶囊玻璃形态。
    - [ ] 参考 `PodUI copy.html` Input 样式
    - [ ] 整合 Generate Button 到输入框内部
    - [ ] 优化输入框 Focus/Hover 态
21. **Toolbar**：实现悬浮工具栏及选中态发光效果。

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

## 执行者反馈或请求帮助
- **Toolbar 样式**：已修正为 `PodUI copy.html` 中的 "图示样式" (Agewell Agent Card)。解决了用户反馈的“颜色不对”问题（之前使用了过深的 Teal 900 或纯色 #14B8A6，现在统一为 Navy 800 Glass + Teal Border）。

```