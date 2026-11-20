import Konva from "konva";
import TextInput from "../text-input/text-input";
import { Difficulty, DIFFICULTY_LABEL, formatMoney, formatTime } from "../score";
import type { AddEntryResult, LeaderboardEntry } from "../score";
import type { HeistResult } from "../game/Game";
import type { EndScreen as EndScreenContract, Unsubscribe } from "./contracts";
import { DESIGN_WIDTH, DESIGN_HEIGHT, fitLayer } from "./layout";
import { Listeners } from "./listeners";
import { COLORS, createBackground, createButton, createText } from "./theme";
import type { AnswerRecord } from "../validation/AnswerHistory";

// Anchor the columns to the results panel and actions to the design-space bottom.
// fitLayer scales and centers this shared layout for the stage size.
const ACTION_Y = DESIGN_HEIGHT - 95; // 805
const PANEL = { x: 92, y: 195, width: DESIGN_WIDTH - 184, height: ACTION_Y - 225 }; // ends at y: 775 (30px gap above buttons)
const COLUMN_Y = PANEL.y + 38;       // 233
const COLUMN_HEIGHT = 432;           // white cards end at y: 665

// Symmetrical column math centered around DESIGN_WIDTH / 2:
const COL_GAP = 56;
const COL_INNER_WIDTH = (PANEL.width - 58 * 2 - COL_GAP) / 2; // 542px each
const STATS = { x: PANEL.x + 58, y: COLUMN_Y + 24, width: COL_INNER_WIDTH, rowHeight: 44 };
const BOARD = { x: STATS.x + COL_INNER_WIDTH + COL_GAP, y: STATS.y, width: COL_INNER_WIDTH, rowHeight: 35 };

/** The name box's TextInput, centered at (x, y), under the stats column. */
const NAME_BOX = { x: STATS.x + 190, y: PANEL.y + PANEL.height - 46, width: 300, height: 50 }; // y: 729 (top edge at 704)

const DIFFICULTY_HEADER_COLORS: Record<Difficulty, string> = {
  [Difficulty.Easy]: "#16a34a",   // Deep vibrant green
  [Difficulty.Medium]: "#d97706", // Rich amber / yellow-gold
  [Difficulty.Hard]: "#dc2626",   // Crisp red
};

/**
 * Shown after a Heist ends: the outcome, the results, the leaderboard for
 * that Difficulty, and a name box to save an Escaped score.
 * Reworked from the results screen in #28 (Asad) as a passive Konva screen.
 */

interface StepMistake {
    stepNumber: number;
    stepPrompt?: string;
    firstIncorrectAnswer: string;
    correctAnswer: string;
    incorrectAttempts: number;
}


