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
  } = {},
): Task {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("A task needs a title");
  }
  return {
    id: options.id ?? crypto.randomUUID(),
    title: trimmed,
    status: "todo",
    priority: options.priority ?? DEFAULT_PRIORITY,
    createdAt: options.now ?? Date.now(),
  };
}

// Tasks stored before priorities existed have no `priority` field. They read
// back as normal rather than being migrated in place.
export function taskPriority(task: Task): TaskPriority {
  return task.priority ?? DEFAULT_PRIORITY;
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
