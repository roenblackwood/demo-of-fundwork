export type WeekStatus = "open" | "done" | "not-done";

export type WeekPlan = {
  id: string;
  projectId: string;
  goal: string;
  stepOne: string;
  stepTwo: string;
  status: WeekStatus;
  happened: string;
  createdAt: string;
};

export type PersonLearning = {
  seen: string[];
  done: string[];
  basics: boolean;
};

export type ProgressState = {
  byUser: Record<string, PersonLearning>;
  weeks: WeekPlan[];
};

export const emptyProgress = (): ProgressState => ({ byUser: {}, weeks: [] });

function person(state: ProgressState, userId: string): PersonLearning {
  return state.byUser[userId] ?? { seen: [], done: [], basics: false };
}

function withPerson(state: ProgressState, userId: string, next: PersonLearning): ProgressState {
  return { ...state, byUser: { ...state.byUser, [userId]: next } };
}

export function seeLessons(state: ProgressState, userId: string, ids: string[]): ProgressState {
  const current = person(state, userId);
  const seen = [...new Set([...current.seen, ...ids.filter(Boolean)])];
  if (seen.length === current.seen.length) return state;
  return withPerson(state, userId, { ...current, seen });
}

export function finishLessons(state: ProgressState, userId: string, ids: string[]): ProgressState {
  const current = person(state, userId);
  const done = [...new Set([...current.done, ...ids.filter(Boolean)])];
  const seen = [...new Set([...current.seen, ...ids.filter(Boolean)])];
  if (done.length === current.done.length && seen.length === current.seen.length) return state;
  return withPerson(state, userId, { ...current, seen, done });
}

export function passBasics(state: ProgressState, userId: string, ids: string[]): ProgressState {
  const current = person(state, userId);
  if (current.basics) return finishLessons(state, userId, ids);
  const next = finishLessons(state, userId, ids);
  const learned = person(next, userId);
  return withPerson(next, userId, { ...learned, basics: true });
}

export function openWeek(
  state: ProgressState,
  input: { id: string; projectId: string; goal: string; stepOne: string; stepTwo: string; createdAt: string },
): ProgressState {
  const goal = input.goal.trim();
  const stepOne = input.stepOne.trim();
  const stepTwo = input.stepTwo.trim();
  if (!goal || !stepOne || !stepTwo) return state;
  if (state.weeks.some((week) => week.projectId === input.projectId && week.status === "open")) return state;
  const week: WeekPlan = {
    id: input.id,
    projectId: input.projectId,
    goal,
    stepOne,
    stepTwo,
    status: "open",
    happened: "",
    createdAt: input.createdAt,
  };
  return { ...state, weeks: [...state.weeks, week] };
}

export function closeWeek(
  state: ProgressState,
  input: { id: string; status: "done" | "not-done"; happened: string },
): ProgressState {
  const happened = input.happened.trim();
  if (!happened) return state;
  let changed = false;
  const weeks = state.weeks.map((week) => {
    if (week.id !== input.id || week.status !== "open") return week;
    changed = true;
    return { ...week, status: input.status, happened };
  });
  if (!changed) return state;
  return { ...state, weeks };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeProgress(value: unknown): ProgressState {
  if (!value || typeof value !== "object") return emptyProgress();
  const raw = value as Partial<ProgressState>;
  const byUser: ProgressState["byUser"] = {};
  if (raw.byUser && typeof raw.byUser === "object") {
    for (const [id, item] of Object.entries(raw.byUser)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Partial<PersonLearning>;
      byUser[id] = {
        seen: stringList(row.seen),
        done: stringList(row.done),
        basics: row.basics === true,
      };
    }
  }
  const weeks = Array.isArray(raw.weeks)
    ? raw.weeks.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const week = item as Partial<WeekPlan>;
        if (!week.id || !week.projectId || !week.goal || !week.stepOne || !week.stepTwo) return [];
        const status = week.status === "done" || week.status === "not-done" || week.status === "open" ? week.status : "open";
        return [
          {
            id: week.id,
            projectId: week.projectId,
            goal: week.goal,
            stepOne: week.stepOne,
            stepTwo: week.stepTwo,
            status,
            happened: typeof week.happened === "string" ? week.happened : "",
            createdAt: typeof week.createdAt === "string" ? week.createdAt : "",
          },
        ];
      })
    : [];
  return { byUser, weeks };
}
