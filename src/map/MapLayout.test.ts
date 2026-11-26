import { describe, test, expect } from "vitest";
import { MapLayout } from "./MapLayout";
import { Difficulty } from "../score";
import { PAIR_COUNT } from "../power-box/power-box-generator";
import { LASER_PAIR_COUNT } from "../graph/graph-equation-generator";

describe("MapLayout Tests", () => {
  describe("Easy layout tests", () => {
    test("creates 2 floors with 3x3 grids and 10 total rooms (7 main, 2 bonus, 1 vault)", () => {
      const layout = MapLayout.createLayout(Difficulty.Easy);

      expect(layout.floors).toHaveLength(2);
      expect(layout.grid).toBe(layout.floors[0].grid);
      expect(layout.grid.rows).toBe(3);
      expect(layout.grid.columns).toBe(3);
      expect(layout.rooms).toHaveLength(10);
      expect(layout.rooms.filter((r) => r.kind === "bonus")).toHaveLength(2);
    });

    test("places Floor 1 and Floor 2 rooms in their expected grid slots", () => {
      const layout = MapLayout.createLayout(Difficulty.Easy);
      const floor1 = layout.floors[0].grid;
      const floor2 = layout.floors[1].grid;

      // Floor 1 Row 0: [room_a (spans down)] [room_b] [room_d]
      expect(floor1.getRoomAt(0, 0)?.id).toBe("room_a");
      expect(floor1.getRoomAt(1, 0)?.id).toBe("room_a");
      expect(floor1.getRoomAt(0, 1)?.id).toBe("room_b");
      expect(floor1.getRoomAt(0, 2)?.id).toBe("room_d");

      // Floor 1 Row 1 hallway slots
      expect(floor1.getRoomAt(1, 1)).toBeNull();
      expect(floor1.getRoomAt(1, 2)).toBeNull();

      // Floor 1 Row 2: [room_c (2 wide)] [bonus_1]
      expect(floor1.getRoomAt(2, 0)?.id).toBe("room_c");
      expect(floor1.getRoomAt(2, 1)?.id).toBe("room_c");
      expect(floor1.getRoomAt(2, 2)?.id).toBe("bonus_1");

      const placedC = floor1.getAllRooms().find((p) => p.room.id === "room_c");
      expect(placedC).toMatchObject({
        row: 2,
        column: 0,
        colSpan: 2,
        rowSpan: 1,
        visualColSpan: 1.5,
      });

      // Floor 2: [room_e] [room_f] [bonus_2], [vault (rows 1-2, col 2)], [room_g (2 wide)]
      expect(floor2.getRoomAt(0, 0)?.id).toBe("room_e");
      expect(floor2.getRoomAt(0, 1)?.id).toBe("room_f");
      expect(floor2.getRoomAt(0, 2)?.id).toBe("bonus_2");
      expect(floor2.getRoomAt(1, 2)?.id).toBe("vault");
      expect(floor2.getRoomAt(2, 2)?.id).toBe("vault");
      expect(floor2.getRoomAt(2, 0)?.id).toBe("room_g");
      expect(floor2.getRoomAt(2, 1)?.id).toBe("room_g");
    });

    test("configures multi-floor prerequisites and room names correctly", () => {
      const layout = MapLayout.createLayout(Difficulty.Easy);
      const byId = new Map(layout.rooms.map((r) => [r.id, r]));

      expect(byId.get("room_b")?.name).toBe("POWERBOX A");
      expect(byId.get("room_f")?.name).toBe("POWERBOX B");
      expect(byId.get("room_c")?.prerequisites).toEqual(["room_a", "room_b"]);
      expect(byId.get("room_e")?.prerequisites).toEqual(["room_c"]);
      expect(byId.get("room_f")?.prerequisites).toEqual(["room_d"]);
      expect(byId.get("room_g")?.prerequisites).toEqual(["room_e", "room_f"]);
      expect(byId.get("vault")?.prerequisites).toEqual(["room_g"]);
      expect(byId.get("bonus_1")?.kind).toBe("bonus");
      expect(byId.get("bonus_2")?.kind).toBe("bonus");
    });
  });

  describe("Medium layout tests", () => {
    test("creates 2 floors with 3x4 grids and 15 total rooms (10 main, 4 bonus, 1 vault)", () => {
      const layout = MapLayout.createLayout(Difficulty.Medium);

      expect(layout.floors).toHaveLength(2);
      expect(layout.grid.rows).toBe(3);
      expect(layout.grid.columns).toBe(4);
      expect(layout.rooms).toHaveLength(15);
      expect(layout.rooms.filter((r) => r.kind === "bonus")).toHaveLength(4);
    });

    test("places Floor 1 and Floor 2 rooms at the expected coordinates", () => {
      const layout = MapLayout.createLayout(Difficulty.Medium);
      const floor1 = layout.floors[0].grid;
      const floor2 = layout.floors[1].grid;

      // Floor 1
      expect(floor1.getRoomAt(0, 0)?.id).toBe("room_a");
      expect(floor1.getRoomAt(0, 1)?.id).toBe("room_b");
      expect(floor1.getRoomAt(0, 3)?.id).toBe("bonus_1");
      expect(floor1.getRoomAt(1, 0)?.id).toBe("room_c");
      expect(floor1.getRoomAt(1, 3)?.id).toBe("room_d");
      expect(floor1.getRoomAt(2, 0)?.id).toBe("room_f");
      expect(floor1.getRoomAt(2, 1)?.id).toBe("bonus_2");
      expect(floor1.getRoomAt(2, 3)?.id).toBe("room_e");

      // Floor 2
      expect(floor2.getRoomAt(0, 0)?.id).toBe("room_g");
      expect(floor2.getRoomAt(0, 1)?.id).toBe("room_h");
      expect(floor2.getRoomAt(0, 2)?.id).toBe("bonus_3");
      expect(floor2.getRoomAt(0, 3)?.id).toBe("vault");
      expect(floor2.getRoomAt(1, 3)?.id).toBe("vault");
      expect(floor2.getRoomAt(1, 0)?.id).toBe("room_i");
      expect(floor2.getRoomAt(2, 0)?.id).toBe("room_j");
      expect(floor2.getRoomAt(2, 1)?.id).toBe("room_j");
      expect(floor2.getRoomAt(2, 3)?.id).toBe("bonus_4");
    });

    test("configures prerequisite chain across Floor 1 and Floor 2", () => {
      const layout = MapLayout.createLayout(Difficulty.Medium);
      const byId = new Map(layout.rooms.map((r) => [r.id, r]));

      expect(byId.get("room_e")?.prerequisites).toEqual(["room_c", "room_d"]);
      expect(byId.get("room_g")?.prerequisites).toEqual(["room_e"]);
      expect(byId.get("room_h")?.prerequisites).toEqual(["room_f"]);
      expect(byId.get("room_j")?.prerequisites).toEqual(["room_h", "room_i"]);
      expect(byId.get("vault")?.prerequisites).toEqual(["room_j"]);
    });
  });

  describe("Hard layout tests", () => {
    test("creates 3 floors with 3x4 grids and 20 total rooms (14 main, 5 bonus, 1 vault)", () => {
      const layout = MapLayout.createLayout(Difficulty.Hard);

      expect(layout.floors).toHaveLength(3);
      expect(layout.grid.rows).toBe(3);
      expect(layout.grid.columns).toBe(4);
      expect(layout.rooms).toHaveLength(20);
      expect(layout.rooms.filter((r) => r.kind === "bonus")).toHaveLength(5);
    });

    test("places rooms across all 3 floors and spans Vault on Floor 3", () => {
      const layout = MapLayout.createLayout(Difficulty.Hard);
      const [f1, f2, f3] = layout.floors.map((f) => f.grid);

      // Floor 1
      expect(f1.getRoomAt(0, 0)?.id).toBe("room_a");
      expect(f1.getRoomAt(0, 1)?.id).toBe("room_b");
      expect(f1.getRoomAt(2, 1)?.id).toBe("room_e");
      expect(f1.getRoomAt(2, 2)?.id).toBe("room_e");

      // Floor 2
      expect(f2.getRoomAt(0, 0)?.id).toBe("room_f");
      expect(f2.getRoomAt(0, 2)?.id).toBe("room_g");
      expect(f2.getRoomAt(2, 0)?.id).toBe("room_h");
      expect(f2.getRoomAt(2, 1)?.id).toBe("room_h");
      expect(f2.getRoomAt(2, 3)?.id).toBe("room_j");

      // Floor 3
      expect(f3.getRoomAt(0, 0)?.id).toBe("room_k");
      expect(f3.getRoomAt(0, 1)?.id).toBe("room_l");
      expect(f3.getRoomAt(0, 2)?.id).toBe("room_l");
      expect(f3.getRoomAt(0, 3)?.id).toBe("vault");
      expect(f3.getRoomAt(1, 3)?.id).toBe("vault");
      expect(f3.getRoomAt(2, 2)?.id).toBe("room_m");
      expect(f3.getRoomAt(2, 3)?.id).toBe("room_m");
    });

    test("configures multi-floor prerequisites up to the Vault on Floor 3", () => {
      const layout = MapLayout.createLayout(Difficulty.Hard);
      const byId = new Map(layout.rooms.map((r) => [r.id, r]));

      expect(byId.get("room_e")?.prerequisites).toEqual(["room_c", "room_d"]);
      expect(byId.get("room_f")?.prerequisites).toEqual(["room_e"]);
      expect(byId.get("room_g")?.prerequisites).toEqual(["room_e"]);
      expect(byId.get("room_j")?.prerequisites).toEqual(["room_h", "room_i"]);
      expect(byId.get("room_k")?.prerequisites).toEqual(["room_j"]);
      expect(byId.get("room_l")?.prerequisites).toEqual(["room_j"]);
      expect(byId.get("room_n")?.prerequisites).toEqual(["room_l", "room_m"]);
      expect(byId.get("vault")?.prerequisites).toEqual(["room_n"]);
    });
  });

  describe("Room puzzles", () => {
    test.each([Difficulty.Easy, Difficulty.Medium, Difficulty.Hard])(
      "assigns Power Box, Laser Match, and Multistep puzzles to the matching rooms (Difficulty %s)",
      (difficulty) => {
        const { rooms } = MapLayout.createLayout(difficulty);

        for (const room of rooms) {
          if (room.name.startsWith("POWERBOX")) {
            if (room.puzzle.type !== "powerBox") {
              throw new Error(`${room.id} is not a Power Box`);
            }
            expect(room.puzzle.pairs).toHaveLength(PAIR_COUNT[difficulty]);
            expect(room.question).toBe(room.puzzle.pairs[0].question);
          } else if (room.name.startsWith("LASERS")) {
            if (room.puzzle.type !== "laser") {
              throw new Error(`${room.id} is not a Laser Match`);
            }
            expect(room.puzzle.questions).toHaveLength(LASER_PAIR_COUNT);
            expect(room.question).toBe(room.puzzle.questions[0]);
          } else {
            expect(room.puzzle).toEqual({ type: "multistep" });
          }
        }
      },
    );
  });
});