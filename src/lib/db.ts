import Dexie, { type EntityTable } from "dexie";
import type { LessonData, LessonProgress } from "@/lib/types";

interface AudioRecord {
  lesson_id: string;
  blob: Blob;
}

const db = new Dexie("EchoLingo") as Dexie & {
  progress: EntityTable<LessonProgress, "lesson_id">;
  lessons: EntityTable<LessonData, "id">;
  audio: EntityTable<AudioRecord, "lesson_id">;
};

db.version(1).stores({
  progress: "lesson_id, last_accessed_at",
});

db.version(2)
  .stores({
    progress: "lesson_id, last_accessed_at",
  })
  .upgrade(async (tx) => {
    const records = await tx.table("progress").toArray();
    for (const r of records) {
      const old = r as any;
      if (old.completed_sentences && !old.completed_dictation) {
        await tx.table("progress").put({
          lesson_id: old.lesson_id,
          completed_dictation: old.completed_sentences,
          completed_shadowing: old.completed_sentences,
          last_accessed_at: old.last_accessed_at || Date.now(),
        });
      }
    }
  });

db.version(3).stores({
  progress: "lesson_id, last_accessed_at",
  lessons: "id, title",
  audio: "lesson_id",
});

db.version(4).stores({
  progress: "lesson_id, last_accessed_at",
  lessons: "id, title",
  audio: "lesson_id",
}).upgrade(async (tx) => {
  // Add defaults for new progress fields (current_index, dictation_records)
  const records = await tx.table("progress").toArray();
  for (const r of records) {
    const old = r as any;
    if (old.current_index === undefined) {
      await tx.table("progress").put({
        lesson_id: old.lesson_id,
        completed_dictation: old.completed_dictation ?? [],
        completed_shadowing: old.completed_shadowing ?? [],
        current_index: 0,
        dictation_records: {},
        last_accessed_at: old.last_accessed_at ?? Date.now(),
      });
    }
  }
});

export { db };
export type { LessonProgress };

/** 保存课程完整数据（含音频 blob）到 IndexedDB */
export async function saveFullLesson(
  lessonData: LessonData,
  audioBlob: Blob | null
) {
  await db.transaction("rw", [db.lessons, db.audio], async () => {
    await db.lessons.put(lessonData);
    if (audioBlob) {
      await db.audio.put({ lesson_id: lessonData.id, blob: audioBlob });
    }
  });
}

/** 从 IndexedDB 恢复课程数据和音频 URL */
export async function loadFullLesson(
  lessonId: string
): Promise<{ lesson: LessonData; audioUrl: string } | null> {
  const lesson = await db.lessons.get(lessonId);
  if (!lesson) return null;

  const audioRecord = await db.audio.get(lessonId);
  const audioUrl = audioRecord?.blob
    ? URL.createObjectURL(audioRecord.blob)
    : "";

  return { lesson, audioUrl };
}

/** 删除课程及其关联数据 */
export async function deleteFullLesson(lessonId: string) {
  await db.transaction("rw", [db.lessons, db.audio, db.progress], async () => {
    await db.lessons.delete(lessonId);
    await db.audio.delete(lessonId);
    await db.progress.delete(lessonId);
  });
}
