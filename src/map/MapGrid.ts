import type { Room } from "./Room";

export interface PlacedRoom {
    room: Room;
    row: number;
    column: number;
}

export class MapGrid {
    public readonly rows: number;
    public readonly columns: number;
    private tiles: (Room | null)[][];   //tiles[row][col] holds a Room instance or null if empty

    constructor (rows: number, columns: number) {
        if (rows <= 0 || columns <= 0) {
            throw new Error("Invalid grid dimensions");
        }

        this.rows = rows;
        this.columns = columns;
        this.tiles = Array.from({ length: rows }, () =>
            Array.from({ length: columns }, () => null)
        );
    }

    // Places room at (row, column) on the grid, given that placement is valid
    public placeRoom(room: Room, row: number, column: number) {
        if (!this.isValidPlacement(row, column)) {
            throw new Error("Invalid room placement");
        }
        this.tiles[row][column] = room;    
    }

    // Checks whether room can be placed at (row, column)
    public isValidPlacement(row: number, column: number): boolean {
        //check whether coordinates are within grid dimensions
        if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
            return false;
        }

        //check whether tile is occupied
        if (this.tiles[row][column] !== null) {
            return false;
        }

        //placement is valid
        return true;
    }

    // Retrieves the room at (row, column), returns null if out of bounds
    public getRoomAt(row: number, column: number): Room | null {
        if (row < 0 || row >= this.rows || column < 0 || column >= this.columns) {
            return null;
        }
        return this.tiles[row][column];
    }

    // Returns all placed rooms and their grid coordinates
    public getAllRooms(): PlacedRoom[]{
        const placed: PlacedRoom[] = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                const room = this.tiles[i][j];
                if (room !== null) {
                    placed.push({room, row: i, column: j});
                }
            }
        }
        return placed;
    }

    // Returns a room's coordinates given the room id
    public findRoomPosition(roomId: string): {row: number, column: number} | null {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                const room = this.tiles[i][j];
                if (room?.id === roomId) {
                    return {row: i, column: j};
                }
            }
        }
        return null;
    }
}