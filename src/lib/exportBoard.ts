import type { Task } from "./tasks";

export const BOARD_FILENAME = "taskboard.json";

// Serialises the board to JSON so it can be downloaded as a backup. Every
// task is written out with all of its fields.
export function exportBoard(tasks: readonly Task[]): string {
  return JSON.stringify(tasks, null, 2);
}
