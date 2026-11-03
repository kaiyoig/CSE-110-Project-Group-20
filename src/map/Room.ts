import type { Question } from "../questions/Question";
import type { RoomKind } from "../score";

export interface RoomConfig {
  id: string;   // unique room id
  name: string; // display name
  question: Question; // the Room's Question, generated once per Heist
  kind?: RoomKind; // "main" (default) or "bonus"
  assets?: Record<string, unknown>; // room assets (background art)
  prerequisites?: string[]; // ids of Rooms that must be Solved first
}

/**
 * A Room on the map. Solved state is not stored here: it lives only in
 * MapController (`solvedRooms`), which passes it in where needed.
 */
export class Room {
  public readonly id: string;
  public readonly name: string;
  public readonly question: Question;
  public readonly kind: RoomKind;
  public readonly assets: Record<string, unknown>;
  public readonly prerequisites: string[];

  constructor({ id, name, question, kind = "main", assets = {}, prerequisites = [] }: RoomConfig) {
    this.id = id;
    this.name = name;
    this.question = question;
    this.kind = kind;
    this.assets = assets;
    this.prerequisites = prerequisites;
  }

  /** True when every prerequisite is in `solvedRoomIds`. */
  public isAccessible(solvedRoomIds: Iterable<string> = []): boolean {
    return this.getMissingPrerequisites(solvedRoomIds).length === 0;
  }

  /** The prerequisite ids that are not in `solvedRoomIds`, in order. */
  public getMissingPrerequisites(solvedRoomIds: Iterable<string> = []): string[] {
    const solved = new Set(solvedRoomIds);
    return this.prerequisites.filter((reqId) => !solved.has(reqId));
  }
}
