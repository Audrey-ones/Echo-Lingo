import { create } from "zustand";
import type { DictationRecord, LessonData, Sentence } from "@/lib/types";
import { db, saveFullLesson, loadFullLesson, deleteFullLesson } from "@/lib/db";

export type PracticeMode = "dictation" | "shadowing";

export interface CourseSummary {
  id: string;
  title: string;
  sentenceCount: number;
  completedDictation: number;
  completedShadowing: number;
  lastAccessedAt: number;
}

interface LessonState {
  lesson: LessonData | null;
  audioBlobUrl: string | null;
  currentIndex: number;
  playbackRate: number;
  isLooping: boolean;
  loopCount: number; // 循环次数，0=无限
  showTranslation: boolean;
  completedInDictation: string[];
  completedInShadowing: string[];
  dictationRecords: Record<string, DictationRecord>;
  // 操作
  setLesson: (lesson: LessonData) => void;
  updateLesson: (lesson: LessonData) => void;
  setAudioBlobUrl: (url: string) => void;
  setCurrentIndex: (index: number) => void;
  nextSentence: () => void;
  prevSentence: () => void;
  setPlaybackRate: (rate: number) => void;
  adjustPlaybackRate: (delta: number) => void;
  toggleLoop: () => void;
  setLoopCount: (count: number) => void;
  cycleLoopCount: () => void;
  setShowTranslation: (show: boolean) => void;
  currentSentence: () => Sentence | null;
  isLastSentence: () => boolean;
  isFirstSentence: () => boolean;
  markCompleted: (sentenceId: string, mode: PracticeMode) => void;
  unmarkCompleted: (sentenceId: string, mode: PracticeMode) => void;
  isSentenceCompleted: (sentenceId: string, mode: PracticeMode) => boolean;
  addDictationRecord: (sentenceId: string, record: DictationRecord) => void;
  completeDictationSentence: (sentenceId: string, record: DictationRecord) => void;
  loadProgress: () => Promise<void>;
  // 课程管理
  saveLessonToDB: () => Promise<void>;
  loadLessonWithAudio: (id: string) => Promise<{ lesson: LessonData; audioUrl: string } | null>;
  getAllCourses: () => Promise<CourseSummary[]>;
  deleteCourse: (id: string) => Promise<void>;
  resetState: () => void;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  lesson: null,
  audioBlobUrl: null,
  currentIndex: 0,
  playbackRate: 1.0,
  isLooping: true,
  loopCount: 3,
  showTranslation: false,
  completedInDictation: [],
  completedInShadowing: [],
  dictationRecords: {},

  setLesson: (lesson) => {
    // Start with defaults, then immediately try to load saved progress
    set({
      lesson,
      currentIndex: 0,
      dictationRecords: {},
      completedInDictation: [],
      completedInShadowing: [],
      isLooping: true,
      loopCount: 3,
    });
    // Load progress from DB and merge into state
    db.progress.get(lesson.id).then((record) => {
      // Only apply if still on the same lesson
      if (get().lesson?.id !== lesson.id) return;
      if (record) {
        const maxIndex = (lesson.sentences.length ?? 1) - 1;
        set({
          completedInDictation: record.completed_dictation ?? [],
          completedInShadowing: record.completed_shadowing ?? [],
          currentIndex: Math.min(record.current_index ?? 0, maxIndex),
          dictationRecords: record.dictation_records ?? {},
        });
      }
    });
  },

  updateLesson: (lesson) => set({ lesson }),

  setAudioBlobUrl: (url) => set({ audioBlobUrl: url }),

  setCurrentIndex: (index) => {
    const { lesson } = get();
    if (lesson && index >= 0 && index < lesson.sentences.length) {
      set({ currentIndex: index });
    }
  },

