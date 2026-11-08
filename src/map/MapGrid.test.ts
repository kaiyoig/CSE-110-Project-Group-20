import { describe, test, expect, beforeEach } from 'vitest';
import { MapGrid } from './MapGrid';
import { Room } from './Room';

describe("MapGrid Tests", () => {
  let grid: MapGrid;
  let roomA: Room;
  let roomB: Room;
  let vault: Room;

  beforeEach(() => {
    grid = new MapGrid(2, 3);

    roomA = new Room({
      id: "room_a",
      name: "Room A",
      question: {} as any,
    });

    roomB = new Room({
      id: "room_b",
      name: "Room B",
      question: {} as any,
    });

    vault = new Room({
      id: "vault",
      name: "Vault",
      prerequisites: ["room_a", "room_b"],
      question: {} as any,
    });
  });

  //grid initialization tests
  test("grid initializes with given dimensions and all entries are null", () => {
    expect(grid.rows).toBe(2);
    expect(grid.columns).toBe(3);

    for (let i = 0; i < grid.rows; i++) {
        for (let j = 0; j < grid.columns; j++) {
            expect(grid.getRoomAt(i, j)).toBeNull();
        }
    }
  });

  test("throws an error when initialized with invalid dimensions", () => {
    expect(() => new MapGrid(0, 1)).toThrow("Invalid grid dimensions");
    expect(() => new MapGrid(1, 0)).toThrow("Invalid grid dimensions");
    expect(() => new MapGrid(-1, -1)).toThrow("Invalid grid dimensions");
  });

  //isValidPlacement tests
  test("isValidPlacement returns true for valid placements", () => {
    expect(grid.isValidPlacement(0, 0)).toBe(true);
    expect(grid.isValidPlacement(1, 2)).toBe(true);
  });

  test("isValidPlacement returns false for invalid coordinates", () => {
    expect(grid.isValidPlacement(-1, 0)).toBe(false);
    expect(grid.isValidPlacement(0, -1)).toBe(false);
    expect(grid.isValidPlacement(2, 0)).toBe(false); // row index 2 is out of range for 2 rows
    expect(grid.isValidPlacement(0, 3)).toBe(false); // column index 3 is out of range for 3 columns
    expect(grid.isValidPlacement(5, 5)).toBe(false);
  });

  test("isValidPlacement returns false for occupied coordinates", () => {
    grid.placeRoom(roomA, 1, 0);
    expect(grid.isValidPlacement(1, 0)).toBe(false);
  });

  //placeRoom tests
  test("room is placed at valid coordinates", () => {
    grid.placeRoom(roomA, 0, 0);
    expect(grid.getRoomAt(0, 0)).toBe(roomA);
  });

  test("throws an error when room is placed at an invalid coordinate", () => {
    expect(() => grid.placeRoom(roomA, -1, 0)).toThrow("Invalid room placement");
    expect(() => grid.placeRoom(roomA, 2, 1)).toThrow("Invalid room placement");
    expect(() => grid.placeRoom(roomA, 0, 3)).toThrow("Invalid room placement");
  }); 

  test("throws an error when room is placed at an occupied coordinate", () => {
    grid.placeRoom(roomA, 1, 0);
    expect(() => grid.placeRoom(roomA, 1, 0)).toThrow("Invalid room placement");
    expect(grid.getRoomAt(1, 0)).toBe(roomA);
  }); 

  //getRoomAt tests
  test("returns null for unoccupied valid coordinates", () => {
    expect(grid.getRoomAt(0, 0)).toBeNull();
  }); 

  test("returns null for invalid coordinates", () => {
    expect(grid.getRoomAt(-1, 0)).toBeNull();
    expect(grid.getRoomAt(0, -1)).toBeNull();
    expect(grid.getRoomAt(2, 0)).toBeNull();
    expect(grid.getRoomAt(0, 3)).toBeNull();
  }); 

  test("returns the room located at the specified coordinate", () => {
    grid.placeRoom(vault, 1, 2);
    expect(grid.getRoomAt(1, 2)).toBe(vault);
  }); 

  //getAllRooms tests
  test("returns an empty array when no rooms have been placed", () => {
    expect(grid.getAllRooms()).toEqual([]);
  }); 

  test("returns all placed rooms with their corresponding coordinates", () => {
    grid.placeRoom(roomA, 0, 0);
    grid.placeRoom(roomB, 0, 2);
    grid.placeRoom(vault, 1, 1);

    const allRooms = grid.getAllRooms();
    expect(allRooms).toHaveLength(3);
    expect(allRooms).toEqual([
    { room: roomA, row: 0, column: 0 },
    { room: roomB, row: 0, column: 2 },
    { room: vault, row: 1, column: 1 },
    ]);
  }); 

  //findRoomPosition tests
  test("returns the exact row an column of the specified room", () => {
    grid.placeRoom(roomA, 1, 2);
    const pos = grid.findRoomPosition("room_a");
    expect(pos).toEqual({ row: 1, column: 2 });
  });

  test("returns null if the room is not on the grid", () => {
    grid.placeRoom(roomA, 0, 0);
    expect(grid.findRoomPosition("vault")).toBeNull();
    expect(grid.findRoomPosition("non_existent_id")).toBeNull();
  });

});