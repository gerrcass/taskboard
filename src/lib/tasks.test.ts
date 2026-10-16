import { describe, expect, it } from "vitest";
import {
  advanceTask,
  createTask,
  deleteTask,
  moveTask,
  retreatTask,
  taskCounts,
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

describe("taskCounts", () => {
  it("counts tasks per column", () => {
    const tasks = [task("a"), task("b", "doing"), task("c", "done"), task("d", "done")];
    expect(taskCounts(tasks)).toEqual({ todo: 1, doing: 1, done: 2 });
  });
});
