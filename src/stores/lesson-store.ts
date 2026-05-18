import { create } from "zustand";
import type { DictationRecord, LessonData, Sentence } from "@/lib/types";
import { db } from "@/lib/db";

export type PracticeMode = "dictation" | "shadowing";

interface LessonState {
  lesson: LessonData | null;
  audioBlobUrl: string | null;
  currentIndex: number;
  playbackRate: number;
  isLooping: boolean;
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
  setShowTranslation: (show: boolean) => void;
  currentSentence: () => Sentence | null;
  isLastSentence: () => boolean;
  isFirstSentence: () => boolean;
  markCompleted: (sentenceId: string, mode: PracticeMode) => void;
  unmarkCompleted: (sentenceId: string, mode: PracticeMode) => void;
  isSentenceCompleted: (sentenceId: string, mode: PracticeMode) => boolean;
  addDictationRecord: (sentenceId: string, record: DictationRecord) => void;
  loadProgress: () => Promise<void>;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  lesson: null,
  audioBlobUrl: null,
  currentIndex: 0,
  playbackRate: 1.0,
  isLooping: false,
  showTranslation: false,
  completedInDictation: [],
  completedInShadowing: [],
  dictationRecords: {},

  setLesson: (lesson) => {
    set({ lesson, currentIndex: 0, dictationRecords: {} });
    get().loadProgress();
  },

  updateLesson: (lesson) => set({ lesson }),

  setAudioBlobUrl: (url) => set({ audioBlobUrl: url }),

  setCurrentIndex: (index) => set({ currentIndex: index }),

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
      last_accessed_at: Date.now(),
    };
    await db.progress.put(progress);
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
      last_accessed_at: Date.now(),
    };
    await db.progress.put(progress);
  },

  isSentenceCompleted: (sentenceId, mode) => {
    const arr = mode === "dictation" ? get().completedInDictation : get().completedInShadowing;
    return arr.includes(sentenceId);
  },

  addDictationRecord: (sentenceId, record) => {
    set((state) => ({
      dictationRecords: { ...state.dictationRecords, [sentenceId]: record },
    }));
  },

  loadProgress: async () => {
    const { lesson } = get();
    if (!lesson) return;

    const record = await db.progress.get(lesson.id);
    if (record) {
      set({
        completedInDictation: record.completed_dictation ?? [],
        completedInShadowing: record.completed_shadowing ?? [],
      });
    } else {
      set({ completedInDictation: [], completedInShadowing: [] });
    }
  },
}));
