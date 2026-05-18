"use client";

import { BookOpen, Trash2, Clock } from "lucide-react";
import type { CourseSummary } from "@/stores/lesson-store";

interface CourseListProps {
  courses: CourseSummary[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CourseList({ courses, onSelect, onDelete }: CourseListProps) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md animate-fade-in">
      <div className="text-center">
        <h2 className="text-xl font-medium text-zinc-200 mb-1.5">我的课程</h2>
        <p className="text-sm text-zinc-500">共 {courses.length} 门课程，点击继续学习</p>
      </div>

      <div className="w-full space-y-2">
        {courses.map((course) => {
          const totalDone = course.completedDictation + course.completedShadowing;
          const pct = course.sentenceCount > 0
            ? Math.min(100, Math.round((totalDone / (course.sentenceCount * 2)) * 100))
            : 0;

          return (
            <div
              key={course.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(course.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onSelect(course.id); }}
              className="w-full text-left p-4 rounded-xl bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/40 hover:border-indigo-500/30 hover:bg-zinc-900/60 transition-all duration-200 group shadow-[0_2px_12px_rgba(0,0,0,0.08)] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {course.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>{course.sentenceCount} 句</span>
                    <span>听写 {course.completedDictation}/{course.sentenceCount}</span>
                    <span>跟读 {course.completedShadowing}/{course.sentenceCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono text-indigo-400">{pct}%</div>
                    {course.lastAccessedAt > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-600 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDate(course.lastAccessedAt)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(course.id);
                    }}
                    className="shrink-0 w-7 h-7 rounded-lg bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-zinc-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
                    title="删除课程"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Mini progress bar */}
              <div className="mt-2 h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 0) return `${d.getMonth() + 1}/${d.getDate()}`;
  if (diff < 86400000) return "今天";
  if (diff < 172800000) return "昨天";
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
