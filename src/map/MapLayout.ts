import { MapGrid } from "./MapGrid";
import { Room, type RoomConfig } from "./Room";
import { Difficulty } from "../score";
import { getQuestion } from "../questions/QuestionGenerator";
import { generatePairs } from "../power-box/power-box-generator";
import { generateLaserQuestions } from "../graph/graph-equation-generator";

/** A Room's settings apart from its Question and puzzle, which the helpers below make. */
type RoomBasics = Omit<RoomConfig, "question" | "puzzle">;

export interface MapFloor {
  id: string;
  label: string;
  grid: MapGrid;
}

export interface GeneratedMapLayout {
    grid: MapGrid;
    floors: MapFloor[];
    rooms: Room[];
}

/**
 * Every layout uses the same puzzles: Room B is the Power Box, Room C the
 * Laser Match, and every other Room (the Vault and Bonus Rooms included)
 * is a multistep Room.
 */
export class MapLayout {

    /** A Power Box Room: one Question per wire, made once per Heist. */
    private static powerBoxRoom(basics: RoomBasics, difficulty: Difficulty): Room {
        const pairs = generatePairs(difficulty);
        return new Room({ ...basics, question: pairs[0].question, puzzle: { type: "powerBox", pairs } });
    }

    /** A Laser Match Room: one Question per equation/graph pair, made once per Heist. */
    private static laserRoom(basics: RoomBasics, difficulty: Difficulty): Room {
        const questions = generateLaserQuestions(difficulty);
        return new Room({ ...basics, question: questions[0], puzzle: { type: "laser", questions } });
    }

    public static createLayout(difficulty: Difficulty): GeneratedMapLayout {
        switch (difficulty) {
            case Difficulty.Easy:
                return this.createEasyLayout();
            case Difficulty.Medium:
                return this.createMediumLayout();
            case Difficulty.Hard:
                return this.createHardLayout();
            default:
                return this.createEasyLayout();
        }
    }

