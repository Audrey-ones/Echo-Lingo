"use client";

import { Download } from "lucide-react";
import { useLessonStore } from "@/stores/lesson-store";
import { downloadJson } from "@/lib/audio-analyzer";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center h-[18px] min-w-[18px] px-1 text-[10px] rounded-[4px] bg-zinc-800/60 text-zinc-400 font-mono ring-1 ring-zinc-700/40 shadow-[0_1px_1px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)]">
      {children}
    </kbd>
  );
}

interface FooterBarProps {
  mode: "dictation" | "shadowing";
}

export function FooterBar({ mode }: FooterBarProps) {
  const playbackRate = useLessonStore((s) => s.playbackRate);
  const isLooping = useLessonStore((s) => s.isLooping);
  const lesson = useLessonStore((s) => s.lesson);

  const handleDownload = () => {
    if (!lesson) return;
    const name = lesson.title || "lesson";
    downloadJson(lesson, `${name}.json`);
  };

  return (
    <footer className="h-10 w-full flex items-center justify-center gap-5 text-[11px] text-zinc-500 bg-zinc-950/60 backdrop-blur-2xl border-t border-zinc-800/15 shrink-0">
      <span className="flex items-center gap-1.5">
        <Kbd>Space</Kbd> 播放
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>/</Kbd> 循环{" "}
        <span className={isLooping ? "text-indigo-400 font-medium" : ""}>
          {isLooping ? "ON" : "OFF"}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>↑</Kbd><Kbd>↓</Kbd> 切换
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>⇧</Kbd>+<Kbd>←</Kbd><Kbd>→</Kbd> {playbackRate}x
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Tab</Kbd> 翻译
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Enter</Kbd> {mode === "dictation" ? "提交" : "标记完成"}
      </span>
      <span className="text-zinc-700/30 mx-0.5 w-px h-3 bg-zinc-700/20" />
      <button
        onClick={handleDownload}
        disabled={!lesson}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-zinc-500"
      >
        <Download className="w-3 h-3" />
        导出
      </button>
    </footer>
  );
}
