"use client";

import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useLessonStore } from "@/stores/lesson-store";
import { useState, useEffect } from "react";

interface TopBarProps {
  mode: "dictation" | "shadowing";
  onModeChange: (mode: "dictation" | "shadowing") => void;
  onBack: () => void;
  completed: number;
  total: number;
}

export function TopBar({ mode, onModeChange, onBack, completed, total }: TopBarProps) {
  const lesson = useLessonStore((s) => s.lesson);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.classList.contains("dark"));

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (!localStorage.getItem("echo-theme")) {
        const systemDark = mq.matches;
        el.classList.toggle("dark", systemDark);
        setIsDark(systemDark);
      }
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = !el.classList.contains("dark");
    el.classList.toggle("dark", next);
    localStorage.setItem("echo-theme", next ? "dark" : "light");
    setIsDark(next);
  };

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-zinc-800/20 shrink-0 bg-zinc-950/70 backdrop-blur-2xl">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          aria-label="返回上传页面"
          className="p-1.5 rounded-lg hover:bg-zinc-800/40 transition-colors duration-200 text-zinc-400 hover:text-zinc-200 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-zinc-300 truncate max-w-[180px] font-medium tracking-tight">
          {lesson?.title ?? ""}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Progress */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-28 h-1.5 bg-zinc-800/40 rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`进度 ${completed}/${total}`}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: pct > 0
                  ? "linear-gradient(90deg, #6366f1, #818cf8, #6366f1)"
                  : "transparent",
                backgroundSize: pct > 0 ? "200% 100%" : undefined,
                animation: pct > 0 ? "progress-shimmer 2.5s linear infinite" : undefined,
                boxShadow: pct > 0 ? "0 0 10px rgba(99,102,241,0.35), 0 0 2px rgba(99,102,241,0.5)" : undefined,
              }}
            />
          </div>
          <span className="text-[11px] text-zinc-500 tabular-nums min-w-[3rem] tracking-tight font-mono">
            {completed}/{total}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-zinc-800/40 transition-colors duration-200 text-zinc-400 hover:text-zinc-200"
          aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Mode toggle */}
        <div className="flex items-center bg-zinc-800/30 rounded-xl p-0.5 gap-0.5 ring-1 ring-zinc-700/20" role="tablist" aria-label="练习模式">
          <button
            onClick={() => onModeChange("dictation")}
            role="tab"
            aria-selected={mode === "dictation"}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all duration-300 font-medium tracking-tight ${
              mode === "dictation"
                ? "bg-zinc-700/70 text-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.03)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            听写
          </button>
          <button
            onClick={() => onModeChange("shadowing")}
            role="tab"
            aria-selected={mode === "shadowing"}
            className={`px-3.5 py-1.5 text-xs rounded-lg transition-all duration-300 font-medium tracking-tight ${
              mode === "shadowing"
                ? "bg-zinc-700/70 text-zinc-100 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.25)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            跟读
          </button>
        </div>
      </div>
    </header>
  );
}
