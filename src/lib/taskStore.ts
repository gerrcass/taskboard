import type { Task } from "./tasks";

// The board's tasks live in localStorage, exposed as an external store so React
// reads them with useSyncExternalStore. That keeps server rendering and the
// first client render identical (both see an empty board), and gives cross-tab
// updates for free through the window "storage" event.

export const STORAGE_KEY = "taskboard.tasks.v1";

const EMPTY: Task[] = [];

// getSnapshot must return a stable reference until the stored value changes,
// so the parsed value is cached against the raw string it came from.
let cachedRaw: string | null | undefined = undefined;
let cachedTasks: Task[] = EMPTY;
const listeners = new Set<() => void>();

function parse(stored: string | null): Task[] {
  if (!stored) return EMPTY;
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? (value as Task[]) : EMPTY;
  } catch {
    // A corrupt store starts the board empty instead of crashing.
    return EMPTY;
  }
}

export function getSnapshot(): Task[] {
  const stored =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(STORAGE_KEY);
  if (stored !== cachedRaw) {
    cachedRaw = stored;
    cachedTasks = parse(stored);
  }
  return cachedTasks;
}

export function getServerSnapshot(): Task[] {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateTasks(next: Task[]): void {
  const raw = JSON.stringify(next);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedTasks = next;
  for (const listener of listeners) {
    listener();
  }
}