  nextSentence: () => {
    const { currentIndex, lesson } = get();
    if (lesson && currentIndex < lesson.sentences.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevSentence: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  setPlaybackRate: (rate) => set({ playbackRate: rate }),

  adjustPlaybackRate: (delta) => {
    const newRate = Math.round((get().playbackRate + delta) * 10) / 10;
    if (newRate >= 0.5 && newRate <= 2.0) {
      set({ playbackRate: newRate });
    }
  },

  toggleLoop: () => set((state) => ({ isLooping: !state.isLooping })),

  setLoopCount: (count) => set({ loopCount: count }),

  cycleLoopCount: () => {
    // Positive = auto-advance, Negative = pause after, 0 = infinite
    const counts = [1, 2, 3, 5, 0, -1, -2, -3, -5];
    const current = get().loopCount;
    const idx = counts.indexOf(current);
    set({ loopCount: counts[(idx + 1) % counts.length] });
  },

  setShowTranslation: (show) => set({ showTranslation: show }),

  currentSentence: () => {
    const { lesson, currentIndex } = get();
    return lesson?.sentences[currentIndex] ?? null;
  },

  isLastSentence: () => {
    const { lesson, currentIndex } = get();
    return lesson ? currentIndex >= lesson.sentences.length - 1 : true;
  },

  isFirstSentence: () => {
    return get().currentIndex === 0;
  },

  markCompleted: async (sentenceId, mode) => {
    const { lesson, completedInDictation, completedInShadowing } = get();
    if (!lesson) return;

    const key = mode === "dictation" ? "completedInDictation" : "completedInShadowing";
    const current = mode === "dictation" ? completedInDictation : completedInShadowing;
    if (current.includes(sentenceId)) return;

    const updated = [...current, sentenceId];
    set({ [key]: updated });

    // Read latest state after set() to avoid stale values in DB write
    const latest = get();
    const progress = {
      lesson_id: lesson.id,
      completed_dictation: latest.completedInDictation,
      completed_shadowing: latest.completedInShadowing,
      current_index: latest.currentIndex,
      dictation_records: latest.dictationRecords,
      last_accessed_at: Date.now(),
    };
    await db.progress.put(progress).catch(console.error);
  },

  unmarkCompleted: async (sentenceId, mode) => {
    const { lesson, completedInDictation, completedInShadowing } = get();
    if (!lesson) return;

    const key = mode === "dictation" ? "completedInDictation" : "completedInShadowing";
    const current = mode === "dictation" ? completedInDictation : completedInShadowing;
    if (!current.includes(sentenceId)) return;

    const updated = current.filter((id) => id !== sentenceId);
    set((state) => {
      const newRecords = { ...state.dictationRecords };
      delete newRecords[sentenceId];
      return { [key]: updated, dictationRecords: newRecords };
    });

    // Read latest state after set() to avoid stale values in DB write
    const latest = get();
    const progress = {
      lesson_id: lesson.id,
      completed_dictation: latest.completedInDictation,
      completed_shadowing: latest.completedInShadowing,
      current_index: latest.currentIndex,
      dictation_records: latest.dictationRecords,
      last_accessed_at: Date.now(),
    };
    await db.progress.put(progress).catch(console.error);
  },

  isSentenceCompleted: (sentenceId, mode) => {
    const arr = mode === "dictation" ? get().completedInDictation : get().completedInShadowing;
    return arr.includes(sentenceId);
  },

  addDictationRecord: (sentenceId, record) => {
    set((state) => ({
      dictationRecords: { ...state.dictationRecords, [sentenceId]: record },
    }));
    // Persist immediately to DB (no slow audio fetch needed)
    const { lesson } = get();
    if (!lesson) return;
    db.progress.put({
      lesson_id: lesson.id,
      completed_dictation: get().completedInDictation,
      completed_shadowing: get().completedInShadowing,
      current_index: get().currentIndex,
      dictation_records: get().dictationRecords,
      last_accessed_at: Date.now(),
    }).catch(console.error);
  },

  completeDictationSentence: (sentenceId, record) => {
    set((state) => {
      const newRecords = { ...state.dictationRecords, [sentenceId]: record };
      const newCompleted = state.completedInDictation.includes(sentenceId)
        ? state.completedInDictation
        : [...state.completedInDictation, sentenceId];
      return {
        dictationRecords: newRecords,
        completedInDictation: newCompleted,
      };
    });
    const { lesson, completedInDictation, completedInShadowing, currentIndex, dictationRecords } = get();
    if (!lesson) return;
    db.progress.put({
      lesson_id: lesson.id,
      completed_dictation: completedInDictation,
      completed_shadowing: completedInShadowing,
      current_index: currentIndex,
      dictation_records: dictationRecords,
      last_accessed_at: Date.now(),
    }).catch(console.error);
  },

  loadProgress: async () => {
    const { lesson } = get();
    if (!lesson) return;

    const record = await db.progress.get(lesson.id);
    if (record) {
      const maxIndex = (lesson?.sentences.length ?? 1) - 1;
      set({
        completedInDictation: record.completed_dictation ?? [],
        completedInShadowing: record.completed_shadowing ?? [],
        currentIndex: Math.min(record.current_index ?? 0, maxIndex),
        dictationRecords: record.dictation_records ?? {},
      });
    } else {
      set({
        completedInDictation: [],
        completedInShadowing: [],
        currentIndex: 0,
        dictationRecords: {},
      });
    }
  },

  saveLessonToDB: async () => {
    const { lesson, audioBlobUrl } = get();
    if (!lesson) return;

    // Fetch the blob from the URL if available
    let audioBlob: Blob | null = null;
    if (audioBlobUrl) {
      try {
        const res = await fetch(audioBlobUrl);
        audioBlob = await res.blob();
      } catch {
          console.error("无法获取音频 Blob，仅保存课程数据");
        }
    }

    await saveFullLesson(lesson, audioBlob);

    const progress = {
      lesson_id: lesson.id,
      completed_dictation: get().completedInDictation,
      completed_shadowing: get().completedInShadowing,
      current_index: get().currentIndex,
      dictation_records: get().dictationRecords,
      last_accessed_at: Date.now(),
    };
    await db.progress.put(progress).catch(console.error);
  },

  loadLessonWithAudio: async (id) => {
    return loadFullLesson(id);
  },

  getAllCourses: async () => {
    const lessons = await db.lessons.toArray();
    const progresses = await db.progress.toArray();
    const progressMap = new Map(progresses.map((p) => [p.lesson_id, p]));

    return lessons.map((l) => {
      const p = progressMap.get(l.id);
      return {
        id: l.id,
        title: l.title,
        sentenceCount: l.sentences.length,
        completedDictation: p?.completed_dictation?.length ?? 0,
        completedShadowing: p?.completed_shadowing?.length ?? 0,
        lastAccessedAt: p?.last_accessed_at ?? 0,
      };
    }).sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  },

  deleteCourse: async (id) => {
    await deleteFullLesson(id);
  },

  resetState: () => {
    set({
      lesson: null,
      audioBlobUrl: null,
      currentIndex: 0,
      completedInDictation: [],
      completedInShadowing: [],
      dictationRecords: {},
    });
  },
}));
