import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Room } from './Room';
import { MapController, type SwitchMapScreen } from './MapController';

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

describe('MapController Tests', () => {
  let controller: MapController;
  let screenChangeMock: ReturnType<typeof vi.fn<(event: SwitchMapScreen) => void>>;
  let accessDeniedMock: ReturnType<typeof vi.fn<(roomId: string) => void>>;

  let placeholderRoomA: Room;
  let placeholderRoomB: Room;
  let placeholderRoomC: Room;
  let placeholderVault: Room;

  beforeEach(() => {
    controller = new MapController();

    // Mocks for execution site callbacks
    screenChangeMock = vi.fn();
    accessDeniedMock = vi.fn();

    controller.onScreenChange = screenChangeMock;
    controller.onAccessDenied = accessDeniedMock;

    // Set up placeholder rooms matching the bank layout
    placeholderRoomA = new Room({ id: 'room_a', name: 'Room A' });
    placeholderRoomB = new Room({ id: 'room_b', name: 'Room B' });
    placeholderRoomC = new Room({
      id: 'room_c',
      name: 'Room C',
      prerequisites: ['room_a', 'room_b'],
    });
    placeholderVault = new Room({
      id: 'vault',
      name: 'Vault',
      prerequisites: ['room_c'],
    });

    controller.registerRoom(placeholderRoomA);
    controller.registerRoom(placeholderRoomB);
    controller.registerRoom(placeholderRoomC);
    controller.registerRoom(placeholderVault);
  });

  test('starts with default screen state as "map" and no active room', () => {
    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();
  });

  test('returns false when clicking a non-existent room ID', () => {
    const result = controller.clickRoomButton('invalid_id');

    expect(result).toBe(false);
    expect(controller.currentScreen).toBe('map');
    expect(screenChangeMock).not.toHaveBeenCalled();
    expect(accessDeniedMock).not.toHaveBeenCalled();
  });

  test('switching to Room A emits Room A value and callback in execution site', () => {
    const result = controller.clickRoomButton('room_a');

    expect(result).toBe(true);
    expect(controller.currentScreen).toBe('room_a');
    expect(controller.activeRoom).toBe(placeholderRoomA);

    // Verifies emission of callback with exact placeholder payload
    expect(screenChangeMock).toHaveBeenCalledTimes(1);
    expect(screenChangeMock).toHaveBeenCalledWith({
      screen: 'room_a',
      room: placeholderRoomA,
      name: 'Room A',
    });
  });

  test('switches successively between Room A and Room B, updating active states', () => {
    // Switch to Room A
    controller.clickRoomButton('room_a');
    expect(controller.currentScreen).toBe('room_a');
    expect(screenChangeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ screen: 'room_a', room: placeholderRoomA })
    );

    // Return to Map
    controller.returnToMap();
    expect(controller.currentScreen).toBe('map');

    // Switch to Room B
    controller.clickRoomButton('room_b');
    expect(controller.currentScreen).toBe('room_b');
    expect(controller.activeRoom).toBe(placeholderRoomB);
    expect(screenChangeMock).toHaveBeenLastCalledWith({
      screen: 'room_b',
      room: placeholderRoomB,
      name: 'Room B',
    });
  });

  test('clicking Room C fails prerequisites and emits access denied callback when Room A and/or Room B incomplete', () => {
    const result = controller.clickRoomButton('room_c');

    expect(result).toBe(false);
    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();

    // Verify onAccessDenied triggered and onScreenChange NOT triggered
    expect(accessDeniedMock).toHaveBeenCalledWith('room_c');
    expect(screenChangeMock).not.toHaveBeenCalled();
  });

  test('clicking Room C fails prerequisites if Room A is completed and Room B is incomplete', () => {
    // Complete Room A
    controller.completeRoom('room_a');
    expect(controller.completedRooms.has('room_a')).toBe(true);

    // Attempt Room C again
    const result = controller.clickRoomButton('room_c');

    expect(result).toBe(false);
    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();

    // Verify onAccessDenied triggered and onScreenChange NOT triggered
    expect(accessDeniedMock).toHaveBeenCalledWith('room_c');
    expect(screenChangeMock).not.toHaveBeenCalled();
  });

  test('clicking Room C succeeds after both Room A and Room B are completed', () => {
    // Complete Room A
    controller.completeRoom('room_a');
    expect(controller.completedRooms.has('room_a')).toBe(true);

    // Complete Room B
    controller.completeRoom('room_b');
    expect(controller.completedRooms.has('room_b')).toBe(true);

    // Attempt Room C again\
    const result = controller.clickRoomButton('room_c');

    expect(result).toBe(true);
    expect(controller.currentScreen).toBe('room_c');
    expect(controller.activeRoom).toBe(placeholderRoomC);
    expect(screenChangeMock).toHaveBeenCalledWith({
      screen: 'room_c',
      room: placeholderRoomC,
      name: 'Room C',
    });
  });

  test('returnToMap() resets screen state to "map" and clears activeRoom', () => {
    controller.clickRoomButton('room_a');
    expect(controller.currentScreen).toBe('room_a');

    controller.returnToMap();

    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();
    expect(screenChangeMock).toHaveBeenLastCalledWith({
      screen: 'map',
      room: null,
      name: 'Map',
    });
  });
});