import Konva from "konva";
import TextInput from "../text-input/text-input";
import { DIFFICULTY_LABEL, formatMoney, formatTime } from "../score";
import type { AddEntryResult, LeaderboardEntry } from "../score";
import type { HeistResult } from "../game/Game";
import type { EndScreen as EndScreenContract, Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";

const STATS = { x: 120, y: 230, width: 560, rowHeight: 48 };
const BOARD = { x: 760, y: 230, width: 560, rowHeight: 40 };
/** The name box's TextInput, centered at (x, y), under the stats column. */
const NAME_BOX = { x: STATS.x + 150, y: 660, width: 300, height: 50 };

/**
 * Shown after a Heist ends: the outcome, the results, the leaderboard for
 * that Difficulty, and a name box to save an Escaped score.
 * Reworked from the results screen in #28 (Asad) as a passive Konva screen.
 */
export class EndScreen implements EndScreenContract {
  readonly layer = new Konva.Layer();

  private readonly saves = new Listeners<[string]>();
  private readonly playAgains = new Listeners<[]>();
  private readonly backToStarts = new Listeners<[]>();

  private readonly outcome: Konva.Text;
  private readonly flawless: Konva.Group;
  private readonly statValues = new Map<string, Konva.Text>();
  private readonly boardTitle: Konva.Text;
  private readonly boardRows = new Konva.Group({ listening: false });
  private readonly nameBox: Konva.Group;
  private readonly nameInput: TextInput;
  /** Where the name box was: how saving went, once the player has saved. */
  private readonly saveMessage: Konva.Text;

  private result: HeistResult | null = null;
  /** True once this result's score has been handed to onSaveScore. */
  private saved = false;

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground());

    this.outcome = createText({
      y: 60, width: DESIGN_WIDTH,
      align: "center",
      fontSize: 80,
      name: "outcome",
    });
    this.layer.add(this.outcome);

    this.flawless = new Konva.Group({ x: (DESIGN_WIDTH - 220) / 2, y: 160, visible: false, name: "flawless" });
    this.flawless.add(new Konva.Rect({
      width: 220, height: 43, cornerRadius: 24,
      stroke: COLORS.gold, strokeWidth: 3,
    }));
    this.flawless.add(createText({
      width: 220, height: 43,
      text: "Flawless",
      align: "center", verticalAlign: "middle",
      fill: COLORS.gold,
    }));
    this.layer.add(this.flawless);

    this.buildStats();

    this.boardTitle = createText({
      x: BOARD.x, y: BOARD.y, width: BOARD.width,
      fontSize: 32,
      fill: COLORS.gold,
    });
    this.boardRows.position({ x: BOARD.x, y: BOARD.y + 56 });
    this.layer.add(this.boardTitle, this.boardRows);

    this.nameBox = new Konva.Group({ visible: false, name: "name-box" });
    this.nameBox.add(createText({
      x: STATS.x, y: NAME_BOX.y - 70, width: STATS.width,
      text: "Enter your name to save your score",
      fontSize: 24,
    }));
    this.nameBox.add(createButton({
      x: NAME_BOX.x + NAME_BOX.width / 2 + 24, y: NAME_BOX.y - NAME_BOX.height / 2 + 2,
      width: 140, height: 43,
      label: "Save",
      name: "save",
      onClick: () => this.submitName(this.nameInput.text()),
    }));
    this.layer.add(this.nameBox);

    this.saveMessage = createText({
      x: STATS.x, y: NAME_BOX.y - NAME_BOX.height / 2, width: STATS.width + 120,
      fontSize: 26,
      visible: false,
      listening: false,
      name: "save-message",
    });
    this.layer.add(this.saveMessage);

    this.nameInput = new TextInput({
      layer: this.layer,
      x: NAME_BOX.x,
      y: NAME_BOX.y,
      width: NAME_BOX.width,
      height: NAME_BOX.height,
      backgroundColor: "#eeeeee",
      foregroundColor: "#000000",
      ghostText: "Your name",
      ghostTextColor: "#aaaaaa",
    });
    this.nameInput.onTextEntered = (text) => this.submitName(text);

    this.layer.add(createButton({
      x: DESIGN_WIDTH / 2 - 260, y: 790,
      width: 240, height: 56,
      label: "Play Again",
      name: "play-again",
      onClick: () => this.playAgains.emit(),
    }));
    this.layer.add(createButton({
      x: DESIGN_WIDTH / 2 + 20, y: 790,
      width: 240, height: 56,
      label: "Back to Start",
      name: "back-to-start",
      onClick: () => this.backToStarts.emit(),
    }));
  }

  setResult(result: HeistResult, leaderboard: LeaderboardEntry[]): void {
    if (result !== this.result) {
      this.result = result;
      this.saved = false;
      this.nameInput.clear();
      this.saveMessage.visible(false);
    }

    const { outcome, snapshot } = result;

    const finalAnswers = result.history.filter(
      (record) => record.isLastStep
    );

    //Saves latest final submission by overwritting old with latest record
    const latestByQuestion = new Map(
      finalAnswers.map((record) => [record.question, record] as const)
    );

    //Convert into array so we can filter incorrect and correct questions
    const uniqueFinalAnswers = [...latestByQuestion.values()];
    console.log(uniqueFinalAnswers);

    const incorrectQuestions = uniqueFinalAnswers.filter(
    (record) => !record.isCorrect
    );  

    const correctQuestions = uniqueFinalAnswers.filter(
    (record) => record.isCorrect
    );

    console.log("Incorrect:", incorrectQuestions);
    console.log("Correct:", correctQuestions);

    const escaped = outcome === "escaped";
    this.outcome.text(escaped ? "Escaped!" : "Caught!");
    this.outcome.fill(escaped ? COLORS.green : COLORS.red);
    this.flawless.visible(escaped && snapshot.incorrectAnswers === 0);

    this.setStat("score", snapshot.score.toLocaleString("en-US"));
    this.setStat("money", formatMoney(snapshot.money));
    this.setStat("time", formatTime(snapshot.timeSpentMs));
    this.setStat("difficulty", DIFFICULTY_LABEL[snapshot.difficulty]);
    this.setStat("rooms", String(snapshot.roomsSolved));
    this.setStat("bonus", String(snapshot.bonusRoomsSolved));
    this.setStat("incorrect", String(snapshot.incorrectAnswers));

    this.boardTitle.text(`Leaderboard: ${DIFFICULTY_LABEL[snapshot.difficulty]}`);
    this.renderLeaderboard(leaderboard);
    this.refreshNameBox();
    this.layer.batchDraw();
  }

  onSaveScore(cb: (playerName: string) => void): Unsubscribe {
    return this.saves.add(cb);
  }

  showSaveResult(result: AddEntryResult): void {
    const difficulty = this.result ? DIFFICULTY_LABEL[this.result.snapshot.difficulty] : "";
    switch (result.status) {
      case "ranked":
        this.saveMessage.text(`Saved! You're #${result.rank} on the ${difficulty} leaderboard.`);
        this.saveMessage.fill(COLORS.green);
        break;
      case "notRanked":
        this.saveMessage.text(`Not on the ${difficulty} leaderboard this time. Try again!`);
        this.saveMessage.fill(COLORS.gold);
        break;
      case "saveFailed":
        this.saveMessage.text("Couldn't save your score: browser storage is full or blocked.");
        this.saveMessage.fill(COLORS.red);
        break;
    }
    this.saveMessage.visible(true);
    this.layer.batchDraw();
  }

  onPlayAgain(cb: () => void): Unsubscribe {
    return this.playAgains.add(cb);
  }

  onBackToStart(cb: () => void): Unsubscribe {
    return this.backToStarts.add(cb);
  }

  show(): void {
    this.layer.show();
    this.refreshNameBox();
    this.layer.batchDraw();
  }

  hide(): void {
    this.layer.hide();
    this.refreshNameBox();
  }

  private buildStats(): void {
    const rows: Array<[key: string, label: string]> = [
      ["score", "Score"],
      ["money", "Money"],
      ["time", "Time spent"],
      ["difficulty", "Difficulty"],
      ["rooms", "Rooms solved"],
      ["bonus", "Bonus Rooms (included above)"],
      ["incorrect", "Incorrect Answers"],
    ];
    rows.forEach(([key, label], i) => {
      const y = STATS.y + i * STATS.rowHeight;
      this.layer.add(createText({ x: STATS.x, y, width: STATS.width, text: label, fontStyle: "normal" }));
      const value = createText({ x: STATS.x, y, width: STATS.width, align: "right", name: `stat-${key}` });
      this.statValues.set(key, value);
      this.layer.add(value);
    });
  }

  private setStat(key: string, value: string): void {
    this.statValues.get(key)?.text(value);
  }

  private renderLeaderboard(entries: LeaderboardEntry[]): void {
    this.boardRows.destroyChildren();
    if (entries.length === 0) {
      this.boardRows.add(createText({ width: BOARD.width, text: "No saved scores yet.", fontStyle: "normal" }));
      return;
    }
    entries.forEach((entry, i) => {
      const y = i * BOARD.rowHeight;
      const row = new Konva.Group({ y, name: "leaderboard-row" });
      row.add(createText({ width: 48, text: `${i + 1}.`, fontStyle: "normal" }));
      row.add(createText({ x: 48, width: 280, text: entry.playerName, fontStyle: "normal", ellipsis: true, wrap: "none" }));
      row.add(createText({ x: 328, width: 120, text: entry.score.toLocaleString("en-US"), align: "right" }));
      row.add(createText({ x: 448, width: 112, text: formatTime(entry.timeSpentMs), align: "right", fontStyle: "normal" }));
      this.boardRows.add(row);
    });
  }

  /** The name box shows only while visible, Escaped, and not saved yet. */
  private refreshNameBox(): void {
    const offered = this.layer.visible() && this.result?.outcome === "escaped" && !this.saved;
    this.nameBox.visible(offered);
    if (offered) this.nameInput.show(NAME_BOX.x, NAME_BOX.y);
    else this.nameInput.hide();
  }

  private submitName(text: string): void {
    const name = text.trim();
    // An empty box (e.g. on blur) isn't a save.
    if (!name || this.saved || this.result?.outcome !== "escaped" || !this.nameBox.visible()) return;
    this.saved = true;
    this.refreshNameBox();
    this.saves.emit(name);
  }
}
