import Konva from "konva";
import TextInput from "../text-input/text-input";
import { DIFFICULTY_LABEL, formatMoney, formatTime } from "../score";
import type { AddEntryResult, LeaderboardEntry } from "../score";
import type { HeistResult } from "../game/Game";
import type { EndScreen as EndScreenContract, Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, DESIGN_HEIGHT, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";
import type { AnswerRecord } from "../validation/AnswerHistory";

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

  private readonly reviewModal = new Konva.Group({
    visible:false,
    name: "review-modal"
  })

  private readonly reviewQuestionText: Konva.Text;
  private readonly reviewPlayerAnswerText: Konva.Text;
  private readonly reviewCorrectAnswerText: Konva.Text;
  private readonly reviewCounterText: Konva.Text;
  private readonly reviewStatusText: Konva.Text;
  private readonly reviewStatusBubble: Konva.Rect;

  private reviewAnswers: AnswerRecord[] = [];
  private reviewIndex = 0;

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
    x: DESIGN_WIDTH / 2 - 130,
    y: 715,
    width: 260,
    height: 56,
    fontSize: 22,
    label: "Review Answers",
    name: "review-answers",
    onClick: () => {
        this.showReviewQuestion();
        this.reviewModal.show();
        this.layer.batchDraw();
    },
    }));

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

    this.reviewModal.add(new Konva.Rect({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    fill: "rgba(0, 0, 0, 0.65)"
  }));

  this.reviewModal.add(new Konva.Rect({
    x: 200,
    y: 100,
    width: 1040,
    height: 700,
    fill: COLORS.button,
    stroke: COLORS.purple,
    strokeWidth: 4,
    cornerRadius: 10
  }));
    
  //Title
  this.reviewModal.add(createText({
    x: 470,
    y: 200,
    width: 500,
    text: "Review Answers",
    fontSize: 36,
    align: "center",
    fill: COLORS.purple
    }));

  //Display questions
  this.reviewQuestionText = createText({
    x: 280,
    y: 290,
    width: 880,
    text: "Question will appear here",
    fontSize: 30,
    align: "center",
    fill: COLORS.purple
    });

  // Display the player's submitted answer
  this.reviewPlayerAnswerText = createText({
    x: 300,
    y: 430,
    width: 840,
    text: "Your answer: —",
    fontSize: 26,
    fill: COLORS.purple
  });

  // Display the expected answer
  this.reviewCorrectAnswerText = createText({
    x: 300,
    y: 510,
    width: 840,
    text: "Correct answer: —",
    fontSize: 26,
    fill: COLORS.purple
  });

  //Display question number
  this.reviewCounterText = createText({
    x: 860,
    y: 580,
    width: 300,
    text: "Question 0 of 0",
    fontSize: 22,
    align: "right",
    fill: COLORS.purple
});

//Status Bubble
this.reviewStatusBubble = new Konva.Rect({
    x: 630,
    y: 352,
    width: 180,
    height: 48,
    cornerRadius: 24,
    fill: "#FEE2E2"
});

//Display correct/incorrect status
  this.reviewStatusText = createText({
    x: 630,
    y: 352,
    width: 180,
    height: 48,
    text: "",
    fontSize: 22,
    align: "center",
    verticalAlign: "middle",
    fill: "#15803D"
});

  this.reviewModal.add(
    this.reviewQuestionText,
    this.reviewPlayerAnswerText,
    this.reviewCorrectAnswerText,
    this.reviewCounterText,
    this.reviewStatusBubble,
    this.reviewStatusText
  );

  this.reviewModal.add(new Konva.Line({
    points: [280, 625, 1160, 625],
    stroke: COLORS.purple,
    strokeWidth: 2,
    opacity: 0.3
  }));

  this.reviewModal.add(createButton({
    x: 350,
    y: 675,
    width: 180,
    height: 52,
    label: "Previous",
    name: "review-previous",
    onClick: () => {
        if (this.reviewIndex > 0) {
        this.reviewIndex--;
        this.showReviewQuestion();
        this.layer.batchDraw();
    }
    }
  }));

  this.reviewModal.add(createButton({
    x: 910,
    y: 675,
    width: 180,
    height: 52,
    label: "Next",
    name: "review-next",
    onClick: () => {
        if (this.reviewIndex < this.reviewAnswers.length - 1) {
            this.reviewIndex++;
            this.showReviewQuestion();
            this.layer.batchDraw();
        }    
    }
  }));


  this.reviewModal.add(createButton({
    x: 1070,
    y: 120,
    width: 150,
    height: 50,
    label: "Close",
    name: "close-review",
    onClick: () => {
        this.reviewModal.hide();
        this.layer.batchDraw();
    }
  }));

  this.layer.add(this.reviewModal);

  }

  setResult(result: HeistResult, leaderboard: LeaderboardEntry[]): void {
    if (result !== this.result) {
      this.reviewModal.hide();
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

    this.reviewAnswers = [
      ...incorrectQuestions,
      ...correctQuestions
    ];

    this.reviewIndex = 0;

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

  private showReviewQuestion(): void {
    const record = this.reviewAnswers[this.reviewIndex];

    if (!record) {
        this.reviewCounterText.text("Question 0 of 0");
        this.reviewQuestionText.text("No answers to review.");
        this.reviewPlayerAnswerText.text("");
        this.reviewCorrectAnswerText.text("");
        this.reviewStatusText.text("");
        this.reviewStatusBubble.hide();
        return;
    }

    this.reviewStatusBubble.show();

    this.reviewStatusBubble.fill(
    record.isCorrect ? "#DCFCE7" : "#FEE2E2"
    );

    this.reviewStatusText.text(
    record.isCorrect ? "Correct!" : "Incorrect"
    );

    this.reviewStatusText.fill(
    record.isCorrect ? "#15803D" : "#DC2626"
    );

    this.reviewCounterText.text(
    `Question ${this.reviewIndex + 1} of ${this.reviewAnswers.length}`
    );

    this.reviewQuestionText.text(record.question.prompt);

    this.reviewPlayerAnswerText.text(
        `Your answer: ${record.playerAnswer}`
    );

    this.reviewCorrectAnswerText.text(
        `Correct answer: ${record.correctAnswer}`
    );
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
