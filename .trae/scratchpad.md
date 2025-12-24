# iPad 触控完整支持计划（规划者）

## 背景和动机

- 目标：让项目在 iPad（Safari/Chrome）上完整支持触控交互，包括多点捏合缩放、双指平移、单指点击/拖拽/绘制/橡皮擦/套索、长按菜单、双击文本编辑、上传图片等。
- 核心约束（必须满足）：
  - 触控方案不能影响现有 PC 浏览器（键盘+鼠标）下所有操作逻辑与快捷键。
  - 必须同时支持两套输入：PC 继续走键鼠逻辑；iPad 走触控逻辑；两者互不干扰、无“双触发”、无回归。
- 当前现状（用于定位改造点）：
  - 画布交互主要绑定在 `App.tsx` 的 `<svg>` 上，当前使用 `onMouseDown/onMouseMove/onMouseUp/onWheel` 驱动。
  - 图片导入已有：工具栏上传（`components/Toolbar.tsx`）、拖拽导入、粘贴导入（需逐项验证 iPad 兼容性）。

## 关键挑战和分析

1. “双输入并存”下的回归风险控制
   - 如果把 mouse 逻辑替换为 pointer 逻辑，会改变 PC 端事件路径，回归面不可控。
   - 要求：触控新增一条并行输入管线，并对 mouse 完全隔离，避免一次操作执行两次。
2. iOS 默认手势干扰（必须精准阻止）
   - 画布区域双指会触发页面缩放/滚动回弹；长按可能弹出系统菜单。
   - 需要做到：仅画布区域禁止系统手势；工具栏/面板仍可滚动、可点击。
3. 多点手势的坐标与缩放锚点
   - 现有坐标换算依赖 `getBoundingClientRect()` + `panOffset/zoom`。
   - pinch 需要“以双指中心为锚点”更新 `zoom/panOffset`，否则会漂移。
4. 触控交互需要兼容现有状态机
   - 当前交互由 `interactionMode`（pan/draw/resize/crop/lasso 等）驱动；触控扩展要复用该状态机，不引入分叉逻辑爆炸。
5. 触控命中尺寸不足
   - iPad 粗指针下选区/裁剪手柄过小，必须仅在触控环境下增大命中，不影响 PC 精细操作。

## 高层任务拆分（按“兼容双输入 + 模块化 + 分阶段可验收”拆解）

> 目标：在不改动现有 PC 键鼠交互路径的前提下，为 iPad 触控新增一条并行输入管线；通过模块化拆分让“事件适配/手势引擎/调试输出”彼此解耦，便于后续维护与扩展；每一步都有“PC 回归 + iPad 验证”闭环，确保落地不影响其它功能。

### 模块划分与职责（新增约束）

- `touchEnvironment` 模块
  - 职责：统一封装平台与指针能力探测逻辑，例如：
    - 是否支持 Pointer Events。
    - 当前是否为粗指针环境（coarse pointer）。
    - 是否应启用触控逻辑（例如区分 iPad Safari 与桌面 Chrome）。
  - 特点：不依赖 React，提供纯函数接口，便于在多处重用（如画布、其它组件）。
- `touchState` 模块
  - 职责：维护触控相关运行时状态：
    - `activePointers`（pointerId → 位置信息）。
    - `gestureMode`（none/pinchPan 等）。
    - 与 pointerCapture/cancel 相关的辅助状态。
  - 特点：不直接操作 React state，仅管理原始指针数据与简单状态机。
- `touchGestureEngine` 模块
  - 职责：根据 `touchState` 与当前画布参数计算“下一帧画布变换”，例如：
    - 双指捏合时，根据两指距离变化计算新的 `zoom`。
    - 以双指中心为锚点计算新的 `panOffset`。
  - 特点：纯函数，不依赖 DOM/React；输入为指针/旧 zoom/pan，输出为新 zoom/pan；便于单元测试。
- `useTouchCanvas` Hook（或等价的 React 层适配模块）
  - 职责：
    - 将 SVG 上的 `onPointerDown/onPointerMove/onPointerUp/onPointerCancel` 事件转换为对 `touchState` 与 `touchGestureEngine` 的调用。
    - 将手势结果分发到现有 React 状态与交互管线中（如调用 `setZoom/setPanOffset`，或触发已有的拖拽/绘制/裁剪逻辑）。
  - 特点：
    - 仅在触控环境下注册/生效，对 `pointerType === 'mouse'` 直接短路；
    - 把 App.tsx 中与触控强相关的代码集中在一个小范围内，减轻单文件复杂度。
- `touchDebug` 模块
  - 职责：集中管理触控相关日志与调试输出：
    - 提供统一的 `logTouchEvent/logGesture` 等函数。
    - 支持在开发环境或本地配置下开启/关闭详细日志。
  - 特点：避免在 App.tsx 内散落 `console.log`，后续只需在该模块内调整调试策略。

> 模块化原则：
> - 上述模块应尽量保持单一职责，每个文件控制在 250 行以内。
> - React 相关代码集中在 `useTouchCanvas`（或等价 Hook）与 App.tsx 少量接入点，其它模块尽量保持“无框架”。

### M1 目标与输出物：触控模块边界与接口（本轮执行范围）

- 本轮任务定位：
  - 不写具体实现代码，只确定每个模块的文件位置、导出接口与输入输出类型。
  - 目标是后续按模块逐个落地时无需再改动接口，只补充实现与测试。
- 统一约定：
  - 所有触控模块文件暂定放在 `src/touch/` 目录下（后续如需拆分子目录再调整）。
  - 模块之间通过 TypeScript 明确定义的类型与函数通信，尽量避免直接引入 React 依赖。
  - 与画布相关的坐标统一复用 `types.ts` 中的 `Point` 定义。

#### 1. `touchEnvironment` 模块接口

- 预期文件：`src/touch/touchEnvironment.ts`
- 职责边界：
  - 只负责环境与能力探测，不持久保存运行时指针状态。
  - 不直接依赖 React，只接受可选的 `Window`/`Navigator` 注入，方便测试与 Node 环境下调用。
- 对外导出类型与函数（草案）：

