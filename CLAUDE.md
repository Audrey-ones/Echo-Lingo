# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev      # 启动开发服务器 (localhost:3000)
npm run build    # 生产构建
npm run start    # 启动生产服务器
npm run lint     # ESLint 检查
npm run clean    # 删除 .next 构建缓存
npx tsc --noEmit # TypeScript 类型检查（无输出=通过）
```

构建缓存有时会导致 Turbopack 解析错误，用 `rm -rf .next` 清理后重启。

## Architecture

**Stack:** Next.js 16 (Turbopack) + React 19 + Tailwind CSS 4 + Zustand + Dexie.js (IndexedDB) + WaveSurfer.js 7

**Theme system** (`src/app/globals.css`):
- Tailwind v4 `@theme` + `@custom-variant dark (&:where(.dark, .dark *))` 双主题
- 浅色默认是 Dusty Rose 暖粉白调，深色 (.dark) 是暖深色
- `@layer theme { :root { @variant dark { ... } } }` 覆盖 CSS 变量
- `layout.tsx` 内有防闪烁脚本，读取 `localStorage['echo-theme']` 提前设 `.dark`
- 全局有 `transition: background-color 0.35s, border-color 0.35s, color 0.35s` 平滑切换

**State management** (`src/stores/lesson-store.ts`):
- `useLessonStore` — 单一 Zustand store，管理课程数据、当前句子索引、播放设置、完成进度
- `currentSentence()` / `isLastSentence()` / `isFirstSentence()` 是 getter 方法
- `markCompleted` / `unmarkCompleted` 异步写入 IndexedDB（通过 `src/lib/db.ts` Dexie 封装）
- `updateLesson` 只更新内存，不写 DB
- 跨组件通信：`page.tsx` 暴露 `__echoPlayCurrentSentence`、`__echoWavesurfer` 等到 `window` 全局，供 keyboard hook 和 shadowing workspace 调用 — 这是脆弱点，修改时注意不要破坏

**Audio pipeline** (`src/lib/audio-analyzer.ts`):
- `extractAudioBuffer(source)` — File 或 URL → AudioBuffer + blobUrl（视频用 MediaRecorder 提取音频）
- `analyzeAudio()` — 逐样本静音检测切句
- `analyzeAudioFine()` — 窗口 RMS 算法（带背景音乐时更准）
- 两个分析函数都会跳过前导静音
- 句子 ID 格式 `s_001, s_002...`

**WaveSurfer** (`src/app/page.tsx`):
- 初始化在 `useEffect([audioBlobUrl, isReady])`，`lastLoadedUrlRef` 防重复加载
- Regions 插件用于句子边界标记，点击 region 切换句子
- `timeupdate` 事件持续播放时自动同步 currentIndex
- `finish` 事件配合 `loopRef` 实现单句循环
- 录音波形在 `shadowing-workspace.tsx` 内独立创建 WaveSurfer 实例

**Translation** (`src/lib/translate.ts`):
- 免费 API，无需密钥：MyMemory（主）→ Google Translate（备用）
- `translateText` 单句，`translateSentences` 批量（并发 3 个，批次间 200ms 延迟）
- 失败返回 `""` 并 `console.warn`

## Key conventions

- 所有 UI 文案硬编码中文，无 i18n
- `bg-zinc-*` / `text-zinc-*` 全部引用 CSS 变量，自动适配明暗主题
- 编辑按钮用 `opacity-60 hover:opacity-100`（非 hover-only，触屏可达）
- 错误提示用内联红色条，不用 `alert()`
- 每个句子 pill 用 `useMemo` 计算，避免大课程重渲染
- `setCurrentIndex` 含边界检查，不在范围内的 index 静默忽略
