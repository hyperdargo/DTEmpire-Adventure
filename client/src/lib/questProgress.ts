export interface QuestProgress {
  claimed: boolean;
  done: number;
  need: number;
}

/** Count only unclaimed rewards whose objectives are complete. */
export function readyQuestCount(tasks: readonly QuestProgress[]): number {
  return tasks.filter((task) => !task.claimed && task.need > 0 && task.done >= task.need).length;
}