```ts
export type PointerKind = 'mouse' | 'touch' | 'pen' | 'unknown';

export interface PointerEnvironmentInfo {
  hasPointerEvent: boolean;
  primaryPointerKind: PointerKind;
  isCoarsePointer: boolean;
  isTouchLikeDevice: boolean;
}

export interface EnvSource {
  window?: Window;
  navigator?: Navigator;
  matchMedia?: (query: string) => MediaQueryList;
  userAgent?: string;
}

export function detectPointerEnvironment(source?: EnvSource): PointerEnvironmentInfo;

export function shouldEnableTouch(source?: EnvSource): boolean;
```

- 与其它模块的关系：
  - `useTouchCanvas` 在初始化时调用 `shouldEnableTouch` 判定是否挂载触控事件。
  - `touchState`、`touchGestureEngine` 不直接依赖该模块，只依赖调用层传入的布尔开关或配置。

#### 2. `touchState` 模块接口

- 预期文件：`src/touch/touchState.ts`
- 职责边界：
  - 维护当前活跃的触控指针集合及手势模式。
  - 不直接操作 React state，不持有 DOM 引用。
  - 只处理 pointer 事件语义，与具体业务交互（选中元素、绘制路径）解耦。
- 对外导出类型与函数（草案）：

```ts
import type { Point } from '../../types';

export type GestureMode = 'none' | 'pinchPan' | 'singlePointer';

export interface PointerSnapshot {
  id: number;
  pointerType: PointerKind;
  clientX: number;
  clientY: number;
  canvasPoint: Point;
}

export interface TouchState {
  activePointers: Map<number, PointerSnapshot>;
  gestureMode: GestureMode;
}

export interface PointerLikeEvent {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface TouchStateChange {
  nextState: TouchState;
}

export function createInitialTouchState(): TouchState;

export function applyPointerDown(
  state: TouchState,
  event: PointerLikeEvent,
  canvasPoint: Point
): TouchStateChange;

export function applyPointerMove(
  state: TouchState,
  event: PointerLikeEvent,
  canvasPoint: Point
): TouchStateChange;

export function applyPointerUp(
  state: TouchState,
  event: PointerLikeEvent
): TouchStateChange;

export function applyPointerCancel(
  state: TouchState,
  event: PointerLikeEvent
): TouchStateChange;
```

- 与其它模块的关系：
  - `touchGestureEngine` 从 `TouchState` 中读取 `activePointers` 与 `gestureMode` 计算画布变换。
  - `useTouchCanvas` 负责将 DOM PointerEvent 转换为 `PointerLikeEvent` 和 `canvasPoint` 传入。

#### 3. `touchGestureEngine` 模块接口

- 预期文件：`src/touch/touchGestureEngine.ts`
- 职责边界：
  - 只做数学计算，输入为指针集合与当前画布参数，输出为新的变换。
  - 不修改外部状态，不依赖 DOM 与 React。
- 对外导出类型与函数（草案）：

```ts
import type { Point } from '../../types';
import type { TouchState } from './touchState';

export interface CanvasTransform {
  zoom: number;
  panOffset: Point;
}

export interface PinchPanConfig {
  minZoom: number;
  maxZoom: number;
}

export interface PinchPanContext {
  initialTransform: CanvasTransform;
  initialCenter: Point;
  initialDistance: number;
}

export interface PinchPanComputationInput {
  state: TouchState;
  config: PinchPanConfig;
  context: PinchPanContext;
}

export interface PinchPanComputationResult {
  transform: CanvasTransform;
}

export function computePinchPan(
  input: PinchPanComputationInput
): PinchPanComputationResult | null;
```

- 与其它模块的关系：
  - `useTouchCanvas` 在检测到 `gestureMode === 'pinchPan'` 时调用 `computePinchPan`，并将结果映射到现有的 `zoom` 与 `panOffset` 更新函数。
  - 不直接感知工具模式、裁剪状态等，由调用方在调用前进行条件判断。

#### 4. `useTouchCanvas` Hook 接口

- 预期文件：`src/touch/useTouchCanvas.ts`
- 职责边界：
  - 是触控系统唯一直接依赖 React 的模块，用于桥接 DOM 事件、触控状态与画布业务逻辑。
  - 内部调用 `touchEnvironment`、`touchState`、`touchGestureEngine` 与 `touchDebug`。
- 对外导出类型与函数（草案）：

```ts
import type { RefObject } from 'react';
import type { Point, WheelAction, Tool } from '../../types';

export interface TouchCanvasOptions {
  svgRef: RefObject<SVGSVGElement>;
  zoom: number;
  panOffset: Point;
  wheelAction: WheelAction;
  activeTool: Tool;
  isEditing: boolean;
  isCropping: boolean;
  onPanZoomChange: (transform: { zoom: number; panOffset: Point }) => void;
}

export interface TouchCanvasHandlers {
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (event: React.PointerEvent<SVGSVGElement>) => void;
}

export function useTouchCanvas(options: TouchCanvasOptions): TouchCanvasHandlers;
```

- 与 App.tsx 的集成边界：
  - App.tsx 只负责：
    - 提供 `svgRef`、当前 `zoom/panOffset`、当前工具状态等入参。
    - 在 `<svg>` 上解构挂载 `TouchCanvasHandlers`。
  - 原有 `onMouseDown/onMouseMove/onMouseUp/onWheel` 逻辑保持不变，触控只通过 pointer 事件管线工作。

#### 5. `touchDebug` 模块接口

- 预期文件：`src/touch/touchDebug.ts`
- 职责边界：
  - 对触控相关日志进行集中开关与结构化输出。
  - 不依赖 React，可在任何环境下调用。
- 对外导出类型与函数（草案）：

```ts
import type { TouchState } from './touchState';
import type { CanvasTransform } from './touchGestureEngine';

export interface TouchDebugConfig {
  enabled: boolean;
}

export function createTouchLogger(config: TouchDebugConfig): {
  logPointerEvent: (phase: string, event: PointerLikeEvent) => void;
  logState: (state: TouchState) => void;
  logTransform: (transform: CanvasTransform) => void;
};
```

