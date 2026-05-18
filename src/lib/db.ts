import Dexie, { type EntityTable } from "dexie";
import type { LessonProgress } from "@/lib/types";

const db = new Dexie("EchoLingo") as Dexie & {
  progress: EntityTable<LessonProgress, "lesson_id">;
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

export { db };
export type { LessonProgress };
