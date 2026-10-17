import { describe, expect, it } from "vitest";
import {
  advanceTask,
  clearDone,
  createTask,
  deleteTask,
  moveTask,
  renameTask,
  retreatTask,
  taskCounts,
  taskSummary,
  type Task,
} from "./tasks";

const task = (id: string, status: Task["status"] = "todo"): Task => ({
  id,
  title: `Task ${id}`,
  status,
  createdAt: 0,
});

describe("createTask", () => {
  it("trims the title and starts in todo", () => {
    const created = createTask("  Ship the demo  ", { id: "a", now: 42 });
    expect(created).toEqual({
      id: "a",
      title: "Ship the demo",
      status: "todo",
      createdAt: 42,
    });
  });

  it("rejects an empty title", () => {
    expect(() => createTask("   ")).toThrow("A task needs a title");
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
