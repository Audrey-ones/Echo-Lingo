"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import WaveSurfer from "wavesurfer.js";
import { Pencil, Volume2, Mic, Square, Play, Hash, Sparkles, Trash2 } from "lucide-react";
import { useLessonStore } from "@/stores/lesson-store";
import { EditableField } from "@/components/shared/editable-field";
import { cn } from "@/lib/utils";
import type { LessonData } from "@/lib/types";

interface Recording {
  id: string;
  blob: Blob;
  blobUrl: string;
  createdAt: number;
}

export function ShadowingWorkspace() {
  const currentSentence = useLessonStore((s) => s.currentSentence);
  const lesson = useLessonStore((s) => s.lesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const markCompleted = useLessonStore((s) => s.markCompleted);
  const isSentenceCompleted = useLessonStore((s) => s.isSentenceCompleted);
  const completedInShadowing = useLessonStore((s) => s.completedInShadowing);
  const setCurrentIndex = useLessonStore((s) => s.setCurrentIndex);
  const unmarkCompleted = useLessonStore((s) => s.unmarkCompleted);

  const [editingText, setEditingText] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editingZh, setEditingZh] = useState(false);
  const [editZhValue, setEditZhValue] = useState("");
  const [pillsCanScrollLeft, setPillsCanScrollLeft] = useState(false);
  const [pillsCanScrollRight, setPillsCanScrollRight] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingBoth, setIsPlayingBoth] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [recordingsVersion, setRecordingsVersion] = useState(0);
  const [isDark, setIsDark] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const recordingsMapRef = useRef<Map<string, Recording[]>>(new Map());
  const waveSurfersRef = useRef<Map<string, WaveSurfer>>(new Map());
  const waveformElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isStartingRef = useRef(false);
  const pillsRef = useRef<HTMLDivElement>(null);
  const currentPillRef = useRef<HTMLButtonElement>(null);

  const sentence = currentSentence();
  const isCompleted = sentence ? isSentenceCompleted(sentence.id, "shadowing") : false;
  const hasReference = !!sentence?.en;
  const currentRecordings = sentence
    ? (recordingsMapRef.current.get(sentence.id) ?? [])
    : [];

  useEffect(() => {
    setEditingText(false);
    setEditingZh(false);
    setMicError(null);
  }, [sentence?.id]);

  // Sync theme state with DOM
  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() => {
      setIsDark(el.classList.contains("dark"));
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Stop active recording on sentence change, but keep saved recordings
  useEffect(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setPlayingRecordingId(null);
    setIsPlayingBoth(false);
  }, [sentence?.id]);

  // Auto-scroll pills row to keep current pill visible
  useEffect(() => {
    if (currentPillRef.current) {
      currentPillRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [sentence?.id]);

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
  }, [sentence?.id]);

  // Sync WaveSurfer instances with current recordings
  useEffect(() => {
    const wsMap = waveSurfersRef.current;
    const elMap = waveformElsRef.current;
    const currentIds = new Set(currentRecordings.map((r) => r.id));

    // Destroy WaveSurfers for removed recordings
    for (const [id, ws] of wsMap) {
      if (!currentIds.has(id)) {
        ws.destroy();
        wsMap.delete(id);
      }
    }

    // Create WaveSurfer for new recordings
    for (const rec of currentRecordings) {
      if (wsMap.has(rec.id)) continue;
      const el = elMap.get(rec.id);
      if (!el) continue;

      const waveColor = getComputedStyle(document.documentElement).getPropertyValue("--color-waveform-recording").trim() || "#52525b";

      const ws = WaveSurfer.create({
        container: el,
        waveColor,
        progressColor: "#22c55e",
        cursorColor: "#22c55e",
        cursorWidth: 2,
        height: 36,
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        normalize: true,
        backend: "WebAudio",
      });

      ws.on("play", () => setPlayingRecordingId(rec.id));
      ws.on("pause", () => setPlayingRecordingId(null));
      ws.on("finish", () => {
        setPlayingRecordingId(null);
        setIsPlayingBoth(false);
      });

      wsMap.set(rec.id, ws);
      ws.load(rec.blobUrl);
    }
  }, [currentRecordings]);

  // Sync recording waveform colors to theme
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--color-waveform-recording").trim();
    if (!color) return;
    for (const ws of waveSurfersRef.current.values()) {
      ws.setOptions({ waveColor: color });
    }
  }, [isDark]);

  // Cleanup WaveSurfers on unmount (preserve recordings across mode switches)
  useEffect(() => {
    return () => {
      for (const ws of waveSurfersRef.current.values()) {
        ws.destroy();
      }
      waveSurfersRef.current.clear();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      const capturedSentenceId = sentence?.id ?? null;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const recordingSid = capturedSentenceId;
        if (!recordingSid) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const blobUrl = URL.createObjectURL(blob);
        const recording: Recording = {
          id: crypto.randomUUID(),
          blob,
          blobUrl,
          createdAt: Date.now(),
        };

        const map = recordingsMapRef.current;
        const existing = map.get(recordingSid) ?? [];
        const MAX_PER_SENTENCE = 5;
        const trimmed = [recording, ...existing].slice(0, MAX_PER_SENTENCE);
        for (const removed of existing.slice(MAX_PER_SENTENCE - 1)) {
          URL.revokeObjectURL(removed.blobUrl);
        }
        map.set(recordingSid, trimmed);
        setRecordingsVersion((v) => v + 1);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("无法访问麦克风:", err);
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setMicError("麦克风权限被拒绝，请在浏览器设置中允许访问麦克风后重试");
      } else if (e.name === "NotFoundError") {
        setMicError("未检测到麦克风设备，请确认麦克风已连接");
      } else {
        setMicError("无法访问麦克风，请检查设备连接或浏览器权限设置");
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [sentence?.id]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const playOriginal = useCallback(() => {
    (window as any).__echoPlayCurrentSentence?.();
  }, []);

  const playRecording = useCallback((recordingId: string) => {
    waveSurfersRef.current.get(recordingId)?.play();
  }, []);

  const playBoth = useCallback((recordingId: string) => {
    const original = (window as any).__echoWavesurfer as WaveSurfer | undefined;
    const recording = waveSurfersRef.current.get(recordingId);
    if (!original || !recording) return;

    const state = useLessonStore.getState();
    const s = state.currentSentence();
    if (!s) return;

    try {
      original.pause();
      original.setTime(s.start_time);
      original.play(s.start_time, s.end_time);
    } catch { /* WaveSurfer may be in an invalid state */ }

    try {
      recording.stop();
      recording.play(0);
    } catch { /* recording WaveSurfer may be in an invalid state */ }

    setIsPlayingBoth(true);
  }, []);

  const deleteRecording = useCallback((recordingId: string) => {
    const ws = waveSurfersRef.current.get(recordingId);
    if (ws) {
      ws.destroy();
      waveSurfersRef.current.delete(recordingId);
    }
    waveformElsRef.current.delete(recordingId);

    if (!sentence) return;
    const map = recordingsMapRef.current;
    const list = map.get(sentence.id);
    if (!list) return;
    const item = list.find((r) => r.id === recordingId);
    if (item) URL.revokeObjectURL(item.blobUrl);
    map.set(sentence.id, list.filter((r) => r.id !== recordingId));
    if ((map.get(sentence.id)?.length ?? 0) === 0) map.delete(sentence.id);
    setPlayingRecordingId(null);
    setIsPlayingBoth(false);
    setRecordingsVersion((v) => v + 1);
  }, [sentence]);

  useEffect(() => {
    if (!isPlayingBoth) return;
    const original = (window as any).__echoWavesurfer as WaveSurfer | undefined;
    if (!original) return;

    const onStop = () => setIsPlayingBoth(false);
    original.on("pause", onStop);
    original.on("finish", onStop);

    const recordingWs = playingRecordingId
      ? waveSurfersRef.current.get(playingRecordingId)
      : undefined;
    if (recordingWs) {
      recordingWs.on("finish", onStop);
      recordingWs.on("pause", onStop);
    }

    return () => {
      original.un("pause", onStop);
      original.un("finish", onStop);
      if (recordingWs) {
        recordingWs.un("finish", onStop);
        recordingWs.un("pause", onStop);
      }
    };
  }, [isPlayingBoth, playingRecordingId]);

  const handleMarkCompleted = useCallback(() => {
    if (!sentence) return;
    markCompleted(sentence.id, "shadowing");
    const state = useLessonStore.getState();
    if (!state.isLastSentence()) {
      setTimeout(() => state.nextSentence(), 200);
    }
  }, [sentence, markCompleted]);

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
    useLessonStore.getState().saveLessonToDB().catch(console.error);
    setEditingText(false);
  }, [lesson, sentence, editValue, updateLesson]);

  const handleSaveZh = useCallback(() => {
    if (!lesson || !sentence) return;
    const updated: LessonData = {
      ...lesson,
      sentences: lesson.sentences.map((s) =>
        s.id === sentence.id ? { ...s, zh: editZhValue.trim() } : s
      ),
    };
    updateLesson(updated);
    useLessonStore.getState().saveLessonToDB().catch(console.error);
    setEditingZh(false);
  }, [lesson, sentence, editZhValue, updateLesson]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInputFocused) return;
      e.preventDefault();
      handleMarkCompleted();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMarkCompleted]);

  if (!sentence) return null;

  // Build sentence pill data
  const sentencePills = useMemo(() =>
    (lesson?.sentences ?? []).map((s, i) => ({
      id: s.id,
      index: i,
      done: isSentenceCompleted(s.id, "shadowing"),
      isCurrent: s.id === sentence.id,
    }))
  , [lesson, sentence]);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1 text-xs text-zinc-400 font-mono bg-zinc-900/50 backdrop-blur-sm px-2.5 py-1 rounded-full border border-zinc-800/40 shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <Hash className="w-3 h-3" />
          {(() => {
            const idx = lesson?.sentences.findIndex((s) => s.id === sentence.id) ?? -1;
            const total = lesson?.sentences.length ?? 0;
            return idx >= 0 ? `第 ${idx + 1}/${total} 句` : sentence.id;
          })()}
        </span>
        {isCompleted && (
          <button
            onClick={() => sentence && unmarkCompleted(sentence.id, "shadowing")}
            className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-colors cursor-pointer shadow-[0_0_8px_rgba(34,197,94,0.06)]"
            title="点击撤销完成"
          >
            <Sparkles className="w-3 h-3 inline mr-1" />
            已跟读
          </button>
        )}
      </div>

      {/* Sentence pills row */}
      {sentencePills.length > 1 && (
        <div className="relative w-full">
          <div
            ref={pillsRef}
            className="w-full overflow-x-auto pb-1 scrollbar-hide"
          >
            <div className="flex items-center gap-1.5 justify-center min-w-min animate-fade-in">
              {sentencePills.map((pill) => (
                <button
                  key={pill.id}
                  ref={pill.isCurrent ? currentPillRef : null}
                  onClick={() => setCurrentIndex(pill.index)}
                  className={cn(
                    "shrink-0 w-8 h-8 rounded-lg text-xs font-mono flex items-center justify-center transition-all",
                    pill.isCurrent
                      ? "bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 shadow-[0_0_12px_-2px_rgba(99,102,241,0.12)]"
                      : pill.done
                      ? "bg-green-500/10 border border-green-500/20 text-green-400 hover:border-green-500/40"
                      : "bg-zinc-900/30 border border-zinc-800/20 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
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

      {/* English text */}
      {hasReference && !editingText && (
        <div className="relative group text-center px-2.5 py-1 rounded-md bg-zinc-900/30 backdrop-blur-sm border border-zinc-800/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-base font-light font-mono text-zinc-200 leading-relaxed tracking-wide">
            {sentence.en}
          </p>
          <button
            onClick={() => {
              setEditValue(sentence.en);
              setEditingText(true);
            }}
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

      {/* Chinese translation */}
      {hasReference && !editingText && !editingZh && (
        <div className="relative group">
          {sentence.zh ? (
            <p className="text-sm text-zinc-500 text-center max-w-md leading-relaxed">
              {sentence.zh}
            </p>
          ) : (
            <button
              onClick={() => {
                setEditZhValue("");
                setEditingZh(true);
              }}
              className="text-xs text-zinc-600 hover:text-indigo-400 transition-colors underline underline-offset-4"
            >
              添加中文翻译
            </button>
          )}
          {sentence.zh && (
            <button
              onClick={() => {
                setEditZhValue(sentence.zh);
                setEditingZh(true);
              }}
              className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-all text-zinc-500 hover:text-zinc-300"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Edit translation */}
      {editingZh && (
        <EditableField
          value={editZhValue}
          onChange={setEditZhValue}
          onSave={handleSaveZh}
          onCancel={() => setEditingZh(false)}
          placeholder="输入中文翻译..."
        />
      )}

      {/* Recording section */}
      {!editingText && (
        <div className="w-full max-w-md space-y-2.5">
          {/* Mic error */}
          {micError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center">
              {micError}
            </div>
          )}

          {/* Record button row */}
          <div className="flex items-center justify-center gap-1.5">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isPlayingBoth}
                title={isPlayingBoth ? "正在播放合成音，请等待播放结束" : undefined}
                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/60 border border-zinc-800/40 hover:border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-all duration-300 text-sm disabled:opacity-30 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)]"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.3)]" />
                </span>
                <Mic className="w-3.5 h-3.5" />
                {currentRecordings.length > 0 ? "新录音" : "录制跟读"}
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-sm animate-pulse"
              >
                <Square className="w-3 h-3 fill-red-400" />
                停止录制
              </button>
            )}

            {currentRecordings.length > 0 && !isRecording && (
              <button
                onClick={playOriginal}
                className="px-3 py-2 rounded-full text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all duration-300 border border-zinc-800/30 bg-zinc-900/40"
              >
                原音
              </button>
            )}
          </div>

          {/* Recordings list */}
          {currentRecordings.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-hide">
              {currentRecordings.map((rec, i) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 backdrop-blur-sm overflow-hidden px-2 py-1 hover:border-zinc-700/50 transition-all duration-300 shadow-[0_2px_8px_rgba(0,0,0,0.08)] animate-fade-in"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-8 text-right tabular-nums">
                      #{currentRecordings.length - i}
                    </span>
                    <div
                      ref={(el) => {
                        if (el) waveformElsRef.current.set(rec.id, el);
                        else waveformElsRef.current.delete(rec.id);
                      }}
                      className="flex-1 h-[36px]"
                    />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => playRecording(rec.id)}
                        disabled={playingRecordingId === rec.id || isPlayingBoth}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-green-500/70 hover:text-green-400 hover:bg-green-500/10 transition-all disabled:opacity-30"
                      >
                        <Play className="w-3 h-3 fill-green-500/40 ml-0.5" />
                      </button>
                      <button
                        onClick={() => playBoth(rec.id)}
                        disabled={isPlayingBoth}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-indigo-400/70 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all disabled:opacity-30"
                      >
                        <Volume2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => deleteRecording(rec.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mark completed button */}
      {!isCompleted && !editingText && (
        <button
          onClick={handleMarkCompleted}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/35 transition-all duration-300 text-sm font-medium shadow-[0_4px_20px_-4px_rgba(99,102,241,0.08),inset_0_1px_0_rgba(255,255,255,0.02)] hover:shadow-[0_4px_24px_-4px_rgba(99,102,241,0.15)] active:scale-[0.97]"
        >
          <Volume2 className="w-4 h-4" />
          标记已跟读
          <span className="text-xs text-indigo-500/40 ml-1 font-normal">Enter</span>
        </button>
      )}

      {isCompleted && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/25 text-green-400 animate-fade-in-scale">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">跟读完成</span>
        </div>
      )}

    </div>
  );
}
