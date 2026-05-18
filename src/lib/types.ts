export interface Sentence {
  id: string;
  start_time: number;
  end_time: number;
  en: string;
  zh: string;
}

export interface LessonData {
  id: string;
  title: string;
  source_audio: string;
  metadata: {
    difficulty: string;
    word_count: number;
  };
  sentences: Sentence[];
}

export interface DictationRecord {
  userInput: string;
  result: "correct" | "wrong" | "no-reference";
  diff?: { value: string; added?: boolean; removed?: boolean }[];
}

export interface LessonProgress {
  lesson_id: string;
  completed_dictation: string[];
  completed_shadowing: string[];
  last_accessed_at: number;
}
