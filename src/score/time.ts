/** Small helpers so time values can be written in the unit that reads best. */

export const MS_PER_SECOND = 1000;

export function secondsToMs(seconds: number): number {
  return seconds * MS_PER_SECOND;
}

export function minutesToMs(minutes: number): number {
  return secondsToMs(minutes * 60);
}

export function hoursToMs(hours: number): number {
  return minutesToMs(hours * 60);
}

/** Whole seconds in a duration, rounded down (10_500 ms → 10). */
export function msToWholeSeconds(ms: number): number {
  return Math.floor(ms / MS_PER_SECOND);
}
