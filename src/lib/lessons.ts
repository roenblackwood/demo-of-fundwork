import raw from "../../data/lessons.json";
import type { Sector, Skill } from "@/lib/types";

/**
 * Checked lesson cards. The screen shows these words.
 * Optional AI rewrite later uses the same rules as starter guides.
 * The model may only rephrase a card. It may not add facts, prices, rates, returns, or timelines.
 * Templates are always used.
 * Not built yet: lessons in other languages, audio for people who read little,
 * mentor messaging, and measuring whether lessons change what people do.
 * Experienced organizers mentor new ones, matched by sector and parish.
 */

export const AUDIENCES = ["investor", "organizer", "worker"] as const;
export const MOMENTS = ["investor-basics", "first-month", "running", "on-project", "grow-work"] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Moment = (typeof MOMENTS)[number];

export type Lesson = {
  id: string;
  audience: Audience;
  moment: Moment;
  sector?: Sector;
  skill?: Skill;
  title: string;
  body: string;
  rule: string;
  action: string;
  checkedOn: string;
};

const lessons = raw.lessons as Lesson[];

/** The first three cards for a stage are the This week suggestions. */
export function allLessons(): Lesson[] {
  return lessons;
}

export function lessonById(id: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === id);
}

export function lessonsForMoment(audience: Audience, moment: Moment): Lesson[] {
  return lessons.filter((lesson) => lesson.audience === audience && lesson.moment === moment);
}

export function stageLessons(sector: Sector, workStarted: boolean): Lesson[] {
  if (!workStarted) return lessonsForMoment("organizer", "first-month");
  return lessons.filter(
    (lesson) => lesson.audience === "organizer" && lesson.moment === "running" && lesson.sector === sector,
  );
}

export function weekGoals(sector: Sector, workStarted: boolean): string[] {
  return stageLessons(sector, workStarted)
    .slice(0, 3)
    .map((lesson) => lesson.action);
}

export function workerProjectLessons(skills: Skill[]): Lesson[] {
  const mine = new Set(skills);
  return lessons.filter((lesson) => {
    if (lesson.audience !== "worker" || lesson.moment !== "on-project") return false;
    if (!lesson.skill) return true;
    return mine.has(lesson.skill);
  });
}

export function growWorkLesson(): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === "grow-work");
}

/** True or false checks for the loss, selling, and time cards. Explanations use the lesson body. */
export const INVESTOR_CHECKS = [
  {
    lessonId: "investor-lose",
    statement: "You can lose all the money you put in.",
    answer: true,
  },
  {
    lessonId: "investor-sell",
    statement: "You can sell these units any time.",
    answer: false,
  },
  {
    lessonId: "investor-time",
    statement: "It can take years, and it may pay nothing.",
    answer: true,
  },
] as const;

export function investorBasicsIds(): string[] {
  return lessonsForMoment("investor", "investor-basics").map((lesson) => lesson.id);
}
