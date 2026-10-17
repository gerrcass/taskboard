import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIORITY,
  advanceTask,
  clearDone,
  clearDueDate,
  compareTasks,
  createTask,
  deleteTask,
  dueDateLabel,
  isOverdue,
  moveTask,
  renameTask,
  retreatTask,
  setDueDate,
  taskCounts,
  taskPriority,
  taskSummary,
  type Task,
} from "./tasks";

const task = (id: string, status: Task["status"] = "todo"): Task => ({
  id,
  title: `Task ${id}`,
  status,
  priority: DEFAULT_PRIORITY,
  createdAt: 0,
});

describe("createTask", () => {
  it("trims the title, starts in todo and defaults to normal priority", () => {
    const created = createTask("  Ship the demo  ", { id: "a", now: 42 });
    expect(created).toEqual({
      id: "a",
      title: "Ship the demo",
      status: "todo",
      priority: "normal",
      createdAt: 42,
    });
  });

  it("keeps an explicit priority", () => {
    const created = createTask("Ship the demo", {
      id: "a",
      now: 42,
      priority: "high",
    });
    expect(created.priority).toBe("high");
  });

  it("keeps a due date when one is given", () => {
    const created = createTask("Ship the demo", {
      id: "a",
      now: 42,
      dueDate: "2026-10-24",
    });
    expect(created.dueDate).toBe("2026-10-24");
  });

  it("leaves the due date off when none is given", () => {
    const created = createTask("Ship the demo", { id: "a", now: 42 });
    expect(created.dueDate).toBeUndefined();
  });

  it("rejects an empty title", () => {
    expect(() => createTask("   ")).toThrow("A task needs a title");
  });
});

describe("setDueDate", () => {
  it("sets a due date on only the named task", () => {
    const tasks = [task("a"), task("b")];
    const updated = setDueDate(tasks, "a", "2026-10-24");
    expect(updated[0].dueDate).toBe("2026-10-24");
    expect(updated[1].dueDate).toBeUndefined();
  });

  it("returns the same array when the date is unchanged or the id is unknown", () => {
    const tasks = [{ ...task("a"), dueDate: "2026-10-24" }];
    expect(setDueDate(tasks, "a", "2026-10-24")).toBe(tasks);
    expect(setDueDate(tasks, "missing", "2026-11-01")).toBe(tasks);
    expect(setDueDate(tasks, "a", "")).toBe(tasks);
  });
});

describe("clearDueDate", () => {
  it("removes the due date from only the named task", () => {
    const tasks = [
      { ...task("a"), dueDate: "2026-10-24" },
      { ...task("b"), dueDate: "2026-11-01" },
    ];
    const cleared = clearDueDate(tasks, "a");
    expect(cleared[0].dueDate).toBeUndefined();
    expect(cleared[1].dueDate).toBe("2026-11-01");
  });

  it("returns the same array when there is nothing to clear", () => {
    const tasks = [task("a")];
    expect(clearDueDate(tasks, "a")).toBe(tasks);
    expect(clearDueDate(tasks, "missing")).toBe(tasks);
  });
});

describe("isOverdue", () => {
  // Fixed local time: Saturday 17 October 2026.
  const now = new Date(2026, 9, 17, 12).getTime();

  it("is false without a due date", () => {
    expect(isOverdue(task("a"), now)).toBe(false);
  });

  it("is false on and before the due day", () => {
    expect(isOverdue({ ...task("a"), dueDate: "2026-10-17" }, now)).toBe(false);
    expect(isOverdue({ ...task("a"), dueDate: "2026-10-24" }, now)).toBe(false);
  });

  it("is true once the due day has passed", () => {
    expect(isOverdue({ ...task("a"), dueDate: "2026-10-16" }, now)).toBe(true);
  });

  it("is false for a done task even after its due date", () => {
    expect(
      isOverdue({ ...task("a", "done"), dueDate: "2026-10-16" }, now),
    ).toBe(false);
  });
});

describe("dueDateLabel", () => {
  it("reads the stored date as a short plain-language label", () => {
    expect(dueDateLabel("2026-10-24")).toBe("Due Oct 24");
    expect(dueDateLabel("2026-01-05")).toBe("Due Jan 5");
  });
});

describe("taskPriority", () => {
  it("returns the task's priority", () => {
    expect(taskPriority({ ...task("a"), priority: "low" })).toBe("low");
  });

  it("falls back to normal for tasks stored before priorities existed", () => {
    const legacy = {
      id: "a",
      title: "Task a",
      status: "todo",
      createdAt: 0,
    } as Task;
    expect(taskPriority(legacy)).toBe("normal");
  });
});

