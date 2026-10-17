"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BOARD_FILENAME, exportBoard } from "@/lib/exportBoard";
import { parseBoard } from "@/lib/importBoard";
import {
  DEFAULT_FILTERS,
  DEFAULT_PRIORITY,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  advanceTask,
  clearDone,
  clearDueDate,
  compareTasks,
  createTask,
  deleteTask,
  dueDateLabel,
  filterTasks,
  hasActiveFilters,
  hiddenDoneCount,
  isOverdue,
  overdueCount,
  renameTask,
  restoreTasks,
  retreatTask,
  setDueDate,
  taskCounts,
  taskPriority,
  taskSummary,
  visibleDoneTasks,
  type Task,
  type TaskFilters,
  type TaskPriority,
  type TaskPriorityFilter,
  type TaskStatusFilter,
} from "@/lib/tasks";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  updateTasks,
} from "@/lib/taskStore";

export default function Home() {
  const tasks = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_PRIORITY);
  const [newDueDate, setNewDueDate] = useState("");
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);
  const [undoable, setUndoable] = useState<PendingUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoButtonRef = useRef<HTMLButtonElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<Task[] | null>(null);
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const importNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A destructive action moves focus onto the Undo button, so a keyboard user
  // can undo it without tabbing back from the top of the page.
  useEffect(() => {
    if (undoable) undoButtonRef.current?.focus();
  }, [undoable]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (importNoticeTimer.current) clearTimeout(importNoticeTimer.current);
    },
    [],
  );

  const filteredTasks = filterTasks(tasks, filters);
  const counts = taskCounts(filteredTasks);
  const storedCounts = taskCounts(tasks);
  const hiddenDone = hiddenDoneCount(tasks, filters);
  const filtering = hasActiveFilters(filters);
  const overdue = overdueCount(tasks);

  const clearDoneDisabled = storedCounts.done === 0 || hiddenDone > 0;
  const clearDoneTitle =
    storedCounts.done === 0
      ? "No done tasks to clear"
      : hiddenDone > 0
        ? "The active filters hide done tasks, so Clear done is unavailable"
        : "Delete every done task";

  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTasks([
      ...tasks,
      createTask(trimmed, { priority, dueDate: newDueDate || undefined }),
    ]);
    setTitle("");
    setPriority(DEFAULT_PRIORITY);
    setNewDueDate("");
  };

  // A destructive action arms one undo notice. A later action replaces it, so
  // only the most recent deletion or clear can be brought back.
  const armUndo = (pending: PendingUndo) => {
    setUndoable(pending);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setUndoable(null);
    }, UNDO_TIMEOUT_MS);
  };

  const deleteTaskWithUndo = (task: Task) => {
    updateTasks(deleteTask(tasks, task.id));
    armUndo({
      tasks: [task],
      message: "Task deleted",
      label: `Undo delete of "${task.title}"`,
    });
  };

  // Clearing holds every task it removed so one click puts them all back. The
  // button is disabled whenever a filter hides done work, so the count is what
  // the user can see.
  const clearDoneWithUndo = () => {
    const cleared = visibleDoneTasks(tasks, filters);
    if (cleared.length === 0) return;
    updateTasks(clearDone(tasks, filters));
    const count =
      cleared.length === 1 ? "1 done task" : `${cleared.length} done tasks`;
    armUndo({
      tasks: cleared,
      message: `Cleared ${count}`,
      label: `Undo clearing ${count}`,
    });
  };

  const undoLastAction = () => {
    if (!undoable) return;
    updateTasks(restoreTasks(tasks, undoable.tasks));
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoable(null);
  };

  const downloadBoard = () => {
    const blob = new Blob([exportBoard(tasks)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = BOARD_FILENAME;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoke on the next tick so the click's navigation can start reading the
    // blob first (revoking immediately can cancel the download in Firefox).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // Import notices are transient: they clear themselves so the board returns to
  // normal after a few seconds, and a new import clears the previous one.
  const clearImportNotice = () => {
    if (importNoticeTimer.current) clearTimeout(importNoticeTimer.current);
    importNoticeTimer.current = null;
    setImportNotice(null);
  };

  const showImportNotice = (notice: ImportNotice) => {
    setImportNotice(notice);
    if (importNoticeTimer.current) clearTimeout(importNoticeTimer.current);
    importNoticeTimer.current = setTimeout(() => {
      importNoticeTimer.current = null;
      setImportNotice(null);
    }, NOTICE_TIMEOUT_MS);
  };

  // Restoring a backup replaces the whole board. The filters are cleared so the
  // restored tasks are all visible, and any pending undo from the old board is
  // dropped because it no longer applies.
  const applyImportedTasks = (imported: Task[]) => {
    updateTasks(imported);
    setFilters(DEFAULT_FILTERS);
    setPendingImport(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoable(null);
    showImportNotice({
      kind: "success",
      message: `Imported ${taskCountLabel(imported.length)}.`,
    });
  };

  const importBoardFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    // Reset the input so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    // A fresh choice replaces any notice left over from the last one.
    clearImportNotice();

    let text: string;
    try {
      text = await file.text();
    } catch {
      showImportNotice({
        kind: "error",
        message: "That file could not be read.",
      });
      return;
    }

    const result = parseBoard(text);
    if (!result.ok) {
      setPendingImport(null);
      showImportNotice({ kind: "error", message: result.error });
      return;
    }

    // An empty board has nothing to lose, so it imports straight away. An
    // existing board is only replaced after a confirmation.
    if (tasks.length === 0) {
      applyImportedTasks(result.tasks);
      return;
    }
    setPendingImport(result.tasks);
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Taskboard
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            A small task board. Add a task, move it across the columns, and it is
            kept in your browser.
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {taskSummary(tasks)}
            {overdue > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                />
                {overdue} overdue
              </span>
            )}
          </p>
        </header>

        <div className="flex w-full flex-wrap items-center gap-3">
          <form
            onSubmit={addTask}
            className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:min-w-0 lg:flex-1"
          >
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs doing?"
              aria-label="New task title"
              className="h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-4 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 sm:w-auto sm:min-w-[12rem] sm:flex-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority)
              }
              aria-label="New task priority"
              className="h-11 shrink-0 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            >
              {TASK_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(event) => setNewDueDate(event.target.value)}
              aria-label="New task due date"
              title="Due date (optional)"
              className="h-11 shrink-0 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-zinc-900 px-5 font-medium whitespace-nowrap text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              disabled={!title.trim()}
            >
              Add task
            </button>
          </form>
          <button
            type="button"
            onClick={clearDoneWithUndo}
            disabled={clearDoneDisabled}
            title={clearDoneTitle}
            className="h-11 shrink-0 rounded-lg border border-zinc-300 px-4 font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear done
          </button>
          <button
            type="button"
            onClick={downloadBoard}
            className="h-11 shrink-0 rounded-lg border border-zinc-300 px-4 font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="h-11 shrink-0 rounded-lg border border-zinc-300 px-4 font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Import
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            onChange={importBoardFile}
            className="hidden"
            aria-label="Import a board file"
          />
        </div>

        <div
          role="group"
          aria-label="Filters"
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Filter
          </span>
          <FilterSelect
            label="Status"
            value={filters.status}
            options={STATUS_FILTER_OPTIONS}
            onChange={(status) => setFilters({ ...filters, status })}
          />
          <FilterSelect
            label="Priority"
            value={filters.priority}
            options={PRIORITY_FILTER_OPTIONS}
            onChange={(priority) => setFilters({ ...filters, priority })}
          />
          <button
            type="button"
            aria-pressed={filters.overdueOnly}
            onClick={() =>
              setFilters({ ...filters, overdueOnly: !filters.overdueOnly })
            }
            className={`h-9 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors ${
              filters.overdueOnly
                ? "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            Overdue only
          </button>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            disabled={!filtering}
            title={filtering ? "Clear every filter" : "No filters are active"}
            className="ml-auto h-9 shrink-0 rounded-lg border border-zinc-300 px-3 text-sm font-medium whitespace-nowrap text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear filters
          </button>
        </div>

        {filtering && filteredTasks.length === 0 && (
          <p
            role="status"
            className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          >
            No tasks match these filters.
          </p>
        )}

        <section className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-3">
          {TASK_STATUSES.map((status) => (
            <div
              key={status}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {STATUS_LABELS[status]}
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {counts[status]}
                </span>
              </h2>

              <ul className="flex flex-col gap-2">
                {filteredTasks
                  .filter((task) => task.status === status)
                  .sort(compareTasks)
                  .map((task) => (
                    <li
                      key={task.id}
                      className="group flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={taskPriority(task)} />
                        <TaskTitle
                          title={task.title}
                          onRename={(next) =>
                            updateTasks(renameTask(tasks, task.id, next))
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Move "${task.title}" back`}
                          onClick={() => updateTasks(retreatTask(tasks, task.id))}
                          disabled={status === "todo"}
                          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 disabled:invisible dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label={`Move "${task.title}" forward`}
                          onClick={() => updateTasks(advanceTask(tasks, task.id))}
                          disabled={status === "done"}
                          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 disabled:invisible dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete "${task.title}"`}
                          onClick={() => deleteTaskWithUndo(task)}
                          className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                      {task.dueDate && (
                        <DueDate
                          dueDate={task.dueDate}
                          overdue={isOverdue(task)}
                          onChange={(next) =>
                            updateTasks(setDueDate(tasks, task.id, next))
                          }
                          onClear={() =>
                            updateTasks(clearDueDate(tasks, task.id))
                          }
                        />
                      )}
                    </li>
                  ))}
                {counts[status] === 0 && (
                  <li className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                    {filtering ? "No matching tasks" : "Nothing here yet"}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </section>

        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-6"
        >
          {pendingImport && (
            <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white py-1.5 pr-1.5 pl-4 text-sm text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <span>
                Replace your board with {taskCountLabel(pendingImport.length)}{" "}
                from this file?
              </span>
              <button
                type="button"
                onClick={() => applyImportedTasks(pendingImport)}
                className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          )}
          {importNotice && (
            <div
              className={`pointer-events-auto rounded-full border px-4 py-1.5 text-sm shadow-lg ${
                importNotice.kind === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950 dark:text-red-300"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              {importNotice.message}
            </div>
          )}
          {undoable && (
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-zinc-200 bg-white py-1.5 pr-1.5 pl-4 text-sm text-zinc-700 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <span>{undoable.message}</span>
              <button
                ref={undoButtonRef}
                type="button"
                onClick={undoLastAction}
                aria-label={undoable.label}
                className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const UNDO_TIMEOUT_MS = 10_000;
const NOTICE_TIMEOUT_MS = 5_000;

// A destructive action waiting to be undone: the tasks to put back and the
// notice shown for it.
type PendingUndo = {
  tasks: Task[];
  message: string;
  label: string;
};

// A short-lived message about the last import: a rejection reason or the count
// of tasks that were restored.
type ImportNotice = {
  kind: "success" | "error";
  message: string;
};

function taskCountLabel(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

const STATUS_FILTER_OPTIONS: readonly {
  value: TaskStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  ...TASK_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
];

const PRIORITY_FILTER_OPTIONS: readonly {
  value: TaskPriorityFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "high", label: PRIORITY_LABELS.high },
  { value: "normal", label: PRIORITY_LABELS.normal },
  { value: "low", label: PRIORITY_LABELS.low },
];

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  normal: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[priority]}`}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function TaskTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const cancelled = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setDraft(title);
          setEditing(true);
        }}
        title="Click to rename"
        className="flex-1 break-words text-left text-sm text-zinc-800 dark:text-zinc-100"
      >
        {title}
      </button>
    );
  }

  return (
    <input
      value={draft}
      autoFocus
      aria-label="Edit task title"
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => {
        if (!cancelled.current) onRename(draft);
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancelled.current = true;
          setEditing(false);
        }
      }}
      className="h-8 min-w-0 flex-1 rounded border border-zinc-400 bg-white px-2 text-sm text-zinc-900 outline-none dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}

function DueDate({
  dueDate,
  overdue,
  onChange,
  onClear,
}: {
  dueDate: string;
  overdue: boolean;
  onChange: (dueDate: string) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setEditing(true);
        }}
        title="Click to change the due date"
        className={`inline-flex w-fit items-center gap-1.5 self-start rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
          overdue
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
        }`}
      >
        {overdue && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          />
        )}
        {dueDateLabel(dueDate)}
        {overdue && <span className="font-semibold">· Overdue</span>}
      </button>
    );
  }

  return (
    <input
      type="date"
      defaultValue={dueDate}
      autoFocus
      aria-label="Edit task due date"
      onBlur={(event) => {
        if (cancelled.current) {
          setEditing(false);
          return;
        }
        const value = event.currentTarget.value;
        if (!value) {
          onClear();
        } else if (value !== dueDate) {
          onChange(value);
        }
        setEditing(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          cancelled.current = true;
          setEditing(false);
        }
      }}
      className="h-8 w-fit self-start rounded border border-zinc-400 bg-white px-2 text-sm text-zinc-900 outline-none dark:border-zinc-500 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}