interface ReviewEntry {
    question: AnswerRecord["question"];
    solved: boolean;
    mistakes: StepMistake[];
}

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
  private readonly reviewTotalMistakesText: Konva.Text;
  private readonly reviewCounterText: Konva.Text;
  private readonly reviewStatusText: Konva.Text;
  private readonly reviewStatusBubble: Konva.Rect;
  private readonly reviewMistakesGroup = new Konva.Group({
    name: "review-mistakes"
  });

  private reviewAnswers: ReviewEntry[] = [];
  private reviewIndex = 0;

  constructor(stageWidth: number, stageHeight: number) {
    fitLayer(this.layer, stageWidth, stageHeight);
    this.layer.add(createBackground());

    // Match the navy, pale gray panels and purple type of the team's Figma mockups.
    this.layer.add(new Konva.Rect({
      ...PANEL,
      fill: COLORS.room, cornerRadius: 20, name: "results-panel",
      listening: false,
    }));
    const CARD_PAD = 24;
    this.layer.add(new Konva.Rect({
      x: STATS.x - CARD_PAD, y: COLUMN_Y, width: STATS.width + CARD_PAD * 2, height: COLUMN_HEIGHT,
      fill: COLORS.white, stroke: COLORS.purple, strokeWidth: 3,
      cornerRadius: 16, listening: false,
    }));
    this.layer.add(new Konva.Rect({
      x: BOARD.x - CARD_PAD, y: COLUMN_Y, width: BOARD.width + CARD_PAD * 2, height: COLUMN_HEIGHT,
      fill: COLORS.white, stroke: COLORS.purple, strokeWidth: 3,
      cornerRadius: 16, listening: false,
    }));

    this.outcome = createText({
      y: 55, width: DESIGN_WIDTH,
      align: "center",
      fontSize: 80,
      fontFamily: "Gasoek One", fontStyle: "normal",
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
      fontStyle: "bold",
      fill: DIFFICULTY_HEADER_COLORS[Difficulty.Easy],
    });
    this.boardRows.position({ x: BOARD.x, y: BOARD.y + 56 });
    this.layer.add(this.boardTitle, this.boardRows);

    this.nameBox = new Konva.Group({ visible: false, name: "name-box" });
    this.nameBox.add(createText({
      x: STATS.x, y: NAME_BOX.y - 56, width: STATS.width,
      text: "Enter your name to save your score",
      fontSize: 24, fill: COLORS.purple,
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
      fontSize: 25,
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
      x: BOARD.x + (BOARD.width - 260) / 2,
      y: NAME_BOX.y - 28,
      width: 260, height: 56,
      fontSize: 22,
      label: "Review Answers",
      name: "review-answers",
      onClick: () => {
        this.reviewModal.show();
        this.refreshNameBox();
        this.showReviewQuestion();
        this.layer.batchDraw();
      },
    }));

    const playAgainButton = createButton({
      x: DESIGN_WIDTH / 2 - 260, y: ACTION_Y,
      width: 240, height: 56,
      label: "Play Again",
      name: "play-again",
      onClick: () => this.playAgains.emit(),
    });
    playAgainButton.findOne<Konva.Rect>(".face")?.fill(COLORS.green);
    this.layer.add(playAgainButton);
    this.layer.add(createButton({
      x: DESIGN_WIDTH / 2 + 20, y: ACTION_Y,
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
    fontSize: 22,
    fill: COLORS.purple
  });

  // Display the expected answer
  this.reviewTotalMistakesText = createText({
    x: 300,
    y: 510,
    width: 840,
    text: "Correct answer: —",
    fontSize: 22,
    fill: COLORS.purple
  });

  //Display question number
  this.reviewCounterText = createText({
    x: 860,
    y: 610,
    width: 300,
    text: "Question 0 of 0",
    fontSize: 22,
    align: "right",
    fill: COLORS.purple
});

//Status Bubble
this.reviewStatusBubble = new Konva.Rect({
    x: 570,
    y: 352,
    width: 300,
    height: 48,
    cornerRadius: 24,
    fill: "#FEE2E2"
});

//Display correct/incorrect status
  this.reviewStatusText = createText({
    x: 570,
    y: 352,
    width: 300,
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
    this.reviewTotalMistakesText,
    this.reviewCounterText,
    this.reviewStatusBubble,
    this.reviewStatusText,
    this.reviewMistakesGroup
  );



  this.reviewModal.add(new Konva.Line({
    points: [280, 650, 1160, 650],
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
        this.refreshNameBox();
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

    //track the current step of each question
    const stepByQuestion = new Map<AnswerRecord["question"], number>();

    // store one review entry per question
    const reviews = new Map<AnswerRecord["question"], ReviewEntry>();

    for (const record of result.history) {
        let review = reviews.get(record.question);

        // create a review entry when we first encounter a question
        if (!review) {
            review = {
                question: record.question,
                solved: false,
                mistakes: []
            };

            reviews.set(record.question, review);
        }

        const previousStep = stepByQuestion.get(record.question) ?? 0;
        const step = record.stepNumber ?? previousStep + 1;

        if (!record.isCorrect) {
            // check whether this step already has a recorded mistake
            const existing = review.mistakes.find(
                mistake => mistake.stepNumber === step
            );

            if (existing) {
                existing.incorrectAttempts++;
            } else {
                review.mistakes.push({
                    stepNumber: step,
                    stepPrompt: record.stepPrompt,
                    firstIncorrectAnswer: record.playerAnswer,
                    correctAnswer: record.correctAnswer,
                    incorrectAttempts: 1
                });
            }
        } else {
            // correct answers advance the step
            stepByQuestion.set(record.question, step);

            // mark the question solved when its final step is correct
            if (record.isLastStep) {
                review.solved = true;
            }
        }
    }

    this.reviewAnswers = [...reviews.values()];


    this.reviewIndex = 0;

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
    this.boardTitle.fill(DIFFICULTY_HEADER_COLORS[snapshot.difficulty]);
    this.renderLeaderboard(leaderboard);
    this.refreshNameBox();
    this.layer.batchDraw();
  }

  private showReviewQuestion(): void {
     const review = this.reviewAnswers[this.reviewIndex];
      // clear previous questions mistake cards
      this.reviewMistakesGroup.destroyChildren();

    if (!review) {
        this.reviewCounterText.text("Question 0 of 0");
        this.reviewQuestionText.text("No answers to review.");
        this.reviewPlayerAnswerText.text("");
        this.reviewTotalMistakesText.text("");
        this.reviewStatusText.text("");
        this.reviewStatusBubble.hide();
        return;
    }

    // determine the question status
    let status: string;
    let backgroundColor: string;
    let textColor: string;

    if (!review.solved) {
        status = "Not solved";
        backgroundColor = "#FEE2E2";
        textColor = "#DC2626";
    } else if (review.mistakes.length > 0) {
        status = "Solved with mistakes";
        backgroundColor = "#FEF3C7";
        textColor = "#92400E";
    } else {
        status = "Solved";
        backgroundColor = "#DCFCE7";
        textColor = "#15803D";
    }

    this.reviewStatusBubble.show();
    this.reviewStatusBubble.fill(backgroundColor);
    this.reviewStatusText.text(status);
    this.reviewStatusText.fill(textColor);

    // show question number and original equation
    this.reviewCounterText.text(
        `Question ${this.reviewIndex + 1} of ${this.reviewAnswers.length}`
    );

    this.reviewQuestionText.text(review.question.prompt);

    // display first incorrect answer for each mistaken step

    // remove the old combined text
    this.reviewPlayerAnswerText.text("");

    if (review.mistakes.length === 0) {
        this.reviewPlayerAnswerText.text("No incorrect attempts!");
        this.reviewTotalMistakesText.text("");
    } else {
        // display up to four mistakes in a two-column grid
        const visibleMistakes = review.mistakes.slice(0, 4);

        visibleMistakes.forEach((mistake, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);

            const x = 300 + column * 430;
            const y = 410 + row * 96;

            const card = new Konva.Group({ x, y });

            card.add(new Konva.Rect({
                width: 410,
                height: 88,
                fill: "#F7F3FC",
                stroke: "#D7CDEA",
                strokeWidth: 2,
                cornerRadius: 10
            }));

            card.add(createText({
                x: 16,
                y: 12,
                width: 378,
                text: `Step ${mistake.stepNumber} — ${mistake.stepPrompt ?? "Choose an operation"}`,
                fontSize: 20,
                fill: COLORS.purple,
                wrap: "none",
                ellipsis: true
            }));

            card.add(createText({
                x: 16,
                y: 49,
                width: 180,
                text: `Your attempt: ${mistake.firstIncorrectAnswer}`,
                fontSize: 18,
                fill: "#B91C1C",
                wrap: "none",
                ellipsis: true
            }));

            card.add(createText({
                x: 212,
                y: 49,
                width: 180,
                text: `Expected: ${mistake.correctAnswer}`,
                fontSize: 18,
                fill: "#15803D",
                wrap: "none",
                ellipsis: true
            }));

            this.reviewMistakesGroup.add(card);
        });

        const totalMistakes = review.mistakes.reduce(
            (total, mistake) => total + mistake.incorrectAttempts,
            0
        );

        this.reviewTotalMistakesText.y(610);
        this.reviewTotalMistakesText.text(
            `Total incorrect attempts: ${totalMistakes}`
        );
    }

}

  onSaveScore(cb: (playerName: string) => void): Unsubscribe {
    return this.saves.add(cb);
  }

  showSaveResult(result: AddEntryResult): void {
    const difficulty = this.result ? DIFFICULTY_LABEL[this.result.snapshot.difficulty] : "";
    switch (result.status) {
      case "ranked":
        this.saveMessage.text(`Saved! You're #${result.rank} on the ${difficulty} leaderboard.`);
        this.saveMessage.fill("#15803d");
        break;
      case "notRanked":
        this.saveMessage.text(`Not on the ${difficulty} leaderboard this time. Try again!`);
        this.saveMessage.fill("#b45309");
        break;
      case "saveFailed":
        this.saveMessage.text("Couldn't save your score: browser storage is full or blocked.");
        this.saveMessage.fill("#b91c1c");
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
      this.layer.add(createText({ x: STATS.x, y, width: STATS.width, text: label, fontStyle: "normal", fill: COLORS.purple }));
      const value = createText({ x: STATS.x, y, width: STATS.width, align: "right", fill: COLORS.purple, name: `stat-${key}` });
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
      this.boardRows.add(createText({ width: BOARD.width, text: "No saved scores yet.", fontStyle: "normal", fill: COLORS.purple }));
      return;
    }
    entries.forEach((entry, i) => {
      const y = i * BOARD.rowHeight;
      const row = new Konva.Group({ y, name: "leaderboard-row" });
      row.add(createText({ width: 48, text: `${i + 1}.`, fontStyle: "normal", fill: COLORS.purple }));
      row.add(createText({ x: 48, width: BOARD.width - 280, text: entry.playerName, fontStyle: "normal", fill: COLORS.purple, ellipsis: true, wrap: "none" }));
      row.add(createText({ x: BOARD.width - 232, width: 120, text: entry.score.toLocaleString("en-US"), align: "right", fill: COLORS.purple }));
      row.add(createText({ x: BOARD.width - 112, width: 112, text: formatTime(entry.timeSpentMs), align: "right", fontStyle: "normal", fill: COLORS.purple }));
      this.boardRows.add(row);
    });
  }

  /** The name box shows only while visible, Escaped, and not saved yet. */
  private refreshNameBox(): void {
    const offered = this.layer.visible() && !this.reviewModal.visible() && this.result?.outcome === "escaped" && !this.saved;
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
