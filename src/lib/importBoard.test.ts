import { describe, expect, it } from "vitest";
import { exportBoard } from "./exportBoard";
import { parseBoard } from "./importBoard";
import { DEFAULT_PRIORITY, type Task } from "./tasks";

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Task ${id}`,
  status: "todo",
  priority: DEFAULT_PRIORITY,
  createdAt: 0,
  ...overrides,
});

describe("parseBoard", () => {
  it("reads an exported board with every field", () => {
    const tasks = [
      task("a", { status: "doing", priority: "high", dueDate: "2026-10-24" }),
      task("b", { status: "done", createdAt: 123 }),
    ];
    expect(parseBoard(exportBoard(tasks))).toEqual({ ok: true, tasks });
  });

  it("round trips an export back to the same tasks", () => {
    const tasks = [
      task("a", { status: "doing", priority: "low", dueDate: "2026-01-02" }),
      task("b", { status: "done", createdAt: 999 }),
      task("c"),
    ];
    const result = parseBoard(exportBoard(tasks));
    expect(result.ok && result.tasks).toEqual(tasks);
  });

  it("accepts an older export with no priority or due date", () => {
    const legacy = [
      { id: "a", title: "Old task", status: "todo", createdAt: 7 },
    ];
    expect(parseBoard(JSON.stringify(legacy))).toEqual({
      ok: true,
      tasks: [
        {
          id: "a",
          title: "Old task",
          status: "todo",
          priority: DEFAULT_PRIORITY,
          createdAt: 7,
        },
      ],
    });
  });

  it("parses an exported empty board", () => {
    expect(parseBoard(exportBoard([]))).toEqual({ ok: true, tasks: [] });
  });

  describe("rejects a file that is not one of our exports", () => {
    const badInputs: [string, string][] = [
      ["not JSON at all", "not json"],
      ["a blank file", ""],
      ["a JSON object", "{}"],
      ["a JSON string", '"hello"'],
      ["a JSON number", "42"],
      ["JSON null", "null"],
    ];
    it.each(badInputs)("%s", (_name, text) => {
      expect(parseBoard(text).ok).toBe(false);
    });
  });

  describe("rejects a task with an invalid field", () => {
    const cases: [string, unknown][] = [
      ["a task that is not an object", null],
      ["a missing id", { title: "x", status: "todo", createdAt: 0 }],
      ["an empty id", { id: "", title: "x", status: "todo", createdAt: 0 }],
      ["a non-string id", { id: 5, title: "x", status: "todo", createdAt: 0 }],
      ["a missing title", { id: "a", status: "todo", createdAt: 0 }],
      [
        "a blank title",
        { id: "a", title: "   ", status: "todo", createdAt: 0 },
      ],
      [
        "an unknown status",
        { id: "a", title: "x", status: "later", createdAt: 0 },
      ],
      [
        "an unknown priority",
        { id: "a", title: "x", status: "todo", priority: "urgent", createdAt: 0 },
      ],
      ["a missing creation time", { id: "a", title: "x", status: "todo" }],
      [
        "a string creation time",
        { id: "a", title: "x", status: "todo", createdAt: "0" },
      ],
      [
        "a null creation time",
        { id: "a", title: "x", status: "todo", createdAt: null },
      ],
      [
        "a malformed due date",
        { id: "a", title: "x", status: "todo", createdAt: 0, dueDate: "tomorrow" },
      ],
      [
        "an impossible due date",
        { id: "a", title: "x", status: "todo", createdAt: 0, dueDate: "2026-13-45" },
      ],
    ];
    it.each(cases)("%s", (_name, entry) => {
      expect(parseBoard(JSON.stringify([entry])).ok).toBe(false);
    });
  });

  it("rejects the whole file when one task is bad, importing nothing", () => {
    const bad = { id: "b", title: "x", status: "later", createdAt: 0 };
    expect(parseBoard(JSON.stringify([task("a"), bad])).ok).toBe(false);
  });

  it("rejects two tasks with the same id", () => {
    const file = JSON.stringify([task("a"), { ...task("a"), title: "Other" }]);
    expect(parseBoard(file)).toEqual({
      ok: false,
      error: 'That file has two tasks with the same id "a".',
    });
  });
});
