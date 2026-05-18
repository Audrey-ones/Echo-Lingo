"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import { Play, Pencil, Check, X } from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { FooterBar } from "@/components/layout/footer-bar";
import { FileUploader } from "@/components/layout/file-uploader";
import { CourseList } from "@/components/layout/course-list";
import { DictationWorkspace } from "@/components/dictation/dictation-workspace";
import { ShadowingWorkspace } from "@/components/shadowing/shadowing-workspace";
import { useLessonStore, type CourseSummary } from "@/stores/lesson-store";
import { db } from "@/lib/db";
import { useKeyboard } from "@/hooks/use-keyboard";

export default function Home() {
  const [mode, setMode] = useState<"dictation" | "shadowing">("dictation");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const lesson = useLessonStore((s) => s.lesson);
  const audioBlobUrl = useLessonStore((s) => s.audioBlobUrl);
  const playbackRate = useLessonStore((s) => s.playbackRate);
  const showTranslation = useLessonStore((s) => s.showTranslation);
  const currentSentence = useLessonStore((s) => s.currentSentence);
  const currentIndex = useLessonStore((s) => s.currentIndex);
  const isLooping = useLessonStore((s) => s.isLooping);
  const loopCount = useLessonStore((s) => s.loopCount);
  const completedInDictation = useLessonStore((s) => s.completedInDictation);
  const completedInShadowing = useLessonStore((s) => s.completedInShadowing);
  const completedSentences = mode === "dictation" ? completedInDictation : completedInShadowing;

  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const [editingTranslation, setEditingTranslation] = useState(false);
  const [editZhValue, setEditZhValue] = useState("");
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const hasInteractedRef = useRef(false);
  const timeupdateSyncRef = useRef(false);
  const wsReadyRef = useRef(false);
  const lastLoadedUrlRef = useRef<string | null>(null);

  const isReady = !!(lesson && audioBlobUrl);

  // Load saved courses on mount
  useEffect(() => {
    let cancelled = false;
    useLessonStore.getState().getAllCourses().then((list) => {
      if (!cancelled) {
        setCourses(list);
        setCoursesLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

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

  // Save translation for current sentence
  const handleSaveTranslation = useCallback(() => {
    const s = currentSentence();
    const currentLesson = useLessonStore.getState().lesson;
    if (!currentLesson || !s) return;
    const updated = {
      ...currentLesson,
      sentences: currentLesson.sentences.map((sen) =>
        sen.id === s.id ? { ...sen, zh: editZhValue.trim() } : sen
      ),
    };
    useLessonStore.getState().updateLesson(updated);
    setEditingTranslation(false);
  }, [editZhValue, currentSentence]);

  // Loop mode ref (always current, no effect dependency needed)
  const loopRef = useRef(isLooping);
  loopRef.current = isLooping;
  const loopCountRef = useRef(loopCount);
  loopCountRef.current = loopCount;
  const loopIterationRef = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioBlobUrl) return;
    if (lastLoadedUrlRef.current === audioBlobUrl) return;
    lastLoadedUrlRef.current = audioBlobUrl;

    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

    const waveColor = getComputedStyle(document.documentElement).getPropertyValue("--color-waveform").trim() || "#3f3f46";

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor,
      progressColor: "#6366f1",
      cursorColor: "#6366f1",
      cursorWidth: 2,
      height: 100,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      normalize: true,
      backend: "WebAudio",
    });

    let destroyed = false;

    // Register regions plugin for sentence boundaries
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

    regions.on("region-clicked", (region, e) => {
      e.stopPropagation();
      const state = useLessonStore.getState();
      const idx = state.lesson?.sentences.findIndex(
        (s) => s.id === region.id
      );
      if (idx !== undefined && idx >= 0) {
        timeupdateSyncRef.current = false;
        state.setCurrentIndex(idx);
      }
    });

    ws.on("ready", () => {
      if (destroyed) return;
      wsReadyRef.current = true;
      setHasInteracted(false);
      hasInteractedRef.current = false;

      // Add sentence boundary regions
      const lessonData = useLessonStore.getState().lesson;
      if (!lessonData) return;
      const sentences = lessonData.sentences;
      const isCompleted = (id: string) =>
        useLessonStore.getState().isSentenceCompleted(id, modeRef.current);

      // Clear old regions
      regions.clearRegions();

      sentences.forEach((s, i) => {
        const done = isCompleted(s.id);
        regions.addRegion({
          id: s.id,
          start: s.start_time,
          end: s.end_time,
          color: done
            ? "rgba(34, 197, 94, 0.08)"
            : i % 2 === 0
            ? "rgba(99, 102, 241, 0.04)"
            : "rgba(99, 102, 241, 0.02)",
          drag: false,
          resize: false,
        });
      });
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => {
      setIsPlaying(false);
      // When looping, bounded play() fires pause (not finish) at sentence end.
      // Check if we reached the sentence boundary to trigger loop logic.
      if (!loopRef.current) return;
      const state = useLessonStore.getState();
      const s = state.currentSentence();
      if (!s) return;
      const cur = ws.getCurrentTime();
      // Only trigger if we're at or past the sentence end (natural stop, not manual pause)
      if (cur < s.end_time - 0.1) return;

      const count = loopCountRef.current;
      const absCount = Math.abs(count);
      if (absCount > 0) {
        loopIterationRef.current++;
        if (loopIterationRef.current >= absCount) {
          loopIterationRef.current = 0;
          // Negative count = pause after loop (don't auto-advance)
          if (count < 0) return;
          if (!state.isLastSentence()) {
            state.nextSentence();
          }
          return;
        }
      }
      // Force visual reset before re-loop (fixes waveform not animating on repeats)
      ws.setTime(s.start_time);
      requestAnimationFrame(() => {
        ws.play(s.start_time, s.end_time);
      });
    });

    // Sync currentIndex to playback position during continuous playback
    let lastSyncedIndex = -1;
    ws.on("timeupdate", () => {
      const state = useLessonStore.getState();
      if (state.isLooping) return;
      const t = ws.getCurrentTime();
      const sentences = state.lesson?.sentences;
      if (!sentences) return;
      for (let i = 0; i < sentences.length; i++) {
        if (t >= sentences[i].start_time && t < sentences[i].end_time) {
          if (i !== lastSyncedIndex && i !== state.currentIndex) {
            lastSyncedIndex = i;
            timeupdateSyncRef.current = true;
            state.setCurrentIndex(i);
          }
          return;
        }
      }
    });

    // Fallback: fires when audio plays to actual end (rare with bounded play)
    ws.on("finish", () => {
      setIsPlaying(false);
    });

    ws.on("error", (err) => {
      console.error("WaveSurfer error:", err);
    });

    wsRef.current = ws;
    (window as any).__echoWavesurfer = ws;

    ws.load(audioBlobUrl);

    return () => {
      destroyed = true;
      ws.destroy();
      wsRef.current = null;
      wsReadyRef.current = false;
      lastLoadedUrlRef.current = null;
      delete (window as any).__echoWavesurfer;
    };
  }, [audioBlobUrl, isReady]);

  // Update region highlights when currentIndex or completion changes
  useEffect(() => {
    const regions = regionsRef.current;
    const lessonData = lesson;
    if (!regions || !lessonData) return;

    const currentS = lessonData.sentences[currentIndex];

    regions.getRegions().forEach((r) => {
      const done = completedSentences.includes(r.id);
      const isCurrent = r.id === currentS?.id;
      if (isCurrent) {
        r.setOptions({
          color: "rgba(99, 102, 241, 0.18)",
          drag: false,
          resize: false,
        });
      } else if (done) {
        r.setOptions({
          color: "rgba(34, 197, 94, 0.06)",
          drag: false,
          resize: false,
        });
      } else {
        const sentences = lessonData.sentences;
        const i = sentences.findIndex((s) => s.id === r.id);
        r.setOptions({
          color:
            i % 2 === 0
              ? "rgba(99, 102, 241, 0.04)"
              : "rgba(99, 102, 241, 0.02)",
          drag: false,
          resize: false,
        });
      }
    });
  }, [currentIndex, completedSentences, lesson]);

  // Sync waveColor to theme
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue("--color-waveform").trim();
    if (color && wsRef.current) {
      wsRef.current.setOptions({ waveColor: color });
    }
  }, [isDark]);

  // Sync playback rate
  useEffect(() => {
    wsRef.current?.setPlaybackRate(playbackRate, true);
  }, [playbackRate]);

  // Play the current sentence (loop ON: only this sentence; loop OFF: continuous)
  const playCurrentSentence = useCallback(() => {
    const ws = wsRef.current;
    const state = useLessonStore.getState();
    const s = state.currentSentence();

    if (!ws || !s) return;

    ws.pause();
    ws.setTime(s.start_time);

    const endTime = state.isLooping ? s.end_time : undefined;

    const doPlay = () => {
      requestAnimationFrame(() => {
        ws.play(s.start_time, endTime);
      });
    };

    const audioCtx = (ws as any).backend?.ac;
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  }, []);

  // First interaction handler
  const handleFirstPlay = useCallback(() => {
    setHasInteracted(true);
    hasInteractedRef.current = true;
    playCurrentSentence();
  }, [playCurrentSentence]);

  // Mark user interaction (called by keyboard hook on first Space press)
  const markInteracted = useCallback(() => {
    if (!hasInteractedRef.current) {
      setHasInteracted(true);
      hasInteractedRef.current = true;
    }
  }, []);

  // Expose playback & interaction functions globally
  useEffect(() => {
    (window as any).__echoPlayCurrentSentence = playCurrentSentence;
    (window as any).__echoMarkInteracted = markInteracted;
    (window as any).__echoResetTimeupdateFlag = () => {
      timeupdateSyncRef.current = false;
    };
    return () => {
      delete (window as any).__echoPlayCurrentSentence;
      delete (window as any).__echoMarkInteracted;
      delete (window as any).__echoResetTimeupdateFlag;
    };
  }, [playCurrentSentence, markInteracted]);

  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      loopIterationRef.current = 0;
    }
    if (
      hasInteractedRef.current &&
      prevIndexRef.current !== currentIndex &&
      wsRef.current &&
      lesson
    ) {
      if (timeupdateSyncRef.current) {
        timeupdateSyncRef.current = false;
      } else {
        playCurrentSentence();
      }
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex, lesson, playCurrentSentence]);

  useKeyboard();

  const handleBack = () => {
    // Stop and destroy WaveSurfer to halt all playback
    if (wsRef.current) {
      wsRef.current.pause();
      wsRef.current.destroy();
      wsRef.current = null;
      wsReadyRef.current = false;
      delete (window as any).__echoWavesurfer;
    }
    // Revoke blob URL to free browser memory
    const url = useLessonStore.getState().audioBlobUrl;
    if (url) URL.revokeObjectURL(url);
    hasInteractedRef.current = false;
    loopIterationRef.current = 0;
    timeupdateSyncRef.current = false;
    lastLoadedUrlRef.current = null;
    useLessonStore.getState().resetState();
    useLessonStore.getState().getAllCourses().then(setCourses);
  };

  const handleSelectCourse = useCallback(async (id: string) => {
    const prevUrl = useLessonStore.getState().audioBlobUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    const result = await useLessonStore.getState().loadLessonWithAudio(id);
    if (!result) return;
    const { lesson: lessonData, audioUrl } = result;

    // Pre-load progress so it's applied synchronously (no render with empty records)
    const progress = await db.progress.get(id);

    const maxIndex = Math.max(0, (lessonData.sentences.length ?? 1) - 1);
    timeupdateSyncRef.current = false;
    loopIterationRef.current = 0;
    useLessonStore.setState({
      lesson: lessonData,
      audioBlobUrl: audioUrl || undefined,
      currentIndex: Math.min(progress?.current_index ?? 0, maxIndex),
      dictationRecords: progress?.dictation_records ?? {},
      completedInDictation: progress?.completed_dictation ?? [],
      completedInShadowing: progress?.completed_shadowing ?? [],
      isLooping: true,
      loopCount: 3,
    });
  }, []);

  const handleDeleteCourse = useCallback(async (id: string) => {
    await useLessonStore.getState().deleteCourse(id);
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const sentence = currentSentence();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-zinc-950">
      {isReady && (
        <TopBar
          mode={mode}
          onModeChange={setMode}
          onBack={handleBack}
          completed={completedSentences.length}
          total={lesson?.sentences.length ?? 0}
        />
      )}

      {isReady && (
        <div className="h-1/4 w-full border-b border-zinc-800/50 shrink-0 relative bg-zinc-950/50">
          {/* Waveform info bar */}
          <div className="absolute top-3 left-5 z-10 flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-mono bg-zinc-900/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-800/40 tracking-tight shadow-[0_1px_3px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.02)]">
              {playbackRate}x
            </span>
            {isLooping && (
              <span className="text-[11px] text-indigo-400/80 font-mono bg-indigo-500/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-indigo-500/15 tracking-tight shadow-[0_0_12px_rgba(99,102,241,0.08)]">
                循环
              </span>
            )}
          </div>

          <div ref={waveformRef} className="w-full h-full" />

          {/* Waveform bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-950/60 to-transparent pointer-events-none z-[5]" />

          {/* First-play overlay */}
          {!hasInteracted && (
            <button
              onClick={handleFirstPlay}
              className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[2px] hover:bg-zinc-950/20 transition-all duration-700 cursor-pointer group"
            >
              <div className="flex items-center gap-3.5 px-8 py-4.5 rounded-2xl bg-indigo-500/90 hover:bg-indigo-500 hover:scale-[1.02] transition-all duration-500 shadow-[0_8px_40px_-8px_rgba(99,102,241,0.35),0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_12px_48px_-8px_rgba(99,102,241,0.5)]">
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/25 transition-all duration-300">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
                <span className="text-white font-medium text-sm tracking-wide">
                  点击开始播放
                </span>
              </div>
              <p className="text-zinc-400/60 text-xs mt-3">或按 <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 border border-white/10 font-mono">Space</kbd> 键</p>
            </button>
          )}

          {/* Translation overlay */}
          {showTranslation && sentence && !editingTranslation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800/40 rounded-xl px-5 py-3 text-sm text-zinc-300 max-w-lg text-center z-10 group shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] animate-fade-in">
              {sentence.zh ? (
                <span className="leading-relaxed">{sentence.zh}</span>
              ) : (
                <button
                  onClick={() => {
                    setEditZhValue("");
                    setEditingTranslation(true);
                  }}
                  className="text-zinc-500 hover:text-indigo-400 transition-colors text-xs underline underline-offset-4 decoration-zinc-700/50 hover:decoration-indigo-500/40"
                >
                  点击添加翻译
                </button>
              )}
              {sentence.zh && (
                <button
                  onClick={() => {
                    setEditZhValue(sentence.zh);
                    setEditingTranslation(true);
                  }}
                  className="ml-2.5 opacity-60 hover:opacity-100 transition-all text-zinc-500 hover:text-zinc-200 align-middle"
                >
                  <Pencil className="w-3 h-3 inline" />
                </button>
              )}
            </div>
          )}

          {/* Translation edit */}
          {showTranslation && editingTranslation && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm z-10 flex items-center gap-2 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] animate-fade-in">
              <input
                value={editZhValue}
                onChange={(e) => setEditZhValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTranslation();
                  }
                  if (e.key === "Escape") {
                    setEditingTranslation(false);
                  }
                }}
                placeholder="输入中文翻译..."
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500/70 transition-colors w-48"
                autoFocus
              />
              <button
                onClick={handleSaveTranslation}
                className="shrink-0 w-8 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all duration-200 flex items-center justify-center shadow-[0_2px_8px_rgba(34,197,94,0.2)]"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditingTranslation(false)}
                className="shrink-0 w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all duration-200 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto">
        {!isReady && coursesLoaded && courses.length > 0 ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-md py-8">
            <CourseList
              courses={courses}
              onSelect={handleSelectCourse}
              onDelete={handleDeleteCourse}
            />
            <button
              onClick={() => setCourses([])}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-4 decoration-zinc-800"
            >
              上传新课程
            </button>
          </div>
        ) : !isReady ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <FileUploader />
            {courses.length > 0 && (
              <button
                onClick={() => {
                  useLessonStore.getState().getAllCourses().then(setCourses);
                }}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-4 decoration-zinc-800"
              >
                返回课程列表
              </button>
            )}
          </div>
        ) : mode === "dictation" ? (
          <DictationWorkspace key="dictation" />
        ) : (
          <ShadowingWorkspace key="shadowing" />
        )}
      </div>

      {isReady && <FooterBar mode={mode} />}
    </div>
  );
}
