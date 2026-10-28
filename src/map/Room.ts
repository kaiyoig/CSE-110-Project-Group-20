export interface RoomConfig {
  id: string;   //unique room id
  name: string; //display name
  assets?: Record<string, unknown>; //room assets (background art)
  prerequisites?: string[]; //locked room requirements
  problems?: unknown[]; //room problems
}

export class Room {
  public id: string;
  public name: string;
  public assets: Record<string, unknown>;
  public prerequisites: string[];
  public problems: unknown[];
  public isCompleted: boolean;  //tracks room completion state

  constructor({id, name, assets = {}, prerequisites = [], problems = [], }: RoomConfig) {
    this.id = id;
    this.name = name;
    this.assets = assets;
    this.prerequisites = prerequisites;
    this.problems = problems;
    this.isCompleted = false;
  }

  /**
   * Checks if room can be entered based on completed room IDs
   */
  public isAccessible(completedRoomIds: string[] = []) {
    if (this.prerequisites.length == 0) {
        return true;
    } else {
        return this.prerequisites.every((reqId) => completedRoomIds.includes(reqId));
    }
  }

  /**
   * Sets room as completed when problem(s) correctly solved
   */
  public setCompleted() {
    this.isCompleted = true;
  }

  
}