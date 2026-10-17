"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  advanceTask,
  clearDone,
  createTask,
  deleteTask,
  renameTask,
  retreatTask,
  taskCounts,
  taskSummary,
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

  const counts = taskCounts(tasks);

  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    updateTasks([...tasks, createTask(trimmed)]);
    setTitle("");
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
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {taskSummary(tasks)}
          </p>
        </header>

        <div className="flex w-full max-w-xl items-center gap-3">
          <form onSubmit={addTask} className="flex flex-1 gap-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What needs doing?"
              aria-label="New task title"
              className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400"
            />
            <button
              type="submit"
              className="h-11 rounded-lg bg-zinc-900 px-5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              disabled={!title.trim()}
            >
              Add task
            </button>
          </form>
          <button
            type="button"
            onClick={() => updateTasks(clearDone(tasks))}
            disabled={counts.done === 0}
            className="h-11 rounded-lg border border-zinc-300 px-4 font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Clear done
          </button>
        </div>

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
                {tasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <li
                      key={task.id}
                      className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
                    >
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
                        onClick={() => updateTasks(deleteTask(tasks, task.id))}
                        className="rounded px-1.5 py-0.5 text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 dark:hover:text-red-400"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                {counts[status] === 0 && (
                  <li className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                    Nothing here yet
                  </li>
                )}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
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

