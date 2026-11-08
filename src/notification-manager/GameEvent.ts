import type { RoomKind } from "../score/ScoreModel";

// new event types should be added here
export enum EventType {
  Correct = "correct",
  Incorrect = "incorrect",
  GameStart = "gameStart",
  GameOver = "gameOver",
  /** The player went into a Room (the clock starts). */
  RoomEntered = "roomEntered",
  /** The player went back to the map (the clock pauses). */
  ReturnedToMap = "returnedToMap",
  /** The last Step of a Room was answered correctly. */
  RoomSolved = "roomSolved",
}

/** RoomSolved says which kind of Room was solved; every other event has no data. */
export type GameEvent =
  | { eventType: EventType.RoomSolved; roomKind: RoomKind }
  | { eventType: Exclude<EventType, EventType.RoomSolved> };
