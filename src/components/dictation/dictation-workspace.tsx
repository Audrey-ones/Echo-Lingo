"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { diffWords } from "diff";
import { Pencil, Hash, Sparkles } from "lucide-react";
import { useLessonStore } from "@/stores/lesson-store";
import { translateText } from "@/lib/translate";
import { EditableField } from "@/components/shared/editable-field";
import { cn } from "@/lib/utils";
import type { DictationRecord, LessonData } from "@/lib/types";

export function DictationWorkspace() {
  const currentSentence = useLessonStore((s) => s.currentSentence);
  const lesson = useLessonStore((s) => s.lesson);
  const setLesson = useLessonStore((s) => s.setLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const markCompleted = useLessonStore((s) => s.markCompleted);
  const unmarkCompleted = useLessonStore((s) => s.unmarkCompleted);
  const isSentenceCompleted = useLessonStore((s) => s.isSentenceCompleted);
  const dictationRecords = useLessonStore((s) => s.dictationRecords);
  const addDictationRecord = useLessonStore((s) => s.addDictationRecord);
  const setCurrentIndex = useLessonStore((s) => s.setCurrentIndex);

  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ value: string; added?: boolean; removed?: boolean }[] | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [editingText, setEditingText] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [pillsCanScrollLeft, setPillsCanScrollLeft] = useState(false);
  const [pillsCanScrollRight, setPillsCanScrollRight] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const currentPillRef = useRef<HTMLButtonElement>(null);

  const sentence = currentSentence();
  const sentenceKey = sentence?.id;
  const isCompleted = sentence ? isSentenceCompleted(sentence.id, "dictation") : false;
  const hasReference = !!sentence?.en;

  // Restore saved record when navigating to a sentence
  useEffect(() => {
    if (!sentence) return;
    const record = dictationRecords[sentence.id];
    if (record) {
      setInput(record.userInput);
      setResult(record.diff ?? null);
      setFlash(null);
    } else {
      setInput("");
      setResult(null);
      setFlash(null);
    }
    setEditingText(false);
  }, [sentenceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll pills row to keep current pill visible
  useEffect(() => {
    if (currentPillRef.current) {
      currentPillRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [sentenceKey]);

  // Detect pills row scroll overflow
  useEffect(() => {
    const el = pillsRef.current;
    if (!el) return;
    const check = () => {
      const canScroll = el.scrollWidth > el.clientWidth;
      if (!canScroll) {
        setPillsCanScrollLeft(false);
        setPillsCanScrollRight(false);
        return;
      }
      setPillsCanScrollLeft(el.scrollLeft > 1);
      setPillsCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [sentenceKey]);

  const handleSaveText = useCallback(() => {
    if (!lesson || !sentence || !editValue.trim()) return;
    const text = editValue.trim();
    const updated: LessonData = {
      ...lesson,
      sentences: lesson.sentences.map((s) =>
        s.id === sentence.id ? { ...s, en: text } : s
      ),
    };
    updateLesson(updated);
    setEditingText(false);

    if (!sentence.zh || !sentence.zh.trim()) {
      translateText(text).then((zh) => {
        if (!zh) return;
        const state = useLessonStore.getState();
        if (!state.lesson) return;
        if (state.currentSentence()?.id !== sentence.id) return;
        const updated2: LessonData = {
          ...state.lesson,
          sentences: state.lesson.sentences.map((s) =>
            s.id === sentence.id && (!s.zh || !s.zh.trim()) ? { ...s, zh } : s
          ),
        };
        useLessonStore.getState().updateLesson(updated2);
      });
    }
  }, [lesson, sentence, editValue, updateLesson]);

  const startEdit = useCallback(() => {
    setEditValue(sentence?.en ?? "");
    setEditingText(true);
  }, [sentence]);

  const handleSubmit = useCallback(() => {
    const s = useLessonStore.getState().currentSentence();
    if (!s || !input.trim()) return;

    if (!s.en) {
      const record: DictationRecord = { userInput: input.trim(), result: "no-reference" };
      useLessonStore.getState().addDictationRecord(s.id, record);
      markCompleted(s.id, "dictation");
      setTimeout(() => {
        const state = useLessonStore.getState();
        if (state.currentSentence()?.id !== s.id) return;
        if (!state.isLastSentence()) {
          state.nextSentence();
        }
      }, 400);
      return;
    }

    const clean = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const userClean = clean(input);
    const targetClean = clean(s.en);

    if (userClean === targetClean) {
      setFlash("correct");
      setResult(null);
      const record: DictationRecord = { userInput: input.trim(), result: "correct" };
      addDictationRecord(s.id, record);
      markCompleted(s.id, "dictation");
      setTimeout(() => {
        const state = useLessonStore.getState();
        if (state.currentSentence()?.id !== s.id) return;
        if (!state.isLastSentence()) {
          state.nextSentence();
        }
      }, 800);
    } else {
      setFlash("wrong");
      const diffs = diffWords(s.en, input.trim());
      const diffResult = diffs.map((d) => ({
        value: d.value,
        added: d.added,
        removed: d.removed,
      }));
      setResult(diffResult);
      const record: DictationRecord = { userInput: input.trim(), result: "wrong", diff: diffResult };
      addDictationRecord(s.id, record);
    }

    setTimeout(() => setFlash(null), 500);
  }, [input, addDictationRecord, markCompleted]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Build sentence pill data
  const sentencePills = useMemo(() =>
    (lesson?.sentences ?? []).map((s, i) => {
      const record = dictationRecords[s.id];
      const done = isSentenceCompleted(s.id, "dictation");
      const isCurrent = s.id === sentence?.id;
      return { id: s.id, index: i, record, done, isCurrent };
    })
  , [lesson, dictationRecords, sentence]);

  if (!sentence) return null;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-mono bg-zinc-900/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-zinc-800/40 shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <Hash className="w-3 h-3" />
          {sentence.id}
        </span>
        {isCompleted && (
          <button
            onClick={() => sentence && unmarkCompleted(sentence.id, "dictation")}
            className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-colors cursor-pointer shadow-[0_0_8px_rgba(34,197,94,0.06)]"
            title="点击撤销完成"
          >
            <Sparkles className="w-3 h-3 inline mr-1" />
            已完成
          </button>
        )}
        {!hasReference && !isCompleted && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            未设置原文
          </span>
        )}
      </div>

      {/* Sentence pills row */}
      {sentencePills.length > 1 && (
        <div className="relative w-full">
          <div
            ref={pillsRef}
            className="w-full overflow-x-auto pb-1 scrollbar-hide"
          >
            <div className="flex items-center gap-1.5 justify-center min-w-min">
              {sentencePills.map((pill) => (
                <button
                  key={pill.id}
                  ref={pill.isCurrent ? currentPillRef : null}
                  onClick={() => setCurrentIndex(pill.index)}
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-lg text-xs font-mono flex items-center justify-center transition-all",
                    pill.isCurrent
                      ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-[0_0_16px_-2px_rgba(99,102,241,0.18),inset_0_1px_0_rgba(255,255,255,0.03)]"
                      : pill.record?.result === "correct"
                      ? "bg-green-500/10 border border-green-500/25 text-green-400 hover:border-green-500/45"
                      : pill.record?.result === "wrong"
                      ? "bg-red-500/10 border border-red-500/25 text-red-400 hover:border-red-500/45"
                      : pill.done
                      ? "bg-zinc-800/40 border border-zinc-700/25 text-zinc-500 hover:border-zinc-600"
                      : "bg-zinc-900/30 border border-zinc-800/30 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                  )}
                >
                  {pill.index + 1}
                </button>
              ))}
            </div>
          </div>
          {pillsCanScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--color-zinc-950) 70%, transparent), transparent)" }} />
          )}
          {pillsCanScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10" style={{ background: "linear-gradient(to left, color-mix(in srgb, var(--color-zinc-950) 70%, transparent), transparent)" }} />
          )}
        </div>
      )}

      {/* Reference text */}
      {hasReference && !editingText && (
        <div className="relative group text-center px-2.5 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-base font-light font-mono text-zinc-200 leading-relaxed tracking-wide">
            {sentence.en}
          </p>
          <button
            onClick={startEdit}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800/90 border border-zinc-700/50 flex items-center justify-center opacity-60 hover:opacity-100 transition-all duration-200 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-700"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Edit reference text */}
      {editingText && (
        <EditableField
          value={editValue}
          onChange={setEditValue}
          onSave={handleSaveText}
          onCancel={() => setEditingText(false)}
          placeholder="输入这句话的英文原文..."
        />
      )}

      {/* No reference text prompt */}
      {!hasReference && !editingText && (
        <button
          onClick={startEdit}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-4 decoration-indigo-500/30"
        >
          设置本句英文原文（用于纠错对比）
        </button>
      )}

      {/* Dictation input */}
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你听到的内容..."
        disabled={isCompleted}
        className={cn(
          "w-full bg-transparent border-b-2 px-2 py-2 text-2xl font-mono font-light",
          "text-center placeholder:text-zinc-500",
          "resize-none outline-none transition-all duration-300",
          "min-h-[60px]",
          isCompleted
            ? "border-green-500/20 text-zinc-500"
            : "border-zinc-800 text-zinc-200 focus:border-indigo-500/70",
          flash === "correct" && "flash-correct",
          flash === "wrong" && "flash-wrong"
        )}
        rows={2}
      />

      {/* Diff result */}
      {result && (
        <div className="w-full max-w-lg bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/40 rounded-xl px-4 py-3 animate-slide-up shadow-[0_4px_24px_-4px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] mb-2 text-center font-medium">
            对比结果
          </div>
          <div className="flex flex-wrap justify-center gap-x-1 font-mono text-base leading-relaxed">
            {result.map((part, i) => {
              if (part.removed) {
                return (
                  <span key={i} className="text-red-400/80 line-through decoration-red-500/30">
                    {part.value}
                  </span>
                );
              }
              if (part.added) {
                return (
                  <span key={i} className="text-green-400/80 underline decoration-green-500/30">
                    {part.value}
                  </span>
                );
              }
              return (
                <span key={i} className="text-zinc-400">
                  {part.value}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint */}
      {!isCompleted && !editingText && (
        <p className="text-xs text-zinc-500">Enter 提交听写</p>
      )}
    </div>
  );
}