    /**
   * EASY: 10 Rooms across 2 Floors (7 Main + 2 Bonus + 1 Vault)
   */
  private static createEasyLayout(): GeneratedMapLayout {
    const d = Difficulty.Easy;

    // --- Floor 1 (5 rooms: 4 main, 1 bonus) ---
    const floor1 = new MapGrid(3, 3);
    const roomA = new Room({ id: "room_a", name: "KEYPAD A", question: getQuestion(d) });
    const roomB = this.powerBoxRoom({ id: "room_b", name: "POWERBOX A" }, d);
    const roomC = this.laserRoom(
      { id: "room_c", name: "LASERS A", prerequisites: ["room_a", "room_b"] },
      d,
    );
    const roomD = new Room({
      id: "room_d",
      name: "KEYPAD B",
      question: getQuestion(d),
      prerequisites: ["room_b"],
    });
    const bonus1 = new Room({
      id: "bonus_1",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });

    floor1.placeRoom(roomA, 0, 0, 1, 2);
    floor1.placeRoom(roomB, 0, 1, 1, 1);
    floor1.placeRoom(roomD, 0, 2, 1, 1);
    floor1.placeRoom(roomC, 2, 0, 2, 1, { visualColSpan: 1.5 });
    floor1.placeRoom(bonus1, 2, 2, 1, 1);

    // --- Floor 2 (5 rooms: 3 main, 1 bonus, 1 vault) ---
    const floor2 = new MapGrid(3, 3);
    const roomE = new Room({
      id: "room_e",
      name: "KEYPAD C",
      question: getQuestion(d),
      prerequisites: ["room_c"],
    });
    const roomF = this.powerBoxRoom(
      { id: "room_f", name: "POWERBOX B", prerequisites: ["room_d"] },
      d,
    );
    const roomG = this.laserRoom(
      { id: "room_g", name: "LASERS B", prerequisites: ["room_e", "room_f"] },
      d,
    );
    const bonus2 = new Room({
      id: "bonus_2",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const vault = new Room({
      id: "vault",
      name: "VAULT",
      question: getQuestion(d),
      prerequisites: ["room_g"],
    });

    floor2.placeRoom(roomE, 0, 0, 1, 1);
    floor2.placeRoom(roomF, 0, 1, 1, 1);
    floor2.placeRoom(bonus2, 0, 2, 1, 1);
    floor2.placeRoom(roomG, 2, 0, 2, 1, { visualColSpan: 1.5 });
    floor2.placeRoom(vault, 1, 2, 1, 2);

    const floors: MapFloor[] = [
      { id: "floor_1", label: "Floor 1", grid: floor1 },
      { id: "floor_2", label: "Floor 2", grid: floor2 },
    ];

    return {
      grid: floor1,
      floors,
      rooms: [roomA, roomB, roomC, roomD, bonus1, roomE, roomF, roomG, bonus2, vault],
    };
  }

  /**
   * MEDIUM: 15 Rooms across 2 Floors (10 Main + 4 Bonus + 1 Vault)
   */
  private static createMediumLayout(): GeneratedMapLayout {
    const d = Difficulty.Medium;

    // --- Floor 1 (8 rooms: 6 main, 2 bonus) ---
    const floor1 = new MapGrid(3, 4);
    const roomA = new Room({ id: "room_a", name: "KEYPAD A", question: getQuestion(d) });
    const roomB = this.powerBoxRoom({ id: "room_b", name: "POWERBOX A" }, d);
    const roomC = this.laserRoom(
      { id: "room_c", name: "LASERS A", prerequisites: ["room_a"] },
      d,
    );
    const roomD = new Room({
      id: "room_d",
      name: "KEYPAD B",
      question: getQuestion(d),
      prerequisites: ["room_b"],
    });
    const roomE = new Room({
      id: "room_e",
      name: "KEYPAD C",
      question: getQuestion(d),
      prerequisites: ["room_c", "room_d"],
    });
    const roomF = this.laserRoom(
      { id: "room_f", name: "LASERS B", prerequisites: ["room_d"] },
      d,
    );
    const bonus1 = new Room({
      id: "bonus_1",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const bonus2 = new Room({
      id: "bonus_2",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });

    floor1.placeRoom(roomA, 0, 0);
    floor1.placeRoom(roomB, 0, 1);
    floor1.placeRoom(bonus1, 0, 3);
    floor1.placeRoom(roomC, 1, 0);
    floor1.placeRoom(roomD, 1, 3);
    floor1.placeRoom(roomF, 2, 0);
    floor1.placeRoom(bonus2, 2, 1);
    floor1.placeRoom(roomE, 2, 3);

    // --- Floor 2 (7 rooms: 4 main, 2 bonus, 1 vault) ---
    const floor2 = new MapGrid(3, 4);
    const roomG = new Room({
      id: "room_g",
      name: "KEYPAD D",
      question: getQuestion(d),
      prerequisites: ["room_e"],
    });
    const roomH = this.powerBoxRoom(
      { id: "room_h", name: "POWERBOX B", prerequisites: ["room_f"] },
      d,
    );
    const roomI = new Room({
      id: "room_i",
      name: "KEYPAD E",
      question: getQuestion(d),
      prerequisites: ["room_g"],
    });
    const roomJ = this.laserRoom(
      { id: "room_j", name: "LASERS C", prerequisites: ["room_h", "room_i"] },
      d,
    );
    const bonus3 = new Room({
      id: "bonus_3",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const bonus4 = new Room({
      id: "bonus_4",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const vault = new Room({
      id: "vault",
      name: "VAULT",
      question: getQuestion(d),
      prerequisites: ["room_j"],
    });

    floor2.placeRoom(roomG, 0, 0);
    floor2.placeRoom(roomH, 0, 1);
    floor2.placeRoom(bonus3, 0, 2);
    floor2.placeRoom(vault, 0, 3, 1, 2);
    floor2.placeRoom(roomI, 1, 0);
    floor2.placeRoom(roomJ, 2, 0, 2, 1);
    floor2.placeRoom(bonus4, 2, 3);

    const floors: MapFloor[] = [
      { id: "floor_1", label: "Floor 1", grid: floor1 },
      { id: "floor_2", label: "Floor 2", grid: floor2 },
    ];

    return {
      grid: floor1,
      floors,
      rooms: [
        roomA, roomB, roomC, roomD, roomE, roomF, bonus1, bonus2,
        roomG, roomH, roomI, roomJ, bonus3, bonus4, vault,
      ],
    };
  }

  /**
   * HARD: 20 Rooms across 3 Floors (14 Main + 5 Bonus + 1 Vault)
   */
  private static createHardLayout(): GeneratedMapLayout {
    const d = Difficulty.Hard;

    // --- Floor 1: Ground POWERBOX (7 rooms: 5 main, 2 bonus) ---
    const floor1 = new MapGrid(3, 4);
    const roomA = new Room({ id: "room_a", name: "KEYPAD A", question: getQuestion(d) });
    const roomB = this.powerBoxRoom({ id: "room_b", name: "POWERBOX A" }, d);
    const roomC = this.laserRoom(
      { id: "room_c", name: "LASERS A", prerequisites: ["room_a"] },
      d,
    );
    const roomD = new Room({
      id: "room_d",
      name: "KEYPAD B",
      question: getQuestion(d),
      prerequisites: ["room_b"],
    });
    const roomE = new Room({
      id: "room_e",
      name: "KEYPAD C",
      question: getQuestion(d),
      prerequisites: ["room_c", "room_d"],
    });
    const bonus1 = new Room({
      id: "bonus_1",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const bonus2 = new Room({
      id: "bonus_2",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });

    floor1.placeRoom(roomA, 0, 0);
    floor1.placeRoom(roomB, 0, 1);
    floor1.placeRoom(bonus1, 0, 3);
    floor1.placeRoom(roomC, 1, 3);
    floor1.placeRoom(bonus2, 2, 0);
    floor1.placeRoom(roomE, 2, 1, 2, 1);
    floor1.placeRoom(roomD, 2, 3);

    // --- Floor 2: Upper Wing (7 rooms: 5 main, 2 bonus) ---
    const floor2 = new MapGrid(3, 4);
    const roomF = new Room({
      id: "room_f",
      name: "KEYPAD D",
      question: getQuestion(d),
      prerequisites: ["room_e"],
    });
    const roomG = this.powerBoxRoom(
      { id: "room_g", name: "POWERBOX B", prerequisites: ["room_e"] },
      d,
    );
    const roomH = this.laserRoom(
      { id: "room_h", name: "LASERS B", prerequisites: ["room_f"] },
      d,
    );
    const roomI = new Room({
      id: "room_i",
      name: "KEYPAD E",
      question: getQuestion(d),
      prerequisites: ["room_g"],
    });
    const roomJ = new Room({
      id: "room_j",
      name: "KEYPAD F",
      question: getQuestion(d),
      prerequisites: ["room_h", "room_i"],
    });
    const bonus3 = new Room({
      id: "bonus_3",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const bonus4 = new Room({
      id: "bonus_4",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });

    floor2.placeRoom(roomF, 0, 0);
    floor2.placeRoom(roomG, 0, 2);
    floor2.placeRoom(bonus3, 0, 3);
    floor2.placeRoom(bonus4, 1, 0);
    floor2.placeRoom(roomI, 1, 3);
    floor2.placeRoom(roomH, 2, 0, 2, 1);
    floor2.placeRoom(roomJ, 2, 3);

    // --- Floor 3: Vault Level (6 rooms: 4 main, 1 bonus, 1 vault) ---
    const floor3 = new MapGrid(3, 4);
    const roomK = new Room({
      id: "room_k",
      name: "KEYPAD G",
      question: getQuestion(d),
      prerequisites: ["room_j"],
    });
    const roomL = this.powerBoxRoom(
      { id: "room_l", name: "POWERBOX C", prerequisites: ["room_j"] },
      d,
    );
    const roomM = this.laserRoom(
      { id: "room_m", name: "LASERS C", prerequisites: ["room_k"] },
      d,
    );
    const roomN = new Room({
      id: "room_n",
      name: "KEYPAD H",
      question: getQuestion(d),
      prerequisites: ["room_l", "room_m"],
    });
    const bonus5 = new Room({
      id: "bonus_5",
      name: "BONUS",
      question: getQuestion(d),
      kind: "bonus",
    });
    const vault = new Room({
      id: "vault",
      name: "VAULT",
      question: getQuestion(d),
      prerequisites: ["room_n"],
    });

    floor3.placeRoom(roomK, 0, 0);
    floor3.placeRoom(roomL, 0, 1, 2, 1);
    floor3.placeRoom(vault, 0, 3, 1, 2);
    floor3.placeRoom(roomN, 1, 0);
    floor3.placeRoom(bonus5, 2, 0, 1, 1);
    floor3.placeRoom(roomM, 2, 2, 2, 1);

    const floors: MapFloor[] = [
      { id: "floor_1", label: "Floor 1", grid: floor1 },
      { id: "floor_2", label: "Floor 2", grid: floor2 },
      { id: "floor_3", label: "Floor 3", grid: floor3 },
    ];

    return {
      grid: floor1,
      floors,
      rooms: [
        roomA, roomB, roomC, roomD, roomE, bonus1, bonus2,
        roomF, roomG, roomH, roomI, roomJ, bonus3, bonus4,
        roomK, roomL, roomM, roomN, bonus5, vault,
      ],
    };
  }
}