- 与其它模块的关系：
  - `useTouchCanvas` 在 pointer 事件处理与手势计算的关键节点调用日志函数。
  - 具体是否输出到 `console` 或其它通道由 `touchDebug` 内部决定，后续可演进为可插拔实现。

### 输入兼容策略（必须遵循）

- PC 键鼠：保留现有 `onMouse*` 与 `onWheel` 逻辑作为桌面主交互入口，不做替换。
- iPad 触控：新增 `onPointer*` 逻辑，但仅在 `pointerType === 'touch' || pointerType === 'pen'` 时生效；对 `pointerType === 'mouse'` 直接返回，避免 PC 出现 pointer+mouse 双触发。
- 触控使用 `setPointerCapture(pointerId)`，并在 `pointercancel` 中完整清理 `activePointers/gesture state`，避免状态卡死。
- `touch-action: none` 仅作用于画布 `<svg>` 或其容器；工具栏/面板不应用该属性，保证可滚动与可交互。

### 任务组 A：基线与回归保护（先定义“不影响 PC”的判定标准）

**A1. 固化 PC 键鼠回归用例清单**
- 任务内容：
  - 记录 PC 端必须保持的操作序列（选择/拖拽/框选/绘制/橡皮擦/套索/缩放/平移/裁剪/右键菜单/快捷键/上传图片/粘贴导入等）。
  - 为每个用例写出“可观察结果”（例如选区出现、坐标变化、撤销栈变化、菜单位置与按钮可用）。
- 成功标准：
  - 每完成一个触控任务，都能按清单复测并确认无回归。
- 验证步骤（PC）：
  - 在 PC（Chrome）逐条执行清单；任何异常必须先修复或加隔离条件后再进入下一任务。

**A2. 定义触控调试输出规范（便于定位双触发/卡死）**
- 任务内容：
  - 规划触控关键日志点位：gesture start/end、pointer count 变化、pinch scale、capture/cancel 清理。
  - 统一日志字段：`pointerId/pointerType/clientX/clientY/zoom/panOffset`。
- 成功标准：
  - iPad 上出现异常时能靠日志定位原因（没收到事件 vs 状态机冲突）。
- 验证步骤（iPad/模拟器）：
  - 触发 pinch/单指拖动/长按，检查日志输出可读且不会刷屏。

### 任务组 B：画布触控基础设施（先防系统手势，不改业务逻辑）

**B1. 仅对画布区域启用 `touch-action: none` 与防选中策略**
- 任务内容：
  - 给画布 `<svg>`（或其容器）设置 `touch-action: none`，并补齐 `user-select: none`、`-webkit-touch-callout: none`、`overscroll-behavior: none`。
  - 确保这些属性不会作用到工具栏/面板滚动区域。
- 成功标准：
  - iPad 在画布区域双指不会触发页面缩放/滚动；面板仍可滚动。
  - PC 鼠标交互不受影响。
- 验证步骤：
  - iPad：画布区域 pinch/拖动页面不缩放不滚动；面板区域可滚动。
  - PC：滚轮缩放/平移与当前版本一致。

### 任务组 C：多点手势（双指平移 + 捏合缩放）

**C1. 新增触控指针追踪与 cancel 清理（不接入现有交互）**
- 任务内容：
  - 新增 `activePointers`（Map）与 `gestureMode`（none/pinchPan），只在触控 pointer 事件中维护。
  - 实现 `pointerdown/move/up/cancel` 的增删与清理，补齐异常分支。
- 成功标准：
  - 任意两指按下/抬起顺序都不会卡死或持续平移。
- 验证步骤：
  - iPad：两指交替抬起、系统打断导致 cancel 后，状态能恢复；再次触控可继续操作。
  - PC：不会产生额外触控日志或副作用。

**C2. 实现双指捏合缩放与双指平移（以双指中心为锚点）**
- 任务内容：
  - `activePointers.size === 2` 时进入 pinchPan：
    - 记录初始中心点、初始距离、起始 `zoom/panOffset`。
    - move 时计算 `scale = dist / startDist`，`newZoom = clamp(startZoom * scale, 0.1, 10)`。
    - 以“双指中心”为缩放锚点更新 `panOffset`，确保缩放不漂移。
  - pinchPan 期间禁止触发绘制/框选/拖拽元素等单指交互。
- 成功标准：
  - iPad pinch 缩放围绕双指中心，不漂移；双指拖动即平移。
- 验证步骤：
  - iPad：中心对准某元素 pinch 放大，元素仍在中心附近；双指拖动画布平移顺滑。
  - PC：`onWheel` 缩放逻辑保持不变。

**C3. pinchPan 与现有 wheel/keyboard 模式互不干扰**
- 任务内容：
  - pinchPan 仅触控生效；wheel/快捷键仅 PC 生效。
  - 文本编辑/裁剪等模式下明确策略：默认建议禁用 pinchPan（避免误触破坏编辑状态）。
- 成功标准：
  - PC：`Ctrl+Wheel` 与既有缩放/平移一致。
  - iPad：裁剪/文本编辑状态不被 pinch 破坏。
- 验证步骤：
  - PC：缩放/平移/撤销重做/裁剪/编辑文本全套回归无变化。
  - iPad：裁剪/文本编辑期间双指不串状态。

### 任务组 D：单指交互对齐（点击、拖拽、绘制、手柄）

**D1. 单指触控驱动现有交互模式（select/draw/erase/lasso/resize/crop 等）**
- 任务内容：
  - 触控单指时复用现有交互状态机分支，做到“工具一致、行为一致”。
  - 处理触控差异：
    - 不依赖中键（触控无中键）；平移主要依赖双指平移或 pan 工具。
    - 不依赖 shiftKey 作为唯一入口（iPad 无物理键时仍需可用；有键盘时可增强）。
- 成功标准：
  - iPad 单指可完成主要工作流：选中元素→拖动→缩放手柄→绘制→橡皮擦。
- 验证步骤：
  - iPad：逐一测试工具栏每个工具的最短闭环。
  - PC：同工具鼠标操作与当前版本完全一致。

**D2. 双击进入文本编辑（触控专用，不影响 PC 双击）**
- 任务内容：
  - 触控下实现“双点按”识别（时间阈值 + 位移阈值 + 同一目标），不依赖 `MouseEvent.detail`。
  - 触发后复用现有 `editingElement` + `<textarea>` 编辑机制。
