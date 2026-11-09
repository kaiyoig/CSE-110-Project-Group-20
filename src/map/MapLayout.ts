import { MapGrid } from "./MapGrid";
import { Room } from "./Room";
import { Difficulty } from "../score";
import { getQuestion } from "../questions/QuestionGenerator";

export interface GeneratedMapLayout {
    grid: MapGrid;
    rooms: Room[];
}

export class MapLayout {

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

    // Easy level map layout
    // [Room A] [Room B] [Vault]
    // [Room C] [(null)] [Room X]
    private static createEasyLayout(): GeneratedMapLayout {
        const grid = new MapGrid(2, 3);

        const roomA = new Room({
            id: "room_a",
            name: "Room A",
            question: getQuestion(Difficulty.Easy),
        });

        const roomB = new Room({
            id: "room_b",
            name: "Room B",
            question: getQuestion(Difficulty.Easy),
        });

        const roomC = new Room({
            id: "room_c",
            name: "Room C",
            question: getQuestion(Difficulty.Easy),
            prerequisites: ["room_a", "room_b"],
        });

        const vault = new Room({
            id: "vault",
            name: "Vault",
            question: getQuestion(Difficulty.Easy),
            prerequisites: ["room_c"],
        });

        const roomX = new Room({
            id: "room_x",
            name: "Room X",
            question: getQuestion(Difficulty.Easy),
            kind: "bonus",
        });

        grid.placeRoom(roomA, 0, 0);
        grid.placeRoom(roomB, 0, 1);
        grid.placeRoom(vault, 0, 2);
        grid.placeRoom(roomC, 1, 0);
        grid.placeRoom(roomX, 1, 2);

        return {grid, rooms: [roomA, roomB, roomC, roomX, vault]};
    }

    // Medium level map layout
    // [Room A] [Room B] [Vault]
    // [Room C] [(null)] [(null)]
    // [Room X] [Room D] [(null)]
    private static createMediumLayout(): GeneratedMapLayout {
        const grid = new MapGrid(3, 3);

        const roomA = new Room({
            id: "room_a",
            name: "Room A",
            question: getQuestion(Difficulty.Medium),
        });

        const roomB = new Room({
            id: "room_b",
            name: "Room B",
            question: getQuestion(Difficulty.Medium),
        });

        const roomC = new Room({
            id: "room_c",
            name: "Room C",
            question: getQuestion(Difficulty.Medium),
            prerequisites: ["room_a", "room_b"],
        });

        const roomD = new Room({
            id: "room_d",
            name: "Room D",
            question: getQuestion(Difficulty.Medium),
        });

        const vault = new Room({
            id: "vault",
            name: "Vault",
            question: getQuestion(Difficulty.Medium),
            prerequisites: ["room_c", "room_d"],
        });

        const roomX = new Room({
            id: "room_x",
            name: "Room X",
            question: getQuestion(Difficulty.Medium),
            kind: "bonus",
        });

        grid.placeRoom(roomA, 0, 0);
        grid.placeRoom(roomB, 0, 1);
        grid.placeRoom(vault, 0, 2);
        grid.placeRoom(roomC, 1, 0);
        grid.placeRoom(roomX, 2, 0);
        grid.placeRoom(roomD, 2, 1);

        return {grid, rooms: [roomA, roomB, roomC, roomD, roomX, vault]};
    }

    // Hard level map layout
    // [Room A] [Room B] [Room E] [Vault]
    // [Room C] [(null)] [(null)] [(null)]
    // [Room X] [(null)] [Room D] [Room Y]
    private static createHardLayout(): GeneratedMapLayout {
        const grid = new MapGrid(3, 4);

        const roomA = new Room({
            id: "room_a",
            name: "Room A",
            question: getQuestion(Difficulty.Hard),
        });

        const roomB = new Room({
            id: "room_b",
            name: "Room B",
            question: getQuestion(Difficulty.Hard),
            prerequisites: ["room_a"],
        });

        const roomC = new Room({
            id: "room_c",
            name: "Room C",
            question: getQuestion(Difficulty.Hard),
        });

        const roomD = new Room({
            id: "room_d",
            name: "Room D",
            question: getQuestion(Difficulty.Hard),
        });

        const roomE = new Room({
            id: "room_e",
            name: "Room E",
            question: getQuestion(Difficulty.Hard),
            prerequisites: ["room_b", "room_c"],
        });

        const vault = new Room({
            id: "vault",
            name: "Vault",
            question: getQuestion(Difficulty.Hard),
            prerequisites: ["room_e", "room_d"],
        });

        const roomX = new Room({
            id: "room_x",
            name: "Room X",
            question: getQuestion(Difficulty.Hard),
            kind: "bonus",
        });

        const roomY = new Room({
            id: "room_y",
            name: "Room Y",
            question: getQuestion(Difficulty.Hard),
            kind: "bonus",
        });

        grid.placeRoom(roomA, 0, 0);
        grid.placeRoom(roomB, 0, 1);
        grid.placeRoom(roomE, 0, 2);
        grid.placeRoom(vault, 0, 3);
        grid.placeRoom(roomC, 1, 0);
        grid.placeRoom(roomX, 2, 0);
        grid.placeRoom(roomD, 2, 2);
        grid.placeRoom(roomY, 2, 3);

        return {grid, rooms: [roomA, roomB, roomC, roomD, roomE, roomX, roomY, vault]};
    }

}