import { describe, test, expect, beforeEach } from 'vitest';
import { MapGrid } from './MapGrid';
import { Room } from './Room';

describe('MapGrid Tests', () => {
  let grid: MapGrid;
  let roomA: Room;
  let roomB: Room;
  let vault: Room;

  beforeEach(() => {
    grid = new MapGrid(2, 3);

    roomA = new Room({
      id: 'room_a',
      name: 'Room A',
      question: {} as any,
    });

    roomB = new Room({
      id: 'room_b',
      name: 'Room B',
      question: {} as any,
    });

    vault = new Room({
      id: 'vault',
      name: 'Vault',
      prerequisites: ['room_a', 'room_b'],
      question: {} as any,
    });
  });

  //grid initialization tests
  test('grid initializes with given dimensions and all entries are null', () => {
    expect(grid.rows).toBe(2);
    expect(grid.columns).toBe(3);

    for (let i = 0; i < grid.rows; i++) {
        for (let j = 0; j < grid.columns; j++) {
            expect(grid.getRoomAt(i, j)).toBeNull();
        }
    }
  });

  test('throws an error when initialized with invalid dimensions', () => {
    expect(() => new MapGrid(0, 1)).toThrow('Invalid grid dimensions');
    expect(() => new MapGrid(1, 0)).toThrow('Invalid grid dimensions');
    expect(() => new MapGrid(-1, -1)).toThrow('Invalid grid dimensions');
  });

  //isValidPlacement tests
  test('isValidPlacement returns true for valid placements', () => {
    expect(grid.isValidPlacement(0, 0)).toBe(true);
    expect(grid.isValidPlacement(1, 2)).toBe(true);
    expect(grid.isValidPlacement(0, 0, 2, 1)).toBe(true); // 2-wide span
    expect(grid.isValidPlacement(0, 2, 1, 2)).toBe(true); // 2-tall span
  });

  test('isValidPlacement returns false for invalid coordinates and out-of-bound spans', () => {
    expect(grid.isValidPlacement(-1, 0)).toBe(false);
    expect(grid.isValidPlacement(0, -1)).toBe(false);
    expect(grid.isValidPlacement(2, 0)).toBe(false); // row index 2 is out of range for 2 rows
    expect(grid.isValidPlacement(0, 3)).toBe(false); // column index 3 is out of range for 3 columns
    expect(grid.isValidPlacement(5, 5)).toBe(false);
    expect(grid.isValidPlacement(0, 2, 2, 1)).toBe(false); // 2-wide starting at col 2 overflows col 3
    expect(grid.isValidPlacement(2, 0, 1, 2)).toBe(false); // 2-tall starting at row 2 overflows row 3
  });

  test('isValidPlacement returns false for occupied coordinates', () => {
    grid.placeRoom(roomA, 0, 1);
    expect(grid.isValidPlacement(0, 1)).toBe(false);
    expect(grid.isValidPlacement(0, 0, 2, 1)).toBe(false); // spanning room starting at (0, 0) with colSpan 2 collides with (0, 1)
  });

  //placeRoom tests
  test('room is placed at valid coordinates and occupies all spanned entries', () => {
    grid.placeRoom(roomA, 1, 0, 2, 1);
    expect(grid.getRoomAt(1, 0)).toBe(roomA);
    expect(grid.getRoomAt(1, 1)).toBe(roomA);
    expect(grid.getRoomAt(1, 2)).toBeNull();
  });

  test('throws an error when room is placed at an invalid coordinate or overflows', () => {
    expect(() => grid.placeRoom(roomA, -1, 0)).toThrow('Invalid room placement');
    expect(() => grid.placeRoom(roomA, 2, 1)).toThrow('Invalid room placement');
    expect(() => grid.placeRoom(roomA, 0, 2, 2, 1)).toThrow('Invalid room placement'); // col overflow
  }); 

  test('throws an error when room is placed at an occupied coordinate', () => {
    grid.placeRoom(roomA, 0, 1);
    expect(() => grid.placeRoom(roomA, 0, 1)).toThrow('Invalid room placement');
    expect(() => grid.placeRoom(vault, 0, 0, 2, 1)).toThrow('Invalid room placement'); // collides with (0, 1)
    expect(grid.getRoomAt(0, 1)).toBe(roomA);
  }); 

  //getRoomAt tests
  test('returns null for unoccupied valid coordinates', () => {
    expect(grid.getRoomAt(0, 0)).toBeNull();
  }); 

  test('returns null for invalid coordinates', () => {
    expect(grid.getRoomAt(-1, 0)).toBeNull();
    expect(grid.getRoomAt(0, -1)).toBeNull();
    expect(grid.getRoomAt(2, 0)).toBeNull();
    expect(grid.getRoomAt(0, 3)).toBeNull();
  }); 

  test('returns the room located at the specified coordinate', () => {
    grid.placeRoom(vault, 0, 2, 1, 2); // 2 rows tall
    expect(grid.getRoomAt(0, 2)).toBe(vault);
    expect(grid.getRoomAt(1, 2)).toBe(vault);
    expect(grid.getRoomAt(2, 2)).toBeNull();
  }); 

  //getAllRooms tests
  test('returns an empty array when no rooms have been placed', () => {
    expect(grid.getAllRooms()).toEqual([]);
  }); 

  test('returns all placed rooms with their corresponding coordinates and spans', () => {
    grid.placeRoom(roomA, 0, 0);
    grid.placeRoom(roomB, 1, 0, 2, 1); // 2x1
    grid.placeRoom(vault, 0, 2, 1, 2); // 1x2

    const allRooms = grid.getAllRooms();
    expect(allRooms).toHaveLength(3);
    expect(allRooms).toEqual([
      { room: roomA, row: 0, column: 0, colSpan: 1, rowSpan: 1 },
      { room: roomB, row: 1, column: 0, colSpan: 2, rowSpan: 1 },
      { room: vault, row: 0, column: 2, colSpan: 1, rowSpan: 2 },
    ]);
  }); 

  //findRoomPosition tests
  test('returns the origin row and column of the specified room', () => {
    grid.placeRoom(roomA, 0, 2, 1, 2);
    const pos = grid.findRoomPosition('room_a');
    expect(pos).toEqual({ row: 0, column: 2 });
  });

  test('returns null if the room is not on the grid', () => {
    grid.placeRoom(roomA, 0, 0);
    expect(grid.findRoomPosition('vault')).toBeNull();
    expect(grid.findRoomPosition('non_existent_id')).toBeNull();
  });

});