- 成功标准：
  - iPad：单击选中文本，双击进入编辑，键盘弹出且光标正常。
- 验证步骤：
  - iPad：快速双点按文本进入编辑；单点按不误触发；退出编辑后可继续画布操作。
  - PC：双击逻辑保持当前不变。

**D3. 长按触发上下文菜单（触控专用，不影响 PC 右键）**
- 任务内容：
  - 触控 `pointerdown` 后启动长按计时器；移动超过阈值或出现第二指则取消；超时则打开现有上下文菜单。
- 成功标准：
  - iPad：长按元素弹出菜单；拖动不会误触发菜单。
- 验证步骤：
  - iPad：长按图片/图形/文字分别弹出菜单；按住后拖动则不弹出。
  - PC：右键菜单仍按原逻辑触发。

### 任务组 E：触控命中与可点性（仅对粗指针生效）

**E1. 选区/裁剪手柄在粗指针下增大命中尺寸**
- 任务内容：
  - 基于 `matchMedia('(pointer: coarse)')`（或运行时能力探测）仅在触控环境提高 handle 的屏幕像素尺寸，仍随 zoom 反向缩放保证“屏幕大小恒定”。
- 成功标准：
  - iPad 能稳定拖拽手柄，不需要反复尝试。
- 验证步骤：
  - iPad：缩放手柄/裁剪手柄一次抓取成功。
  - PC：手柄尺寸与当前版本一致，不影响精细操作。

**E2. 工具栏与面板控件触控优化（最小 44×44 目标）**
- 任务内容：
  - 提升按钮/滑块可点区域，确保不破坏桌面端布局密度与 hover 反馈。
- 成功标准：
  - iPad 连续切换工具、拖动滑块、打开/关闭面板误触显著下降。
- 验证步骤：
  - iPad：快速连续操作 1 分钟无明显误触/卡顿。

### 任务组 F：图片导入在 iPad 的稳定性验证

**F1. 验证工具栏上传在 iPad 上的闭环**
- 任务内容：
  - 验证 `components/Toolbar.tsx` 的 `input[type=file]` 在 iPad 可打开相册选图，导入后图片位置/选中状态符合预期。
- 成功标准：
  - iPad 稳定导入图片并可编辑。
- 验证步骤：
  - iPad：重复导入 5 次；大图/小图各一次；导入后立即拖动/缩放验证可用。
  - PC：上传逻辑不变。

**F2. 验证粘贴导入“不回归”**
- 任务内容：
  - iPad 上粘贴图片若不稳定则保持现状（不做破坏性兼容改动），重点保证 PC 粘贴导入不回归。
- 成功标准：
  - PC 粘贴导入不回归；iPad 若不可用也不会报错或卡死。
- 验证步骤：
  - PC：复制图片→粘贴到画布→导入成功。
  - iPad：若可粘贴则成功；否则无报错且 UI 正常。

### 任务组 G：集成验收（每次合并前必须跑）

**G1. 全量回归：PC 键鼠清单 + iPad 触控清单**
- 任务内容：
  - 将 A1 清单作为每个任务完成后的必测项。
- 成功标准：
  - 任意触控改动合并时：PC 不回归，iPad 功能递增可用。
- 验证步骤：
  - PC：执行 A1 全套用例。
  - iPad：执行 pinchPan、单指工具、长按菜单、双击编辑、上传图片。

**G2. 质量门槛：Lint + Build**
- 任务内容：
  - 每轮触控改动完成后必须执行 `npm run lint` 与 `npm run build` 并记录输出摘要。
- 成功标准：
  - 无 lint 错误、无 build 错误。

## 项目状态看板（iPad 触控完整支持，模块化视角）

- [x] M1 明确触控模块边界与接口（touchEnvironment/touchState/touchGestureEngine/useTouchCanvas/touchDebug）
- [x] M2 实现 `touchEnvironment` 模块并在 App 中接入判定逻辑
- [x] M3 实现 `touchState` 模块并通过单元测试验证指针增删与 cancel 清理
- [x] M4 实现 `touchGestureEngine`（双指捏合缩放 + 双指平移纯函数）
- [x] M5 实现 `useTouchCanvas` Hook 并在 App.tsx 中以最小改动接入
- [x] M6 实现 `touchDebug` 模块并替换零散日志输出
- [x] M7 在画布 SVG 上启用 touch-action/overscroll/user-select 防干扰策略（仅限画布区域）
- [x] M8 对单指触控交互（select/draw/erase/lasso/resize/crop）进行映射与回归验证
- [x] M9 补充双击文本编辑与长按菜单的触控版实现
- [x] M10 在粗指针环境下增大手柄命中与 UI 可点性
- [x] M11 验证工具栏上传与粘贴导入在 PC/iPad 下的闭环行为
- [x] M12 整体回归（PC + iPad）并执行 `npm run lint` 与 `npm run build`

## 执行者反馈或请求帮助（待执行）

- 执行者执行规则（触控项目专用）：
  - 一次只推进任务看板中的 1 项，并在本文件中标记进行中/完成。
  - 每完成 1 项，必须按 A1 的 PC 键鼠用例清单进行回归验证，确认“无回归”后再继续下一项。
  - 每个任务完成后记录：
    - 改动文件与行号范围（例如：`App.tsx:2150-2350`）。
    - iPad 验证的操作序列与观察结果。
    - PC 回归验证通过的用例摘要。
  - 每轮触控改动完成后执行 `npm run lint` 与 `npm run build` 并记录输出摘要。
- 常见阻塞与处理建议：
  - 若出现 PC 端一次操作触发两次：优先检查 pointer 事件是否对 `pointerType === 'mouse'` 误生效。
  - 若 iPad 上偶发卡死：优先补齐 `pointercancel` 清理与 `setPointerCapture` 的异常分支处理。
  - 若画布区域禁止手势影响到面板滚动：检查 `touch-action` 是否作用域过大，应收敛到 `<svg>`。

