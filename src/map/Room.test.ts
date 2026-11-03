import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Room } from './Room';

describe('Room Unit Tests', () => {
  test('unlocked room with empty prerequisites is accessible by default', () => {
    const roomA = new Room({ id: 'room_a', name: 'Room A' });
    expect(roomA.isAccessible([])).toBe(true);
  });

  test('locked room is not accessible if prerequisite room is incomplete', () => {
    const roomC = new Room({
      id: 'room_c',
      name: 'Room C',
      prerequisites: ['room_a'],
    });

    expect(roomC.isAccessible([])).toBe(false);
    expect(roomC.isAccessible(['room_b'])).toBe(false);
  });

  test('locked room is accessible once all prerequisite rooms are completed', () => {
    const vault = new Room({
      id: 'vault',
      name: 'Vault',
      prerequisites: ['room_b', 'room_c'],
    });

    expect(vault.isAccessible(['room_b'])).toBe(false);
    expect(vault.isAccessible(['room_b', 'room_c'])).toBe(true);
  });

  test('setCompleted() marks room completed state to true', () => {
    const roomA = new Room({ id: 'room_a', name: 'Room A' });
    expect(roomA.isCompleted).toBe(false);

    roomA.setCompleted();
    expect(roomA.isCompleted).toBe(true);
  });
});