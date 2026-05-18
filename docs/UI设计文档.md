# Echo-Lingo UI 设计文档

## 1. 设计系统

### 1.1 色彩体系

Echo-Lingo 使用 Tailwind CSS v4 的 `@theme` + `@custom-variant dark` 实现浅色/深色主题自动切换。所有组件使用语义化 Token（`bg-zinc-950` 等），无需在不同主题下修改 className。

#### 浅色模式 — Dusty Rose（默认，无 `.dark` class）

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-zinc-950` | `#fbf7f7` | 主背景色 |
| `--color-zinc-900` | `#f9f2f2` | 卡片/面板背景 |
| `--color-zinc-800` | `#f0e2e2` | 边框、分隔线 |
| `--color-zinc-700` | `#e4cdcd` | 交互边框、次要元素 |
| `--color-zinc-600` | `#b09090` | 次要文字 |
| `--color-zinc-500` | `#9e7b7b` | 辅助文字 |
| `--color-zinc-400` | `#8a6666` | 正文文字 |
| `--color-zinc-300` | `#5c4242` | 强调文字 |
| `--color-zinc-200` | `#3d2d2d` | 高亮文字 |
| `--color-zinc-100` | `#241a1a` | 最高亮文字 |

#### 深色模式（`.dark` class）

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-zinc-950` | `#050508` | 主背景色 |
| `--color-zinc-900` | `#0c0c12` | 卡片/面板背景 |
| `--color-zinc-800` | `#1a1a24` | 边框、分隔线 |
| `--color-zinc-700` | `#2e2e3a` | 交互边框、次要元素 |
| `--color-zinc-600` | `#52525e` | 次要文字 |
| `--color-zinc-500` | `#6b6b78` | 辅助文字 |
| `--color-zinc-400` | `#8e8e9a` | 正文文字 |
| `--color-zinc-300` | `#b0b0ba` | 强调文字 |
| `--color-zinc-200` | `#d4d4dc` | 高亮文字 |
| `--color-zinc-100` | `#eeeef2` | 最高亮文字 |

#### 功能色（浅色/深色通用）

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-indigo-600` | `#4f46e5` | 主色调深色 |
| `--color-indigo-500` | `#6366f1` | 主色调，可交互元素 |
| `--color-indigo-400` | `#818cf8` | 主色调亮色变体 |
| `--color-green-500` | `#22c55e` | 正确/完成状态 |
| `--color-red-500` | `#ef4444` | 错误/警告状态 |
| `--color-amber-500` | `#f59e0b` | 未设置原文警告 |

### 1.2 主题切换机制

- **存储**：`localStorage['echo-theme']` = `"dark"` | `"light"` | 不存在（跟随系统）
- **防闪烁**：`layout.tsx` 的 `<head>` 中有内联 `<script>`，在页面渲染前检查 localStorage 和 `prefers-color-scheme`，提前给 `<html>` 添加 `.dark` class
- **切换按钮**：TopBar 右侧 Sun/Moon 图标按钮，点击切换并写入 localStorage
- **系统监听**：无手动偏好时，监听 `prefers-color-scheme` 变化自动切换

### 1.3 字体系统

| Token | 字体栈 | 用途 |
|-------|--------|------|
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif` | UI 文本、按钮、标签 |
| `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` | 英文原文、听写输入、编号 |

### 1.4 圆角

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-sm` | `6px` | 小按钮、标签 |
| `--radius-md` | `10px` | 输入框、小卡片 |
| `--radius-lg` | `14px` | 卡片、面板 |
| `--radius-xl` | `18px` | 大卡片 |
| `--radius-2xl` | `24px` | 弹窗、大面板 |

### 1.5 视觉效果
- **毛玻璃**：`backdrop-blur-sm` / `backdrop-blur-md` / `backdrop-blur-2xl`
- **SVG 噪点纹理**：仅深色模式下生效（`.dark body::before`），`opacity: 0.018`，`z-index: 1`
- **阴影层次**：卡片 `shadow-[0_8px_32px_-8px_rgba(0,0,0,0.3)]`、按钮 `shadow-[0_4px_16px_-4px_rgba(99,102,241,0.08)]`
- **color-mix() 渐变**：pills 滚动指示器使用 `color-mix(in srgb, var(--color-zinc-950) 70%, transparent)` 实现主题安全的渐变遮罩

---

## 2. 布局架构

```
┌──────────────────────────────────────────┐
│  TopBar (h-14)                           │
│  [←返回] 课程标题  [███░░░] 3/15 [☀][听写|跟读] │
├──────────────────────────────────────────┤
│  Waveform (h-1/4)                        │
│  ┌ [1.0x] [循环]                         │
│  │ ~~~~~~~~~ wave ~~~~~~~~~             │
│  │ [▶ 点击开始播放] (首次遮罩)              │
│  │ [翻译浮层] (Tab 按住显示)              │
│  └───────────────────────────────────────┤
├──────────────────────────────────────────┤
│  Workspace (flex-1)                      │
│                                          │
│  ┌─ 听写模式 ─────────────────────────┐   │
│  │ #s_003  [✓ 已完成]                  │   │
│  │ ◄ [1][2][3][4][5]... ► (溢出渐变)  │   │
│  │ ┌ The quick brown fox ─────────┐    │   │
│  │ │        [✏️ hover显示]         │    │   │
│  │ └──────────────────────────────┘    │   │
│  │ [________________________]          │   │
│  │ ┌ 对比结果 ─────────────────────┐    │   │
│  │ │ The quick brown fox jumps     │    │   │
│  │ └──────────────────────────────┘    │   │
│  │ Enter 提交听写                       │   │
│  └────────────────────────────────────┘   │
│                                          │
│  ┌─ 跟读模式 ─────────────────────────┐   │
│  │ #s_003  [✓ 已跟读]                  │   │
│  │ ◄ [1][2][3][4][5]... ►            │   │
│  │ The quick brown fox                 │   │
│  │ 翻译：快速的棕色狐狸  [✏️]           │   │
│  │ [● 录制跟读]  [原音]                │   │
│  │ ┌ #2 ~~~wave~~~ [▶][🔊][🗑] ──┐    │   │
│  │ └ #1 ~~~wave~~~ [▶][🔊][🗑] ──┘    │   │
│  │ [🔊 标记已跟读 Enter]               │   │
│  └────────────────────────────────────┘   │
├──────────────────────────────────────────┤
│  Footer (h-10)                           │
│  Space播放 /循环 ↑↓切换 ⇧+←→1.0x Enter提交 │导出│
└──────────────────────────────────────────┘
```