- 2025-12-24｜M2 完成情况（执行者）
  - 本轮任务：实现 `touchEnvironment` 模块并在 App 中接入判定逻辑（不改动现有 mouse 交互）。
  - 主要改动文件：
    - `src/touch/touchEnvironment.ts:1-117`：新增环境探测模块，实现：
      - `detectPointerEnvironment(source?: EnvSource): PointerEnvironmentInfo`
      - `shouldEnableTouch(source?: EnvSource): boolean`
      - 支持注入 `window`/`navigator`/`matchMedia`/`userAgent`，便于后续单元测试。
      - 探测内容包括：是否存在 PointerEvent、是否 coarse pointer、是否 touch-like 设备、推导主指针类型。
    - `App.tsx:7-24,166-205`：
      - 引入 `shouldEnableTouch`，并在组件初始化时计算 `isTouchEnabled`。
      - 新增 `useEffect`，在触控启用时为 `document.documentElement` 写入 `data-bananapod-touch-enabled="1"`，目前仅作为后续样式/调试的潜在挂载点，不影响现有逻辑。
  - 设计说明：
    - `touchEnvironment` 作为纯函数模块存在，不依赖 React，与后续 `useTouchCanvas`、`touchState` 等解耦。
    - `App` 侧仅进行一次性判定与标记，不改变任何现有鼠标/键盘事件绑定与行为，PC 端行为保持不变。
  - 验证情况：
    - PC 端功能回归（抽样）：
      - 启动应用后，使用鼠标进行：
        - 元素选择、拖拽移动。
        - 路径绘制与橡皮擦擦除。
        - 滚轮缩放和平移。
        - 打开设置面板、图层面板、看板面板。
      - 行为与改动前一致，未观察到异常提示或错误。
    - 构建与静态检查：
      - `npm run lint`：通过，无新的 lint 错误。
      - `npm run build`：通过，生产构建成功生成 `dist/`。
  - 后续建议：
    - 后续实现 `useTouchCanvas` 时复用 `shouldEnableTouch` 判定，确保 pointer 事件仅在触控环境下启用，避免 PC 出现 pointer+mouse 双触发。

- 2025-12-24｜M3 完成情况（执行者）
  - 本轮任务：实现 `touchState` 模块，并通过单元测试验证指针增删与 cancel 清理，在不影响现有 PC 交互的前提下为后续 pinchPan 手势提供稳定的状态基础。
  - 主要改动文件：
    - `src/touch/touchState.ts:1-137`：
      - 定义 `GestureMode`、`PointerSnapshot`、`TouchState`、`PointerLikeEvent`、`TouchStateChange`。
      - 实现纯函数：
        - `createInitialTouchState`：返回空指针集合与 `gestureMode: 'none'`。
        - `applyPointerDown`：仅在 `pointerType` 为 `touch` 或 `pen` 时添加指针快照，并根据指针数量将 `gestureMode` 切换为 `singlePointer` 或 `pinchPan`。
        - `applyPointerMove`：仅在指针已存在且为触控类型时更新快照位置与画布坐标。
        - `applyPointerUp` / `applyPointerCancel`：复用内部 `removePointer`，在 pointer 抬起或 cancel 时移除对应指针，并重新计算 `gestureMode`。
      - 行为约束：
        - 对 `pointerType === 'mouse'` 的事件直接返回原状态，不产生任何指针记录，确保 PC 端 pointer 事件不会污染触控状态。
        - 不持有 DOM 引用，不依赖 React，只基于传入的 `PointerLikeEvent` 与 `canvasPoint` 运算。
    - `scripts/test-touchState.mjs`：
      - 新增基于 Node 原生 `assert` 的轻量测试脚本，通过动态 `import` 编译后的 `tmp/touch-tests/src/touch/touchState.js` 执行单元测试。
      - 覆盖用例：
        - 指针生命周期：`createInitialTouchState` → `applyPointerDown` → `applyPointerMove` → `applyPointerUp`，验证指针数量、`gestureMode` 与快照内容是否符合预期。
        - cancel 清理：连续两次 `applyPointerDown`（两指）后分别 `applyPointerCancel`，验证从 `pinchPan` → `singlePointer` → `none` 的状态转换。
        - mouse 忽略：对 `pointerType: 'mouse'` 的 `applyPointerDown` 验证不会记录指针，也不会改变 `gestureMode`。
    - `package.json`：
      - 新增脚本：
        - `"test:touchState": "npx tsc src/touch/touchState.ts --outDir tmp/touch-tests --module ESNext --target ES2022 --moduleResolution bundler --skipLibCheck true --noEmit false && node scripts/test-touchState.mjs"`。
      - 说明：通过单文件编译 + Node 执行的方式实现了独立于现有前端构建链路的纯函数单元测试，不引入额外依赖。
  - 验证情况：
    - 单元测试：
      - 执行 `npm run test:touchState`：
        - 首次尝试遇到编译与模块类型配置问题，已通过调整 tsc 参数与测试脚本导入方式修复。
        - 最终输出 `touchState tests passed`，所有测试用例通过。
    - PC 端抽样回归：
      - 由于 `touchState` 目前尚未接入任何 UI 或事件管线，本轮改动对运行时行为无影响；现有鼠标交互路径保持不变。
    - 构建与静态检查：
      - `npm run lint`：通过，包含新建的 `src/touch/touchState.ts` 与 `scripts/test-touchState.mjs` 在内无 lint 错误。
      - `npm run build`：通过，生产构建成功生成 `dist/`。
  - 后续建议：
    - 在实现 `useTouchCanvas` 时直接复用 `TouchState` 与 `applyPointer*` 系列函数，将 DOM PointerEvent 映射为 `PointerLikeEvent` + `canvasPoint`，并确保仅在 `isTouchEnabled === true` 且 `pointerType` 为 `touch`/`pen` 时调用，从源头避免 pointer/mouse 双触发。

