import type { Room } from "./Room";

export interface PlacedRoom {
    room: Room;
    row: number;
    column: number;
    colSpan: number;
    rowSpan: number;
}

export class MapGrid {
    public readonly rows: number;
    public readonly columns: number;
    private tiles: (Room | null)[][];   //tiles[row][col] holds a Room instance or null if empty
    private placedRooms: PlacedRoom[] = [];

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
    public placeRoom(room: Room, row: number, column: number, colSpan: number = 1, rowSpan: number = 1) {
        if (!this.isValidPlacement(row, column, colSpan, rowSpan)) {
            throw new Error("Invalid room placement");
        }
        for (let i = row; i < row + rowSpan; i++) {
            for (let j = column; j < column + colSpan; j++) {
                this.tiles[i][j] = room;
            }
        }
        this.placedRooms.push({ room, row, column, colSpan, rowSpan });
    }

    // Checks whether room can be placed at (row, column)
    public isValidPlacement(row: number, column: number, colSpan: number = 1, rowSpan: number = 1): boolean {
        //check whether coordinates are within grid dimensions
        if (row < 0 || row + rowSpan > this.rows || column < 0 || column + colSpan > this.columns) {
            return false;
        }

        //check whether tile is occupied
        for (let i = row; i < row + rowSpan; i++) {
            for (let j = column; j < column + colSpan; j++) {
                if (this.tiles[i][j] !== null) {
                return false;
                }
            }
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
        return [...this.placedRooms];
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