import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { Room } from './Room';
import { MapController, type SwitchMapScreen, type AccessDeniedPayload } from './MapController';
import { ScoreController, ScoreModel } from '../score';
import { NotificationManager } from '../notification-manager/NotificationManager';
import { EventType } from '../notification-manager/GameEvent';
import { MapGrid } from './MapGrid';

const question = { prompt: 'x * 2 + 1 = 5', answer: '2' };

describe('MapController Tests', () => {
  let controller: MapController;
  let score: ScoreController;
  let notifications: NotificationManager;
  let sent: EventType[];
  let screenChangeMock: ReturnType<typeof vi.fn<(event: SwitchMapScreen) => void>>;
  let accessDeniedMock: ReturnType<typeof vi.fn<(payload: AccessDeniedPayload) => void>>;

  let placeholderRoomA: Room;
  let placeholderRoomB: Room;
  let placeholderRoomC: Room;
  let placeholderVault: Room;
  let placeholderRoomX: Room;

  let grid: MapGrid;

  afterEach(() => {
    score.dispose();
  });

  beforeEach(() => {
    notifications = new NotificationManager();
    sent = [];
    for (const type of [EventType.RoomEntered, EventType.ReturnedToMap]) {
      notifications.subscribe(type, (e) => sent.push(e.eventType));
    }
    // A real ScoreController listening to the same events, so the clock tests
    // check the whole path: map → event → score.
    score = new ScoreController(new ScoreModel());
    score.listenTo(notifications);
    grid = new MapGrid(3, 3);
    controller = new MapController(notifications, grid);

    // Mocks for execution site callbacks
    screenChangeMock = vi.fn();
    accessDeniedMock = vi.fn();

    controller.onScreenChange = screenChangeMock;
    controller.onAccessDenied = accessDeniedMock;

    // Set up placeholder rooms matching the bank layout
    placeholderRoomA = new Room({ id: 'room_a', name: 'Room A', question });
    placeholderRoomB = new Room({ id: 'room_b', name: 'Room B', question });
    placeholderRoomC = new Room({
      id: 'room_c',
      name: 'Room C',
      question,
      prerequisites: ['room_a', 'room_b'],
    });
    placeholderVault = new Room({
      id: 'vault',
      name: 'Vault',
      question,
      prerequisites: ['room_c'],
    });
    placeholderRoomX = new Room({
      id: 'room_x',
      name: 'Room X',
      kind: 'bonus',
      question,
    });

    controller.registerRoom(placeholderRoomA);
    controller.registerRoom(placeholderRoomB);
    controller.registerRoom(placeholderRoomC);
    controller.registerRoom(placeholderVault);
    controller.registerRoom(placeholderRoomX);

    grid.placeRoom(placeholderRoomA, 0, 0, 1, 1);
    grid.placeRoom(placeholderRoomB, 0, 1, 1, 1);
    grid.placeRoom(placeholderVault, 0, 2, 1, 2);
    grid.placeRoom(placeholderRoomC, 2, 0, 2, 1);
    grid.placeRoom(placeholderRoomX, 2, 2, 1, 1);
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

  test('clicking Room C fails prerequisites and emits access denied callback when Room A and Room B are not Solved', () => {
    const result = controller.clickRoomButton('room_c');

    expect(result).toBe(false);
    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();

    // Verify onAccessDenied triggered and onScreenChange NOT triggered
    expect(accessDeniedMock).toHaveBeenCalledWith({
      roomId: 'room_c',
      roomName: 'Room C',
      missingPrerequisiteIds: ['room_a', 'room_b'],
      missingPrerequisiteNames: ['Room A', 'Room B'],
    });
    expect(screenChangeMock).not.toHaveBeenCalled();
  });

  test('clicking Room C fails prerequisites if Room A is Solved and Room B is not', () => {
    // Solve Room A
    controller.solveRoom('room_a');
    expect(controller.solvedRooms.has('room_a')).toBe(true);

    // Attempt Room C again
    const result = controller.clickRoomButton('room_c');

    expect(result).toBe(false);
    expect(controller.currentScreen).toBe('map');
    expect(controller.activeRoom).toBeNull();

    // Verify onAccessDenied triggered and onScreenChange NOT triggered
    expect(accessDeniedMock).toHaveBeenCalledWith({
      roomId: 'room_c',
      roomName: 'Room C',
      missingPrerequisiteIds: ['room_b'],
      missingPrerequisiteNames: ['Room B'],
    });
    expect(screenChangeMock).not.toHaveBeenCalled();
  });

  test('clicking Room C succeeds after both Room A and Room B are Solved', () => {
    // Solve Room A
    controller.solveRoom('room_a');
    expect(controller.solvedRooms.has('room_a')).toBe(true);

    // Solve Room B
    controller.solveRoom('room_b');
    expect(controller.solvedRooms.has('room_b')).toBe(true);

    // Attempt Room C again
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

  test('clicking multi-cell spanned Vault room requires Room C to be solved first', () => {
    // Vault spans rows 0 and 1 at column 2
    expect(grid.getRoomAt(0, 2)).toBe(placeholderVault);
    expect(grid.getRoomAt(1, 2)).toBe(placeholderVault);

    // Attempt before Room C is solved
    const denied = controller.clickRoomButton('vault');
    expect(denied).toBe(false);
    expect(accessDeniedMock).toHaveBeenCalledWith({
      roomId: 'vault',
      roomName: 'Vault',
      missingPrerequisiteIds: ['room_c'],
      missingPrerequisiteNames: ['Room C'],
    });

    // Solve Room A, Room B, and Room C
    controller.solveRoom('room_a');
    controller.solveRoom('room_b');
    controller.solveRoom('room_c');

    const allowed = controller.clickRoomButton('vault');
    expect(allowed).toBe(true);
    expect(controller.currentScreen).toBe('vault');
    expect(controller.activeRoom).toBe(placeholderVault);
  });

  test('allows entering bonus Room X directly without prerequisites', () => {
    const result = controller.clickRoomButton('room_x');

    expect(result).toBe(true);
    expect(controller.currentScreen).toBe('room_x');
    expect(controller.activeRoom).toBe(placeholderRoomX);
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

  test('solveVault marks the Vault Solved without switching screens', () => {
    controller.solveVault('vault');

    expect(controller.solvedRooms.has('vault')).toBe(true);
    expect(screenChangeMock).not.toHaveBeenCalled();
  });

  test('a Solved Room cannot be entered again', () => {
    controller.solveRoom('room_a');

    expect(controller.clickRoomButton('room_a')).toBe(false);
    expect(controller.activeRoom).toBeNull();
    expect(screenChangeMock).not.toHaveBeenCalled();
    expect(accessDeniedMock).not.toHaveBeenCalled();
  });

  test('solveRoom ignores an unknown id', () => {
    controller.solveRoom('nope');

    expect(controller.solvedRooms.size).toBe(0);
  });

  test('entering a Room sends RoomEntered and returning sends ReturnedToMap', () => {
    controller.clickRoomButton('room_a');
    controller.returnToMap();

    expect(sent).toEqual([EventType.RoomEntered, EventType.ReturnedToMap]);
  });

  test('entering a Room starts the clock and returning to the map pauses it', () => {
    controller.clickRoomButton('room_a');
    expect(score.isInRoom()).toBe(true);
    expect(score.isRunning()).toBe(true);

    controller.returnToMap();
    expect(score.isInRoom()).toBe(false);
    expect(score.isRunning()).toBe(false);
  });

  test('a denied click does not start the clock', () => {
    controller.clickRoomButton('room_c');

    expect(sent).toEqual([]);
    expect(score.isRunning()).toBe(false);
  });

});