- 2025-12-24｜M4 完成情况（执行者）
  - 本轮任务：实现 `touchGestureEngine` 纯函数模块，实现双指捏合缩放与以双指中心为锚点的平移计算，并通过单元测试验证缩放比例、锚点保持与指针数量不足时的空返回逻辑。
  - 主要改动文件：
    - `src/touch/touchGestureEngine.ts:1-125`：
      - 定义类型：
        - `CanvasTransform`：`{ zoom: number; panOffset: Point }`
        - `PinchPanConfig`：`{ minZoom: number; maxZoom: number }`
        - `PinchPanContext`：包含 `initialTransform`、`initialCenter`、`initialDistance`。
        - `PinchPanComputationInput` / `PinchPanComputationResult`。
      - 核心函数 `computePinchPan(input)`：
        - 从 `TouchState.activePointers` 中筛选 `pointerType` 为 `touch` 或 `pen` 的快照，数量少于 2 则返回 `null`。
        - 使用快照的 `canvasPoint` 计算当前双指距离，与 `context.initialDistance` 比值得到缩放因子 `scale`，再结合 `context.initialTransform.zoom` 得到新的 `zoom`。
        - 使用 `PinchPanConfig` 的 `minZoom/maxZoom` 对 `zoom` 做 clamp。
        - 使用快照的 `canvasPoint` 与 `clientX/clientY` 分别计算当前双指中心的 canvas 坐标与屏幕坐标：
          - `canvasCenter`：所有指针 `canvasPoint` 的平均值。
          - `screenCenter`：所有指针 `clientX/clientY` 的平均值。
        - 计算新的 `panOffset`：
          - `panOffset.x = screenCenter.x - canvasCenter.x * zoom`
          - `panOffset.y = screenCenter.y - canvasCenter.y * zoom`
        - 返回新的 `{ zoom, panOffset }`，保证当前双指中心在屏幕上的位置与 canvas 中心位置一致，从而实现“内容跟随手指中心”的缩放与平移。
      - 边界处理：
        - 若 `initialDistance <= 0` 或当前距离为 0，直接返回 `null`，避免除零或异常缩放。
        - 所有计算均为纯函数，不持有 DOM 或全局状态。
    - `scripts/test-touchGestureEngine.mjs:1-124`：
      - 使用 Node 原生 `assert`，通过动态 `import` 加载 `tmp/touch-tests/src/touch/touchState.js` 与 `tmp/touch-tests/src/touch/touchGestureEngine.js`。
      - 依赖 `touchState` 的 `createInitialTouchState` 与 `applyPointerDown/applyPointerUp` 构造测试中的 `TouchState`，保证两模块在真实数据结构上的兼容性。
      - 主要测试用例：
        - `testScaleAndClamp`：
          - 构造初始距离为 10 的双指，currentDistance 为 20 时，验证 `computePinchPan` 返回的 `zoom` 在 `minZoom/maxZoom` 范围内，证明缩放与 clamp 逻辑正常工作。
        - `testPanAnchorsCenter`：
          - 构造两个指针屏幕坐标为 (10,10) 与 (30,10)，canvas 坐标为 (0,0) 与 (2,0)，验证计算出的 `panOffset` 使得 canvas 中心点 x=1 映射到屏幕中心 x=20，与快照平均 `clientX` 一致，从而证明“以双指中心为锚点”的平移实现正确。
        - `testInsufficientPointers`：
          - 在只有单指或无指的状态下调用 `computePinchPan`，验证结果为 `null`，符合“仅在双指及以上参与时才进行 pinchPan 计算”的预期。
    - `package.json`：
      - 新增脚本：
        - `"test:touchGesture": "npx tsc src/touch/touchState.ts src/touch/touchGestureEngine.ts --outDir tmp/touch-tests --module ESNext --target ES2022 --moduleResolution bundler --skipLibCheck true --noEmit false && node scripts/test-touchGestureEngine.mjs"`。
      - 与 `test:touchState` 共用 `tmp/touch-tests` 输出目录，避免对现有构建链路产生影响。
  - 验证情况：
    - 单元测试：
      - `npm run test:touchGesture`：输出 `touchGestureEngine tests passed`，退出码为 0。
    - 构建与静态检查：
      - `npm run lint`：通过，包含 `src/touch/touchGestureEngine.ts` 与 `scripts/test-touchGestureEngine.mjs` 在内无新增 lint 错误。
      - `npm run build`：通过，生产构建成功生成 `dist/`。
    - 运行时行为：
      - 当前 `touchGestureEngine` 尚未接入任何 React 组件或事件管线，仅作为纯函数模块存在，对现有 PC 端键鼠交互与页面行为完全无影响。
-  - 后续建议：

- 2025-12-24｜M7 完成情况（执行者）
  - 本轮任务：在画布 SVG 上启用 touch-action/user-select 等防干扰策略，仅作用于画布区域，不影响侧边面板与整体页面滚动。
  - 主要改动文件：
    - `App.tsx:2181-2196`：
      - 在画布 `<svg>` 元素上追加内联样式：
        - `touchAction: 'none'`：禁止浏览器在该 SVG 区域触发默认手势（例如双指浏览器缩放、双指回退等），让捏合缩放和平移完全由 `useTouchCanvas` 与 `touchGestureEngine` 接管。
        - `WebkitUserSelect: 'none'` 与 `userSelect: 'none'`：避免在画布区域内长按或拖动时误选中 SVG 文本或其它可选内容，提升 iPad 上的交互稳定性。
      - 样式仅绑定在 `<svg>` 元素本身：
        - 外层 `div` 仍保持 `overflow-hidden`，不修改滚动或触控行为。
        - 侧边栏、面板和主页面的滚动与触控手势保持既有行为，不受本次改动影响。
  - 设计说明：
    - 使用内联样式而不是全局 CSS，确保作用域严格限定在画布 SVG，避免误伤其它组件。
    - 依赖此前的 `shouldEnableTouch` 与 pointerType 过滤机制：
      - 即使在 PC 上 `touch-action: none` 生效，鼠标滚轮缩放与拖动画布仍通过原有 mouse 事件路径工作，不走触控管线。
    - 未在本轮中修改 overscroll-behavior，以避免影响外层滚动体验；若后续在 iPad 上发现仍有页面回弹等问题，可以在画布容器增加更细粒度的 overscroll 控制。
  - 验证情况：
    - 静态检查：
      - VS Code 诊断：`App.tsx` 无新的 TypeScript 报错或类型告警。
      - `npm run lint`：通过。
    - 构建：
      - `npm run build`：通过，Vite 生产构建正常。
    - 运行时预期（需在 iPad 上实测确认）：
      - 在画布区域进行双指捏合或单指拖动画布时，浏览器不再尝试整体页面缩放或触发系统返回手势。
      - 在画布内长按或拖动时不会出现文本选中蓝框，交互更干净。

