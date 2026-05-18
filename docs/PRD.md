# 🚀 Echo-Lingo 核心产品需求与架构文档 (PRD)

## 1. 项目概述与工程边界 (Project Overview & Boundaries)
**Echo-Lingo** 是一款专注于“精听听写 (Dictation)”与“影子跟读 (Shadowing)”的英语学习效率工具。
为了规避版权风险并降低部署成本，本项目采用严格的 **Local-first（本地优先）** 架构。

**【系统边界 - 绝对规则】：**
- ❌ **禁止**引入任何需要服务器部署的关系型/非关系型数据库（如 MySQL, MongoDB, Supabase）。
- ❌ **禁止**在代码库中内置任何《新概念英语》的原版音频或文本数据。
- ✅ **必须**通过浏览器的 `File System Access API` 或 `<input type="file">` 让用户上传本地资料。
- ✅ **必须**使用浏览器原生的 `IndexedDB`（可借助 `idb` 或 `dexie` 库）存储用户的学习记录、错题本和全局设置。

---

## 2. 核心数据字典 (Data Schema) - **极其重要**
所有的组件渲染、状态管理和进度保存，必须严格依赖以下数据结构。

### 2.1 课程源文件标准 (Lesson JSON)
用户导入的 `lesson.json` 必须符合以下 TypeScript 接口定义：
```typescript
interface LessonData {
  id: string;              // 课程唯一标识，如 "nce2_01"
  title: string;           // 课程标题
  source_audio: string;    // 关联的音频文件名，如 "nce2_01.mp3"
  metadata: {
    difficulty: string;    // 难度评级
    word_count: number;    // 总词数
  };
  sentences: Sentence[];   // 句子数组
}

interface Sentence {
  id: string;              // 句子唯一标识，如 "s_01"
  start_time: number;      // 句子在音频中的开始时间（秒，精确到三位小数）
  end_time: number;        // 句子在音频中的结束时间（秒，精确到三位小数）
  en: string;              // 英文原文（重点：包含标点符号和大小写）
  zh: string;              // 中文翻译
}
```

### 2.2 用户学习记录状态 (User Progress)

存入 IndexedDB 的数据结构：

TypeScript

```
interface LessonProgress {
  lesson_id: string;
  completed_sentences: string[]; // 已成功完成听写的句子 ID 数组
  last_accessed_at: number;      // 时间戳
}
```

------

## 3. 核心功能模块划分 (Core Features)

### 模块 A: 本地资源解析引擎 (Local Parser)

- **功能描述**: 用户在 Dashboard 页面上传 `.json` 文本和 `.mp3` 音频文件。
- **技术要求**:
  - 需校验 JSON 文件格式是否符合 `LessonData` 结构。
  - 解析成功后，将 JSON 数据存入全局状态（如 Zustand/Pinia），将 MP3 文件转化为 `Blob URL` 供播放器使用。

### 模块 B: 毫秒级精听播放器 (Audio Engine)

- **核心依赖**: `Wavesurfer.js` (负责波形渲染) +原生 `Web Audio API`。
- **核心能力**:
  - **精准切片**: 根据当前句子的 `start_time` 和 `end_time`，限制播放区间。
  - **无极变速**: 支持对音频进行 0.8x, 1.0x, 1.2x 变速播放，要求**变速不变调 (preservesPitch)**。

### 模块 C: 智能听写与 Diff 纠错引擎 (Dictation & Diff)

- **输入处理**: 提供无边框的文本输入框供用户听写。
- **比对算法 (Diff)**:
  - 用户按下 Enter 提交后，触发对比逻辑。
  - **预处理**: 对比前，将用户输入和原句 (Sentence.en) 进行清洗：转为全小写，剥离所有标点符号，去除多余空格。
  - **高亮渲染**: 利用 `diff` 算法库（如 `diff` npm package 的 `diffWords` 方法），找出多词、漏词、错拼，并在 UI 上用红色/绿色高亮差异点。

### 模块 D: 影子跟读器 (Shadowing) [Phase 2 规划]

- **功能**: 调用麦克风（`MediaRecorder API`）录制用户的朗读。
- **UI 呈现**: 在原音波形下方，实时生成用户的录音波形，并在录制结束后允许同时播放两条音轨以比对节奏。

------

## 4. 全局快捷键规范 (Keyboard Shortcuts)

应用在“沉浸式工作台”页面需挂载以下全局快捷键（需在输入框 Focus 且不在录音状态时合理规避冲突）：

- `Space (空格)`：播放 / 暂停当前音频。
- `/ (斜杠)`：开启 / 关闭当前句的“无限循环播放”模式。
- `ArrowDown (方向下)`：切换到下一句，并自动开始播放。
- `ArrowUp (方向上)`：切换到上一句，并自动开始播放。
- `Shift + ArrowLeft`：音频减速 0.1x。
- `Shift + ArrowRight`：音频加速 0.1x。
- `Tab`：按住时显示当前句子的中文翻译，松开隐藏。

------

## 5. 开发里程碑 (Milestones - 供 AI 规划上下文)

- **Phase 1 (骨架与引擎)**:
  - 搭建 Next.js + Tailwind + Shadcn 环境。
  - 建立 JSON 解析逻辑，跑通 Wavesurfer.js 波形渲染，实现基于时间的**单句播放和快捷键控制**。
- **Phase 2 (听写核心)**:
  - 实现输入框交互。
  - 引入 Diff 算法，完成听写后的红绿高亮纠错反馈。
  - 将进度打卡数据存入 IndexedDB。
- **Phase 3 (口语进阶)**:
  - 增加录音波形和麦克风调用逻辑。