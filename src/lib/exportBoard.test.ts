import { describe, expect, it } from "vitest";
import { BOARD_FILENAME, exportBoard } from "./exportBoard";
import { DEFAULT_PRIORITY, type Task } from "./tasks";

const task = (id: string, status: Task["status"] = "todo"): Task => ({
  id,
  title: `Task ${id}`,
  status,
  priority: DEFAULT_PRIORITY,
  createdAt: 0,
});

describe("exportBoard", () => {
  it("names the downloaded file", () => {
    expect(BOARD_FILENAME).toBe("taskboard.json");
  });

  it("produces valid JSON holding every task with all its fields", () => {
    const tasks: Task[] = [
      task("a"),
      {
        id: "b",
        title: "Ship it",
        status: "done",
        priority: "high",
        createdAt: 123,
      },
    ];
    const parsed = JSON.parse(exportBoard(tasks));
    expect(parsed).toEqual(tasks);
  });

  it("serialises an empty board as an empty array", () => {
    expect(JSON.parse(exportBoard([]))).toEqual([]);
  });
});
