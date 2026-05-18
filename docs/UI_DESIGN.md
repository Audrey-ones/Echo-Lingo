# Echo-Lingo 沉浸式工作台 UI 设计与交互规范

## 1. 全局设计系统 (Design System)
- **UI 框架**: React (Next.js App Router) 或 Vue (Nuxt 3)
- **CSS 引擎**: Tailwind CSS
- **组件库**: Shadcn UI (严格使用暗色模式为默认视角)
- **配色规范**:
  - 背景色: 暗色模式背景设定为 `bg-zinc-950`
  - 文本色: 主文本 `text-zinc-200`，次要文本 `text-zinc-400`
  - 主题色 (Accent): 靛蓝色 `indigo-500` (用于焦点状态和进度条)
  - 状态色: 成功 (Green-500)，错误 (Red-500)
- **排版 (Typography)**:
  - 听写输入框必须使用等宽字体: `font-mono`
  - 全局布局: `h-screen w-screen flex flex-col overflow-hidden`，禁止出现全局滚动条。

## 2. 依赖的 Shadcn 组件清单
请按需使用或生成以下组件：
- `Button` (Ghost 变体用于图标按钮)
- `Progress` (用于顶部进度条)
- `Input` / `Textarea` (用于无边框听写输入)
- `Toast` (用于全局快捷键提醒或保存成功提示)
- `Switch` (用于模式切换)

## 3. 页面结构定义 (DOM 树与布局)
请按照以下层级结构构建工作台界面：
1. **TopBar (顶部状态栏)**: `h-16 flex items-center justify-between px-6 border-b border-zinc-800`
   - 左侧: 返回按钮 (lucide-react icon) + 当前课程标题 (text-sm text-zinc-400)
   - 中间: 进度条容器 (w-64) + 进度文字 (e.g., 5/24)
   - 右侧: 听写/跟读模式 Toggle 切换器
2. **VisualizerArea (音频可视化区)**: `h-1/4 w-full border-b border-zinc-800`
   - 居中放置 Wavesurfer.js 生成的波形容器
   - 左上角显示当前语速 (e.g., 1.0x)
3. **WorkspaceArea (核心交互区)**: `flex-1 flex flex-col items-center justify-center`
   - 居中显示当前句序号 (`# 05`, text-zinc-500)
   - 核心输入框容器: 宽度限制 `max-w-2xl w-full`
   - 动态内容: 听写输入框 (字号 text-3xl) 或 阴影跟读大字号文本
4. **Footer (快捷键提示底栏)**: `h-12 absolute bottom-0 w-full flex items-center justify-center gap-6 text-xs text-zinc-500 bg-zinc-950/80 backdrop-blur`

## 4. 关键交互动作 (Micro-interactions)
- **按键反馈**: 用户每次按下回车提交听写，如果完全正确，输入框边框短暂闪烁绿色；如果错误，闪烁红色并展示 Diff 结果。
- **平滑过渡**: 切换句子时，旧句子淡出 (opacity-0)，新句子从下方 10px 处上浮并淡入。