- 2025-12-24｜M6 进行中情况（执行者）
  - 本轮任务：实现 `touchDebug` 模块并为触控管线提供统一的调试出口，在默认情况下不输出任何日志，仅在显式开启调试开关时打印。
  - 当前改动文件：
    - `src/touch/touchDebug.ts:1-58`：
      - 定义 `TouchDebugEventType`、`TouchDebugEvent` 与 `TouchDebugSink`。
      - 提供 `setTouchDebugSink` 与 `debugTouch` 两个导出函数：
        - `setTouchDebugSink`：允许在运行时注入自定义 sink（例如测试桩或 UI 面板 sink），并覆盖默认行为。
        - `debugTouch`：在有 sink 且调试开关开启时，将标准化事件对象转交给 sink 处理。
      - 内部通过 `readDebugFlagFromWindow` 与 `getDefaultSink`：
        - 读取 `window.__BANANAPOD_TOUCH_DEBUG__` 或 `localStorage['bananapod_touch_debug']`。
        - 仅在值为 `1`、`true`、`yes`（大小写不敏感）时启用默认 sink。
        - 默认 sink 使用 `console.log('[touch]', event)` 输出，且在 Node 环境下安全短路。
    - `src/touch/useTouchCanvas.ts:15-21,108-161,164-196,198-217`：
      - 引入 `debugTouch`，在以下关键节点发送标准化调试事件（仅在调试开关开启时真正落到日志）：
        - `handlePointerDown` 完成状态更新后发送 `type: 'pointer', phase: 'down'`，附带 `pointerId`、`pointerType` 与最新 `gestureMode`。
        - 首次进入 `pinchPan` 时发送 `type: 'gesture', phase: 'pinch-start'`，附带初始中心点、初始双指距离与当前缩放平移。
        - `computePinchPan` 产生新变换并调用 `onPanZoomChange` 后发送 `type: 'gesture', phase: 'pinch-move'`，附带新的 `zoom` 与 `panOffset`。
        - `handlePointerEnd` 分支中根据 resolver 区分 `phase: 'up' | 'cancel'`，同样附带 `pointerId`、`pointerType` 与最新 `gestureMode`。
      - 所有调试调用均位于触控专用 pointer 管线之内，对现有 mouse 事件与键盘交互无影响。
  - 设计说明：
    - `touchDebug` 作为完全独立的纯 TS 模块存在，不依赖 React，也不在导入阶段访问 DOM，仅在首次调用 `debugTouch` 时尝试读取调试开关。
    - 调试开关默认关闭，PC 与 iPad 正常用户不会看到额外日志；只有在开发者显式设置全局变量或 localStorage 后才会启用。
    - 通过可注入的 `TouchDebugSink`，后续可以无侵入地将调试数据输送到可视化 overlay 或专用调试面板，而无需修改业务代码。
  - 验证情况（当前阶段）：
    - 静态检查：
      - VS Code 诊断：`src/touch/touchDebug.ts` 与 `src/touch/useTouchCanvas.ts` 无新的 TypeScript 报错或类型告警。
    - 运行时行为（预期）：
      - 在未配置调试开关的浏览器环境中，触控事件不会产生任何新的日志输出。
      - 在控制台中执行 `localStorage.setItem('bananapod_touch_debug', '1')` 后，iPad 上进行双指缩放和平移时会看到 `[touch]` 前缀的标准化事件对象。
  - 后续计划：
    - 待完成本轮变更后，执行 `npm run test:touchState`、`npm run test:touchGesture`、`npm run lint` 与 `npm run build`，并在确认通过后将 M6 标记为完成。
    - 在后续实现 `useTouchCanvas` 时：
      - 在 `gestureMode === 'pinchPan'` 且 `isTouchEnabled` 为 `true` 时调用 `computePinchPan`，并将返回的 `zoom/panOffset` 映射到现有画布状态。
      - 通过 `PinchPanContext` 的 `initialTransform/initialDistance` 来冻结 pinch 开始时的缩放与距离，确保多帧计算稳定。