### 2.1 布局约束
- 全屏应用 `h-screen w-screen overflow-hidden`，不出现页面级滚动条
- 波形区固定高度 `h-1/4`（25% 屏幕高度）
- 顶栏 56px，底栏 40px
- 中间工作区 `flex-1` 自适应
- 滚动容器（录音列表、pills 行）使用 `max-h-* overflow-y-auto scrollbar-hide`

---

## 3. 页面状态

### 3.1 初始状态（无课程）
- 中央显示 FileUploader 组件
- Logo + 标题 + 描述
- 分句灵敏度选择器（精细/标准/粗略）+ 精细模式滑块
- 主操作：上传文件 / 粘贴链接
- 次要操作：加载 JSON

### 3.2 分析中状态
- 上传按钮变为加载动画
- 分步提示：解析媒体 → 分析停顿 → 翻译中

### 3.3 课程就绪状态
- 显示完整布局（顶栏 + 波形 + 工作区 + 底栏）

### 3.4 首次播放前
- 波形区半透明遮罩 + 居中的"点击开始播放"按钮
- 点击或按 Space 后遮罩消失并播放

---

## 4. 组件设计规范

### 4.1 按钮层级
| 层级 | 样式 | 场景 |
|------|------|------|
| 主按钮 | `bg-indigo-500 text-white rounded-xl shadow` | 加载、确认 |
| 次按钮 | `bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200` | 录制、播放控制 |
| 文字按钮 | `text-zinc-500 hover:text-indigo-400 underline` | 编辑入口、添加翻译 |
| 危险按钮 | `bg-red-500/10 border-red-500/30 text-red-400` | 停止录制 |
| 图标按钮 | `w-7 h-7 rounded-md hover:bg-zinc-800/40` | 播放、删除、编辑、主题切换 |

### 4.2 药丸（Pill）状态
| 状态 | 边框 | 背景 | 文字色 |
|------|------|------|--------|
| 当前 | `border-indigo-500/40` | `bg-indigo-500/20` | `text-indigo-400` |
| 正确 | `border-green-500/20` | `bg-green-500/10` | `text-green-400` |
| 错误 | `border-red-500/20` | `bg-red-500/10` | `text-red-400` |
| 已完成 | `border-zinc-700/30` | `bg-zinc-800/50` | `text-zinc-500` |
| 待处理 | `border-zinc-800/30` | `bg-zinc-900/40` | `text-zinc-600` |

### 4.3 药丸行溢出处理
- 当 pills 总宽度超出容器时，行内横向滚动（`overflow-x-auto scrollbar-hide`）
- 左侧和/或右侧显示渐变遮罩指示器（`pointer-events-none`）
- 渐变使用 inline style + `color-mix()` 确保浅色/深色都正确显示

### 4.4 输入框状态
| 状态 | 边框 | 说明 |
|------|------|------|
| 默认 | `border-zinc-800` | 底部 2px 边框 |
| 聚焦 | `border-indigo-500/70` | 靛蓝色高亮 |
| 已完成 | `border-green-500/20` | 绿色禁用态 |

### 4.5 EditableField 共享组件
- 输入框 + 绿色确认按钮（✓）+ 灰色取消按钮（✗）
- Enter 保存、Esc 取消
- `autoFocus` 属性控制自动聚焦
- 两个模式统一使用，消除重复代码

---

## 5. 动画规范

| 动画名 | 时长 | 缓动 | 用途 |
|--------|------|------|------|
| `fade-in` | 300ms | `ease-out` | 页面/卡片入场 |
| `fade-in-scale` | 250ms | `ease-out` | 弹窗入场 |
| `slide-up` | 300ms | `ease-out` | 从底部滑入元素 |
| `flash-correct` | 600ms | `ease-in-out` | 听写正确闪烁（绿色） |
| `flash-wrong` | 600ms | `ease-in-out` | 听写错误闪烁（红色） |
| `pulse-glow` | 循环 | - | 靛蓝脉冲发光 |
| `shimmer` | 循环 | - | 骨架屏/加载闪光 |
| 按钮 hover | 200ms | - | `transition-all duration-200` |
| 卡片 hover | 300ms | - | `transition-all duration-300` |
| 进度条 | 700ms | `ease-out` | `transition-all duration-700` |

---

## 6. 响应式考虑
- 设计以桌面端（1280x800+）为目标
- 最小支持宽度约 800px
- 底栏快捷键在小屏幕可能溢出，为已知限制
- 波形高度固定 `h-1/4`，极端窄屏时比例偏大
- 未做移动端适配
