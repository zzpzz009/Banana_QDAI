# BananaPod-AC｜轻量图像生成与编辑工作台（PodUI 主题）

轻量、可扩展的图像生成与编辑工作台，采用 PodUI 视觉主题。在不改变既有布局与交互的前提下，统一三方 API 为 OpenAI 风格接口（基于 whatai.cc），支持图层合并、长宽比适配、iPad/Apple Pencil 手绘等场景。

## 功能特性
- PodUI 主题与通用样式类，视觉统一且可逐步替换
- 图像生成（`qwen-image`）与图像编辑（`gemini-2.5-flash-image`）分离
- 统一 OpenAI 风格 API 调用（基于 `whatai.cc`），代理通过 Vite 配置
- 图层面板一键“合并图层为图片”（选中或可见模式）
- 编辑输出宽高比与输入保持一致，超大图自动缩放 ≤ 2048×2048
- 多画板、图层系统、提示词复用、双语界面

## 快速开始
**环境要求**：Node.js 18+（建议 LTS）

1. 安装依赖：`npm install`
2. 配置环境：在 `.env.local` 写入 `WHATAI_API_KEY=<你的密钥>`，并确认 `PROXY_VIA_VITE=true`
3. 启动开发：`npm run dev` 后访问 `http://localhost:3000/`

## 配置说明
- 代理：`vite.config.ts` 已配置到 `whatai.cc`，无需在代码里强制 `Content-Type`
- 服务：`services/geminiService.ts` 统一了生成与编辑接口，自动处理比例与大图缩放
- 环境：`.gitignore` 已忽略 `.env*` 与敏感文件（如 `.trae/githubPAT`）

## 常用命令
- 开发：`npm run dev`
- 构建：`npm run build`
- 高级启动脚本：`start-bananapod-advanced.ps1` / `start-bananapod-advanced.cmd`

## 版本与发布
- v0.1.0：新增“合并图层为图片”，修复栅格边界计算
- v0.2.0：输入图自动缩放、编辑/生成分别调用 `/v1/images/edits` 与 `/v1/images/generations`
- v0.5.0：小版本发布流程与标签完善（本地已完成并可推送）

## 目录结构（简）
```
BananaPod-AC/
├── components/        # 主要 UI 组件（面板、工具栏、提示框等）
├── src/styles/podui.css  # PodUI 主题样式
├── services/geminiService.ts  # 统一 API 调用与图像处理逻辑
├── .trae/             # 工作过程记录与经验文档（scratchpad.md、experience.md）
├── vite.config.ts     # 代理与构建配置
└── README.md
```

## 安全与合规
- 请勿提交 `.env.local`、令牌等敏感信息；已在 `.gitignore` 保护
- 推送到 GitHub 时，建议启用 TLS 校验（参考 `https://aka.ms/gcm/tlsverify`）

## 致谢
- 模型：`qwen-image`、`gemini-2.5-flash-image`
- 平台与文档：`whatai.cc`（统一 OpenAI 风格 API）
