export type TaskStatus = "todo" | "doing" | "done";

export const TASK_STATUSES: readonly TaskStatus[] = ["todo", "doing", "done"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
};

export type TaskPriority = "low" | "normal" | "high";

export const TASK_PRIORITIES: readonly TaskPriority[] = [
  "low",
  "normal",
  "high",
];

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const DEFAULT_PRIORITY: TaskPriority = "normal";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  /** The calendar day the task is due, as `YYYY-MM-DD`. Optional. */
  dueDate?: string;
};

export const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: "doing",
  doing: "done",
  done: null,
};

export const PREVIOUS_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: null,
  doing: "todo",
  done: "doing",
};

export function createTask(
  title: string,
  options: {
    id?: string;
    now?: number;
    priority?: TaskPriority;
    dueDate?: string;
  } = {},
): Task {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("A task needs a title");
  }
  const task: Task = {
    id: options.id ?? crypto.randomUUID(),
    title: trimmed,
    status: "todo",
    priority: options.priority ?? DEFAULT_PRIORITY,
    createdAt: options.now ?? Date.now(),
  };
  if (options.dueDate) {
    task.dueDate = options.dueDate;
  }
  return task;
}

// Tasks stored before priorities existed have no `priority` field. They read
// back as normal rather than being migrated in place.
export function taskPriority(task: Task): TaskPriority {
  return task.priority ?? DEFAULT_PRIORITY;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

// Orders tasks within a column: priority first, then the nearest due date, then
// oldest first. Tasks without a due date sort after dated ones in the same
// priority, and `id` breaks any remaining ties so the order never depends on
// where a task happened to sit in the stored array.
export function compareTasks(a: Task, b: Task): number {
  const byPriority =
    PRIORITY_ORDER[taskPriority(a)] - PRIORITY_ORDER[taskPriority(b)];
  if (byPriority !== 0) {
    return byPriority;
  }

  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === undefined) return 1;
    if (b.dueDate === undefined) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// A due date is a plain calendar day, so both the comparison and the label
// work from the stored `YYYY-MM-DD` parts and never depend on a time zone.
function isoDay(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Tasks stored before due dates existed have no `dueDate` field; they read back
// as having no deadline and keep working untouched.
export function setDueDate(
  tasks: readonly Task[],
  id: string,
  dueDate: string,
): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || !dueDate || task.dueDate === dueDate) {
    return tasks as Task[];
  }
  return tasks.map((t) => (t.id === id ? { ...t, dueDate } : t));
}

export function clearDueDate(tasks: readonly Task[], id: string): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.dueDate === undefined) {
    return tasks as Task[];
  }
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t };
    delete next.dueDate;
    return next;
  });
}

export function isOverdue(task: Task, now: number = Date.now()): boolean {
  if (!task.dueDate || task.status === "done") {
    return false;
  }
  // A deadline is only overdue once the whole day has gone by.
  return task.dueDate < isoDay(now);
}

export function dueDateLabel(dueDate: string): string {
  const [, month, day] = dueDate.split("-").map(Number);
  return `Due ${MONTHS[month - 1]} ${day}`;
}

export function moveTask(
  tasks: readonly Task[],
  id: string,
  status: TaskStatus,
): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.status === status) {
    return tasks as Task[];
  }
  return tasks.map((t) => (t.id === id ? { ...t, status } : t));
}

export function advanceTask(tasks: readonly Task[], id: string): Task[] {
  const task = tasks.find((t) => t.id === id);
  const next = task ? NEXT_STATUS[task.status] : null;
  return next ? moveTask(tasks, id, next) : (tasks as Task[]);
}

export function retreatTask(tasks: readonly Task[], id: string): Task[] {
  const task = tasks.find((t) => t.id === id);
  const previous = task ? PREVIOUS_STATUS[task.status] : null;
  return previous ? moveTask(tasks, id, previous) : (tasks as Task[]);
}

export function renameTask(
  tasks: readonly Task[],
  id: string,
  title: string,
): Task[] {
  const task = tasks.find((t) => t.id === id);
  const trimmed = title.trim();
  if (!task || !trimmed || trimmed === task.title) {
    return tasks as Task[];
  }
  return tasks.map((t) => (t.id === id ? { ...t, title: trimmed } : t));
}

export function deleteTask(tasks: readonly Task[], id: string): Task[] {
  if (!tasks.some((t) => t.id === id)) {
    return tasks as Task[];
  }
  return tasks.filter((t) => t.id !== id);
}

export function clearDone(tasks: readonly Task[]): Task[] {
  if (!tasks.some((t) => t.status === "done")) {
    return tasks as Task[];
  }
  return tasks.filter((t) => t.status !== "done");
}

export function taskCounts(tasks: readonly Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 };
  for (const task of tasks) {
    counts[task.status] += 1;
  }
  return counts;
}

export function taskSummary(tasks: readonly Task[]): string {
  const total = tasks.length;
  if (total === 0) {
    return "No tasks yet — add one to get started";
  }
  const done = taskCounts(tasks).done;
  const totalLabel = total === 1 ? "1 task" : `${total} tasks`;
  return `${totalLabel} · ${done} done`;
}
