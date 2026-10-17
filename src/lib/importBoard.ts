import {
  DEFAULT_PRIORITY,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "./tasks";

// The outcome of reading a board file: either every task in it, or a short
// message explaining why the file was rejected. There is no partial success —
// the caller only ever sees tasks once the whole file checks out.
export type ParseBoardResult =
  | { ok: true; tasks: Task[] }
  | { ok: false; error: string };

const DUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}

function isPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority);
}

// A due date is the `YYYY-MM-DD` an <input type="date"> writes, so a string
// that only looks like a date (`2026-13-45`) is still rejected.
function isDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !DUE_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// Reads one task, returning either it or the reason it is not valid. The caller
// runs this for every entry before accepting any of them, so a single bad task
// rejects the whole file.
function parseTask(value: unknown): { task: Task } | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "That file has a task that is not an object." };
  }
  const { id, title, status, priority, createdAt, dueDate } = value as Record<
    string,
    unknown
  >;

  if (typeof id !== "string" || id === "") {
    return { error: "That file has a task without a valid id." };
  }
  if (typeof title !== "string" || title.trim() === "") {
    return { error: "That file has a task without a title." };
  }
  if (!isStatus(status)) {
    return { error: `Task "${title}" has an unknown status.` };
  }
  // An older export predates priorities; those tasks read back as normal.
  let normalizedPriority: TaskPriority = DEFAULT_PRIORITY;
  if (priority !== undefined) {
    if (!isPriority(priority)) {
      return { error: `Task "${title}" has an unknown priority.` };
    }
    normalizedPriority = priority;
  }
  if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) {
    return { error: `Task "${title}" has an invalid creation time.` };
  }
  let normalizedDueDate: string | undefined;
  if (dueDate !== undefined) {
    if (!isDueDate(dueDate)) {
      return { error: `Task "${title}" has an invalid due date.` };
    }
    normalizedDueDate = dueDate;
  }

  const task: Task = {
    id,
    title,
    status,
    priority: normalizedPriority,
    createdAt,
  };
  if (normalizedDueDate !== undefined) {
    task.dueDate = normalizedDueDate;
  }
  return { task };
}

// Validates the text of an exported board file. Bad JSON, a shape that is not
// an array of tasks, an invalid field or a duplicate id all reject the whole
// file, so an import can never leave the board half replaced.
export function parseBoard(text: string): ParseBoardResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!Array.isArray(value)) {
    return { ok: false, error: "That file is not a taskboard export." };
  }

  const tasks: Task[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const parsed = parseTask(entry);
    if ("error" in parsed) {
      return { ok: false, error: parsed.error };
    }
    if (seen.has(parsed.task.id)) {
      return {
        ok: false,
        error: `That file has two tasks with the same id "${parsed.task.id}".`,
      };
    }
    seen.add(parsed.task.id);
    tasks.push(parsed.task);
  }

  return { ok: true, tasks };
}