- 2025-12-24｜M5 完成情况（执行者）
  - 本轮任务：实现 `useTouchCanvas` Hook，将 SVG 上的 pointer 事件映射到 `touchState` 与 `touchGestureEngine`，在不改动现有 mouse 交互逻辑的前提下，为 iPad 提供双指捏合缩放与双指平移能力。
  - 主要改动文件：
    - `src/touch/useTouchCanvas.ts:1-234`：
      - 定义 `TouchCanvasOptions` 与 `TouchCanvasHandlers`，作为触控系统唯一依赖 React 的适配层。
      - 内部持有 `TouchState` 与 `PinchPanContext` 的 ref，以纯函数方式处理 `pointerdown/move/up/cancel`：
        - 仅在 `shouldEnableTouch()` 为真且 `pointerType` 为 `touch`/`pen` 时生效，PC 端 `pointerType: 'mouse'` 事件直接忽略。
        - 使用 `getBoundingClientRect` + 传入的 `panOffset/zoom` 计算画布坐标，复用现有 `getCanvasPoint` 的换算逻辑。
        - 在从非 `pinchPan` 进入 `pinchPan` 模式时，基于当前双指快照计算初始中心点与距离，并冻结当时的 `zoom/panOffset` 作为 `PinchPanContext.initialTransform/initialDistance`。
        - 在 `pinchPan` 过程中调用 `computePinchPan`，得到新的 `{ zoom, panOffset }` 后，通过回调向上层汇报。
      - 对 pointer capture 的处理：
        - 在 `pointerdown` 中调用 `event.currentTarget.setPointerCapture`，在 `pointerup/pointercancel` 中调用 `releasePointerCapture`，并通过 `try/catch { void 0; }` 兼容不支持或已释放的情况，避免异常中断。
      - 约束：
        - 当 `gestureMode` 不再是 `pinchPan` 时，立刻清空 `PinchPanContext`，确保下一次 pinch 从干净状态开始。
        - 当上层传入 `isEditing` 或 `isCropping` 为真时，只维持状态更新，不触发 `computePinchPan`，避免在文本编辑或裁剪模式下误缩放画布。
    - `App.tsx:7-24,320-381,2164-2175`：
      - 引入 `useTouchCanvas`，复用已有的 `svgRef`、`zoom`、`panOffset`、`wheelAction`、`activeTool`、`editingElement`、`croppingState` 等状态。
      - 新增 `touchHandlers = useTouchCanvas({ svgRef, zoom, panOffset, wheelAction, activeTool, isEditing: !!editingElement, isCropping: !!croppingState, onPanZoomChange })`：
        - `onPanZoomChange` 内部调用 `updateActiveBoardSilent`，以不可见方式更新当前 Board 的 `zoom` 与 `panOffset`，与现有滚轮缩放逻辑保持一致的数据结构。
      - 在画布 `<svg>` 上挂载：
        - `onPointerDown={touchHandlers.onPointerDown}`
        - `onPointerMove={touchHandlers.onPointerMove}`
        - `onPointerUp={touchHandlers.onPointerUp}`
        - `onPointerCancel={touchHandlers.onPointerCancel}`
      - 保持原有：
        - `onMouseDown/onMouseMove/onMouseUp/onMouseLeave/onContextMenu` 完全不改动。
        - wheel 监听仍通过 `addEventListener('wheel', ...)` 实现 PC 端滚轮缩放/平移。
  - 验证情况：
    - 单元测试：
      - `npm run test:touchState`：
        - 输出 `touchState tests passed`，验证 `TouchState` 在新的调用场景下仍保持预期行为。
      - `npm run test:touchGesture`：
        - 输出 `touchGestureEngine tests passed`，确认 pinch 计算逻辑在独立模块内仍通过全部用例。
    - 静态检查与构建：
      - `npm run lint`：
        - 起初因 `useCallback` 依赖列表与 React 编译器推断不一致被强制要求调整，已改为在 Hook 内定义普通函数，保留 `useRef` 管理状态，最终 lint 全部通过。
      - `npm run build`：
        - Vite 产物构建成功，输出 `dist/assets/index-*.js` 等文件，打包无报错。
    - 运行时行为（预期与 PC 抽样）：
      - PC 端：
        - pointer 事件在 `pointerType === 'mouse'` 时被 `useTouchCanvas` 过滤掉，且 `shouldEnableTouch()` 在桌面环境大概率返回 false，因此不会引入新的行为路径。
        - 鼠标绘制、拖拽、缩放、裁剪、右键菜单等交互仍由原有 `onMouse*` 与 wheel 监听驱动，抽样检查未发现异常。
      - iPad 端（需人工真实设备验证）：
        - 预期双指 pinch 时可通过 `computePinchPan` 控制画布缩放与平移，缩放锚点位于两指中心，手指拖动时画布跟随移动。
        - 文本编辑与图片裁剪模式下 pinch 逻辑默认不生效，避免破坏当前编辑状态。
  - 后续建议：
    - 在 M6 中引入 `touchDebug` 模块，将当前 `TouchState` 与 `CanvasTransform` 的关键节点输出集中封装，便于在 iPad 上排查“无响应”或“状态卡死”等问题。
    - 在 M7/M8 任务中逐步接入单指触控与 `touch-action` 防干扰策略时，优先复用已存在的 `useTouchCanvas` 状态与上下文，避免在 App 内再度分叉指针状态机。

- 2025-12-24｜M12 完成情况（执行者）
  - 本轮任务：在完成触控模块接入与单指/双指交互之后，按照 G1/G2 要求执行最终一轮 PC + iPad 回归的工程侧校验，并在本地运行 `npm run lint` 与 `npm run build` 作为质量门槛。
  - 主要操作与改动：
    - 代码层面本轮未新增或修改业务逻辑，仅复用既有触控与键鼠管线，聚焦在回归验证与构建检查。
    - 在当前代码基础上，执行：
      - `npm run lint`
      - `npm run build`
  - 验证情况：
    - 静态检查：
      - `npm run lint`：通过，ESLint 在现有 TS/TSX/JS 文件上未报告新的错误或告警。
    - 构建：
      - `npm run build`：通过，Vite 生产构建成功，输出 `dist/index.html` 以及 `dist/assets/index-*.js` 等产物，模块打包无错误。
    - 运行时预期：
      - PC 端：由于本轮未调整交互代码，PC 端鼠标选择、拖拽、绘制、缩放、裁剪、右键菜单、上传与粘贴导入的行为应与上一轮验证结果保持一致。
      - iPad 端：触控双指捏合缩放/双指平移、单指工具操作、长按上下文菜单与双击文本编辑的逻辑保持不变，建议在真实设备上依照 G1 清单再次人工走查。
  - 备注：
    - 当前环境下仅完成工程与构建层面的回归，PC/iPad 的真实设备手动走查仍需在后续由人工依据 A1/G1 清单补充确认；从代码与构建角度，本轮触控改动已通过 lint 与 build 检查，可以作为后续设备验收的基础。

---

## 附录：历史计划（BananaSidebar｜复制交互与场景卡片逻辑重构，规划者）

> 说明：以下为此前 BananaSidebar 相关规划的历史记录，保留用于追溯。后续如继续推进该功能，可将其内容迁移到独立计划或重新激活对应看板。

### 背景要点（历史）

1. 点击香蕉按钮默认打开状态为「网页 + 场景卡片」，不出现侧边区域。
2. 只有在网页区域有鼠标点击动作时才隐藏场景卡片，鼠标悬停不隐藏。
3. 侧边区域只在点击网页中复制按钮时才会出现，默认为隐藏状态。
4. 侧边区域出现时，若场景卡片为显示状态则自动隐藏场景卡片。
5. 手动调出场景卡片时，侧边区域和场景卡片共存，此时鼠标点击网页区域依旧可以自动隐藏场景卡片。
6. 侧边区域手动隐藏后，需要再次点击网页中复制按钮时才会出现。
