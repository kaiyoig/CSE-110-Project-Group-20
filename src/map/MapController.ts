import { Room } from "./Room";
import type { ScoreController } from "../score";

export interface SwitchMapScreen {
  screen: string;
  room: Room | null;
  name: string;
}

export interface AccessDeniedPayload {
  roomId: string;
  roomName: string;
  missingPrerequisiteIds: string[];
  missingPrerequisiteNames: string[];
}

/**
 * Tracks which Room the player is in and which Rooms are Solved, and gates
 * entry by prerequisites. It starts and pauses the clock itself through the
 * ScoreController. Game connects `onScreenChange` / `onAccessDenied` to the
 * screens and decides when the Heist ends.
 */
export class MapController {
  private readonly rooms: Map<string, Room> = new Map();
  private readonly solved: Set<string> = new Set();
  public currentScreen: string = "map";
  public activeRoom: Room | null = null;

  public onScreenChange: ((event: SwitchMapScreen) => void) | null = null;
  public onAccessDenied: ((payload: AccessDeniedPayload) => void) | null = null;

  constructor(private readonly score: ScoreController) {}

  /** Ids of the Solved Rooms. */
  public get solvedRooms(): ReadonlySet<string> {
    return this.solved;
  }

  public registerRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  /** Marks a registered Room as Solved. */
  public solveRoom(roomId: string): void {
    if (this.rooms.has(roomId)) {
      this.solved.add(roomId);
    }
  }

  /** Marks the Vault as Solved. Ending the Heist is up to Game. */
  public solveVault(vaultId: string = "vault"): void {
    this.solveRoom(vaultId);
  }

  /**
   * Called when the player clicks a Room. Enters it (and starts the clock)
   * when it is accessible and not Solved yet. A locked Room fires
   * `onAccessDenied` instead. Returns whether the Room was entered.
   */
  public clickRoomButton(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }

    // A Solved Room can't be entered again.
    if (this.solved.has(roomId)) {
      return false;
    }

    if (room.isAccessible(this.solved)) {
      this.currentScreen = room.id;
      this.activeRoom = room;
      this.score.enterRoom();
      this.onScreenChange?.({
        screen: room.id,
        room: room,
        name: room.name,
      });
      return true;
    }

    if (this.onAccessDenied) {
      const missingIds = room.getMissingPrerequisites(this.solved);
      const missingNames = missingIds.map((id) => this.rooms.get(id)?.name || id);
      this.onAccessDenied({
        roomId: room.id,
        roomName: room.name,
        missingPrerequisiteIds: missingIds,
        missingPrerequisiteNames: missingNames,
      });
    }
    return false;
  }

  /** Called when the player leaves a Room. Pauses the clock. */
  public returnToMap(): void {
    this.currentScreen = "map";
    this.activeRoom = null;
    this.score.returnToMap();
    this.onScreenChange?.({
      screen: "map",
      room: null,
      name: "Map",
    });
  }
}
