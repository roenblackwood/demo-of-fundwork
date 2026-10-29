"use client";

import { useEffect } from "react";
import { useDemo } from "@/lib/demo-store";
import type { Lesson } from "@/lib/lessons";

export function LessonCard({ lesson }: { lesson: Lesson }) {
  return (
    <article className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="text-lg font-semibold leading-snug">{lesson.title}</h2>
      <p className="text-base leading-relaxed">{lesson.body}</p>
      <p className="text-base font-semibold leading-snug">{lesson.rule}</p>
      <p className="text-base leading-snug">{lesson.action}</p>
    </article>
  );
}

export function LessonList({ lessons }: { lessons: Lesson[] }) {
  const demo = useDemo();
  const key = lessons.map((lesson) => lesson.id).join("|");

  useEffect(() => {
    if (!key) return;
    demo.markLessonsSeen(key.split("|"));
  }, [demo, key]);

  if (lessons.length === 0) return null;
  return (
    <div className="space-y-3">
      {lessons.map((lesson) => (
        <LessonCard key={lesson.id} lesson={lesson} />
      ))}
    </div>
  );
}