describe("compareTasks", () => {
  const ordered = (id: string, overrides: Partial<Task> = {}): Task => ({
    ...task(id),
    ...overrides,
  });

  it("puts higher priority first regardless of due date or age", () => {
    const tasks = [
      ordered("low", { priority: "low" }),
      ordered("normal", { priority: "normal" }),
      ordered("high", { priority: "high" }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "high",
      "normal",
      "low",
    ]);
  });

  it("sorts by nearest due date within a priority", () => {
    const tasks = [
      ordered("later", { priority: "normal", dueDate: "2026-11-10" }),
      ordered("sooner", { priority: "normal", dueDate: "2026-10-20" }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "sooner",
      "later",
    ]);
  });

  it("puts tasks without a due date after dated ones in the same priority", () => {
    const tasks = [
      ordered("undated", { priority: "normal" }),
      ordered("dated", { priority: "normal", dueDate: "2026-10-20" }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "dated",
      "undated",
    ]);
  });

  it("falls back to oldest first when priority and due date match", () => {
    const tasks = [
      ordered("newer", { priority: "low", createdAt: 2 }),
      ordered("older", { priority: "low", createdAt: 1 }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "older",
      "newer",
    ]);
  });

  it("treats tasks stored before priorities existed as normal", () => {
    const legacy = {
      id: "legacy",
      title: "Legacy",
      status: "todo",
      createdAt: 0,
    } as Task;
    const tasks = [
      legacy,
      ordered("high", { priority: "high" }),
      ordered("low", { priority: "low" }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "high",
      "legacy",
      "low",
    ]);
  });

  it("breaks a full tie by id so the result does not depend on input order", () => {
    const a = ordered("a");
    const b = ordered("b");
    const c = ordered("c");
    expect([c, a, b].sort(compareTasks).map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect([b, c, a].sort(compareTasks).map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("orders a mixed list priority first, then due date, then age", () => {
    const tasks = [
      ordered("low-undated", { priority: "low", createdAt: 1 }),
      ordered("normal-later", {
        priority: "normal",
        dueDate: "2026-11-10",
        createdAt: 2,
      }),
      ordered("high-later", {
        priority: "high",
        dueDate: "2026-10-30",
        createdAt: 3,
      }),
      ordered("high-sooner", {
        priority: "high",
        dueDate: "2026-10-20",
        createdAt: 4,
      }),
      ordered("normal-undated", { priority: "normal", createdAt: 5 }),
    ];
    expect(tasks.sort(compareTasks).map((t) => t.id)).toEqual([
      "high-sooner",
      "high-later",
      "normal-later",
      "normal-undated",
      "low-undated",
    ]);
  });
});

describe("moveTask", () => {
  it("changes the status of only the named task", () => {
    const tasks = [task("a"), task("b")];
    const moved = moveTask(tasks, "a", "doing");
    expect(moved[0].status).toBe("doing");
    expect(moved[1].status).toBe("todo");
  });

  it("returns the same array when nothing changes", () => {
    const tasks = [task("a")];
    expect(moveTask(tasks, "a", "todo")).toBe(tasks);
    expect(moveTask(tasks, "missing", "done")).toBe(tasks);
  });
});

describe("advanceTask", () => {
  it("walks a task from todo to doing to done and then stops", () => {
    let tasks = [task("a")];
    tasks = advanceTask(tasks, "a");
    expect(tasks[0].status).toBe("doing");
    tasks = advanceTask(tasks, "a");
    expect(tasks[0].status).toBe("done");
    const finished = advanceTask(tasks, "a");
    expect(finished).toBe(tasks);
  });
});

describe("retreatTask", () => {
  it("walks a task one step back, but not past todo", () => {
    let tasks = [task("a", "done")];
    tasks = retreatTask(tasks, "a");
    expect(tasks[0].status).toBe("doing");
    tasks = retreatTask(tasks, "a");
    expect(tasks[0].status).toBe("todo");
    expect(retreatTask(tasks, "a")).toBe(tasks);
  });
});

describe("renameTask", () => {
  it("renames only the named task and trims the title", () => {
    const tasks = [task("a"), task("b")];
    const renamed = renameTask(tasks, "a", "  New title  ");
    expect(renamed[0].title).toBe("New title");
    expect(renamed[1].title).toBe("Task b");
  });

  it("keeps the old title when the new one is blank", () => {
    const tasks = [task("a")];
    expect(renameTask(tasks, "a", "   ")).toBe(tasks);
    expect(renameTask(tasks, "a", "")).toBe(tasks);
  });

  it("returns the same array when nothing changes", () => {
    const tasks = [task("a")];
    expect(renameTask(tasks, "a", "Task a")).toBe(tasks);
    expect(renameTask(tasks, "missing", "New title")).toBe(tasks);
  });
});

describe("deleteTask", () => {
  it("removes the task and leaves the rest alone", () => {
    const tasks = [task("a"), task("b")];
    expect(deleteTask(tasks, "a").map((t) => t.id)).toEqual(["b"]);
  });

  it("returns the same array for an unknown id", () => {
    const tasks = [task("a")];
    expect(deleteTask(tasks, "nope")).toBe(tasks);
  });
});

describe("clearDone", () => {
  it("removes every done task and leaves the others alone", () => {
    const tasks = [task("a"), task("b", "doing"), task("c", "done"), task("d", "done")];
    expect(clearDone(tasks).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("returns the same array when nothing is done", () => {
    const tasks = [task("a"), task("b", "doing")];
    expect(clearDone(tasks)).toBe(tasks);
  });

  it("returns an empty board when everything is done", () => {
    expect(clearDone([task("a", "done")])).toEqual([]);
  });
});

describe("taskCounts", () => {
  it("counts tasks per column", () => {
    const tasks = [task("a"), task("b", "doing"), task("c", "done"), task("d", "done")];
    expect(taskCounts(tasks)).toEqual({ todo: 1, doing: 1, done: 2 });
  });
});

describe("taskSummary", () => {
  it("summarises the total and how many are done", () => {
    const tasks = [task("a"), task("b", "doing"), task("c", "done"), task("d", "done")];
    expect(taskSummary(tasks)).toBe("4 tasks · 2 done");
  });

  it("uses the singular for a single task", () => {
    expect(taskSummary([task("a")])).toBe("1 task · 0 done");
  });

  it("shows a friendly message when the board is empty", () => {
    expect(taskSummary([])).toBe("No tasks yet — add one to get started");
  });
});
