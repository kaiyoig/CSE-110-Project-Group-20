import { describe, test, expect } from 'vitest';
import { MapLayout } from './MapLayout';
import { Difficulty } from '../score';


describe('MapLayout Tests', () => {
    
    describe('Easy layout tests', () => {
        test('creates a 2x3 grid with exactly 5 rooms', () => {
        const layout = MapLayout.createLayout(Difficulty.Easy);

        expect(layout.grid.rows).toBe(3);
        expect(layout.grid.columns).toBe(3);
        expect(layout.rooms).toHaveLength(5);
        });

        test('places rooms in the expected grid slots with null for the hallway', () => {
        const layout = MapLayout.createLayout(Difficulty.Easy);
        const { grid } = layout;

        // Row 0: [Room A] [Room B] [Vault]
        expect(grid.getRoomAt(0, 0)?.id).toBe('room_a');
        expect(grid.getRoomAt(0, 1)?.id).toBe('room_b');
        expect(grid.getRoomAt(0, 2)?.id).toBe('vault');

        // Row 1: [null] [null] [Vault(spans down)]
        expect(grid.getRoomAt(1, 0)).toBeNull();
        expect(grid.getRoomAt(1, 1)).toBeNull();
        expect(grid.getRoomAt(1, 2)?.id).toBe('vault');

        // Row 2: [Room C] [Room C(spans right)] [Room X]
        expect(grid.getRoomAt(2, 0)?.id).toBe('room_c');
        expect(grid.getRoomAt(2, 1)?.id).toBe('room_c');
        expect(grid.getRoomAt(2, 2)?.id).toBe('room_x');
        });

        test('configures Room C and Vault prerequisites correctly', () => {
        const layout = MapLayout.createLayout(Difficulty.Easy);
        const roomC = layout.rooms.find((r) => r.id === 'room_c');
        const vault = layout.rooms.find((r) => r.id === 'vault');
        const roomX = layout.rooms.find((r) => r.id === 'room_x');

        expect(roomC?.prerequisites).toEqual(['room_a', 'room_b']);
        expect(vault?.prerequisites).toEqual(['room_c']);
        expect(roomX?.kind).toBe('bonus');
        });
    });

    describe('Medium layout tests', () => {
        test('creates a 3x3 grid with exactly 6 rooms', () => {
        const layout = MapLayout.createLayout(Difficulty.Medium);

        expect(layout.grid.rows).toBe(3);
        expect(layout.grid.columns).toBe(3);
        expect(layout.rooms).toHaveLength(6);
        });

        test('places rooms and open hallway tiles at the correct coordinates', () => {
        const layout = MapLayout.createLayout(Difficulty.Medium);
        const { grid } = layout;

        // Row 0: [Room A] [Room B] [Vault]
        expect(grid.getRoomAt(0, 0)?.id).toBe('room_a');
        expect(grid.getRoomAt(0, 1)?.id).toBe('room_b');
        expect(grid.getRoomAt(0, 2)?.id).toBe('vault');

        // Row 1: [Room A(spans down)] [Room B(spans down)] [Vault(spans down)]
        expect(grid.getRoomAt(1, 0)?.id).toBe('room_a');
        expect(grid.getRoomAt(1, 1)?.id).toBe('room_b');
        expect(grid.getRoomAt(1, 2)?.id).toBe('vault');

        // Row 2: [Room C] [Room D] [Room X]
        expect(grid.getRoomAt(2, 0)?.id).toBe('room_c');
        expect(grid.getRoomAt(2, 1)?.id).toBe('room_d');
        expect(grid.getRoomAt(2, 2)?.id).toBe('room_x');
        });

        test('configures prerequisite requirements for Medium difficulty', () => {
        const layout = MapLayout.createLayout(Difficulty.Medium);
        const roomC = layout.rooms.find((r) => r.id === 'room_c');
        const vault = layout.rooms.find((r) => r.id === 'vault');

        expect(roomC?.prerequisites).toEqual(['room_a', 'room_b']);
        expect(vault?.prerequisites).toEqual(['room_c', 'room_d']);
        });
    });

    describe('Hard layout tests', () => {
        test('creates a 3x4 grid with exactly 8 rooms', () => {
        const layout = MapLayout.createLayout(Difficulty.Hard);

        expect(layout.grid.rows).toBe(3);
        expect(layout.grid.columns).toBe(4);
        expect(layout.rooms).toHaveLength(8);
        });

        test('places rooms and open hallway slots across the 3x4 grid', () => {
        const layout = MapLayout.createLayout(Difficulty.Hard);
        const { grid } = layout;

        // Row 0: [Room B] [Room C] [Room D] [Vault]
        expect(grid.getRoomAt(0, 0)?.id).toBe('room_b');
        expect(grid.getRoomAt(0, 1)?.id).toBe('room_c');
        expect(grid.getRoomAt(0, 2)?.id).toBe('room_d');
        expect(grid.getRoomAt(0, 3)?.id).toBe('vault');

        // Row 1: [Room A] [null] [null] [Vault(spans down)]
        expect(grid.getRoomAt(1, 0)?.id).toBe('room_a');
        expect(grid.getRoomAt(1, 1)).toBeNull();
        expect(grid.getRoomAt(1, 2)).toBeNull();
        expect(grid.getRoomAt(1, 3)?.id).toBe('vault');

        // Row 2: [Room Y] [Room E] [Room E(spans right)] [Room X]
        expect(grid.getRoomAt(2, 0)?.id).toBe('room_y');
        expect(grid.getRoomAt(2, 1)?.id).toBe('room_e');
        expect(grid.getRoomAt(2, 2)?.id).toBe('room_e');
        expect(grid.getRoomAt(2, 3)?.id).toBe('room_x');
        });

        test('configures multi-branch prerequisites for Hard difficulty', () => {
        const layout = MapLayout.createLayout(Difficulty.Hard);
        const roomB = layout.rooms.find((r) => r.id === 'room_b');
        const roomE = layout.rooms.find((r) => r.id === 'room_e');
        const vault = layout.rooms.find((r) => r.id === 'vault');

        expect(roomB?.prerequisites).toEqual(['room_a']);
        expect(roomE?.prerequisites).toEqual(['room_b', 'room_c']);
        expect(vault?.prerequisites).toEqual(['room_e', 'room_d']);
        });
    });

});