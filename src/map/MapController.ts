import { Room } from "./Room";

export interface SwitchMapScreen {
    screen: string;
    room: Room | null;
    name: string;
}

export class MapController {
  private rooms: Map<string, Room> = new Map();
  public currentScreen: string = 'map';
  public activeRoom: Room | null = null;
  public completedRooms: Set<string> = new Set();

  /**
   * Placeholder implementation
   * Use ScreenController to manage screen switching in the future
   * MapController will emit navigation requests for ScreenController to receive
  */
  public onScreenChange: ((event: SwitchMapScreen) => void) | null = null;
  public onAccessDenied: ((roomId: string) => void) | null = null;

  public registerRoom(room: Room): void {
    this.rooms.set(room.id, room);
  }

  // Called when room problem(s) correctly answered
  public completeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.setCompleted();
      this.completedRooms.add(roomId);
    }
  }

  // Called when player completed the vault; finishes game and switches to results screen
  public completeVault(vaultId: string = 'vault'): void {
    const vault = this.rooms.get(vaultId);
    if (vault) {
      vault.setCompleted();
      this.completedRooms.add(vaultId);
    }

    // Use ScreenController to update screen state to results
    this.currentScreen = 'results';
    this.activeRoom = null;

    if (this.onScreenChange) {
      this.onScreenChange({
        screen: 'results',
        room: vault || null,
        name: 'Results',
      });
    }
    
  }

  // Called when player presses on a room button
  public clickRoomButton(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
        return false;
    }

    const canEnter = room.isAccessible(Array.from(this.completedRooms));

    if (canEnter) {
        this.currentScreen = room.id;
        this.activeRoom = room;

        // Call score.enterRoom() here

        // Use ScreenController here
        if(this.onScreenChange) {
            this.onScreenChange({
                screen: room.id,
                room: room,
                name: room.name,
            });
        }

        return true;
    }

    if (this.onAccessDenied) {
      this.onAccessDenied(room.id);
    }
    return false;
  }

  // Called when player exits a room and returns to the map screen
  public returnToMap(): void {
    this.currentScreen = 'map';
    this.activeRoom = null;

    // Call score.returnToMap() here

    // Use ScreenController here
    if (this.onScreenChange) {
      this.onScreenChange({
        screen: 'map',
        room: null,
        name: 'Map',
      });
    }
  }

}