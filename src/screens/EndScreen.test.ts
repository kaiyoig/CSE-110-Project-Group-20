import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../text-input/text-input", () => import("./testing/fakeTextInput"));

import type Konva from "konva";
import { EndScreen } from "./EndScreen";
import { Difficulty, type LeaderboardEntry, type ScoreSnapshot } from "../score";
import type { HeistResult } from "../game/Game";
import { visibleTexts } from "./testing/fakeKonva";
import { created, type FakeTextInput } from "./testing/fakeTextInput";
import type { AnswerRecord } from "../validation/AnswerHistory";

// Cases carried over from #28's GameResults tests (Asad).

function snapshot(overrides: Partial<ScoreSnapshot> = {}): ScoreSnapshot {
  return {
    difficulty: Difficulty.Medium,
    money: 1200,
    roomsSolved: 2,
    bonusRoomsSolved: 1,
    weightedCorrect: 4,
    incorrectAnswers: 0,
    timeLimitMs: 3_600_000,
    timeRemainingMs: 3_535_000,
    timeSpentMs: 65_000,
    caught: false,
    flawless: true,
    score: 50_904,
    ...overrides,
  };
}

function escaped(overrides: Partial<ScoreSnapshot> = {}): HeistResult {
  return { outcome: "escaped", snapshot: snapshot(overrides), history: [] };
}

function caught(overrides: Partial<ScoreSnapshot> = {}): HeistResult {
  return {
    outcome: "caught",
    snapshot: snapshot({ caught: true, flawless: false, score: 0, timeRemainingMs: 0, ...overrides }),
    history: [],
  };
}

function entry(playerName: string, score: number): LeaderboardEntry {
  return { playerName, difficulty: Difficulty.Medium, score, timeSpentMs: 65_000, date: "2026-11-02T00:00:00.000Z" };
}

describe("EndScreen", () => {
  let screen: EndScreen;
  let input: FakeTextInput;

  function find(name: string): Konva.Node {
    const node = screen.layer.findOne(`.${name}`);
    if (!node) throw new Error(`no .${name}`);
    return node;
  }

  function stat(key: string): string {
    return (find(`stat-${key}`) as Konva.Text).text();
  }

  function nameBoxShown(): boolean {
    return find("name-box").visible() && input.visible();
  }

  beforeEach(() => {
    created.length = 0;
    screen = new EndScreen(1440, 900);
    input = created[0];
    screen.show();
  });

  it("shows Escaped! and the name box for an Escaped Heist", () => {
    screen.setResult(escaped(), []);

    expect((find("outcome") as Konva.Text).text()).toBe("Escaped!");
    expect(nameBoxShown()).toBe(true);
  });

  it("shows Caught!, score 0 and no name box for a Caught Heist", () => {
    screen.setResult(caught(), []);

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
    expect(stat("score")).toBe("0");
    expect(nameBoxShown()).toBe(false);
  });

  it("takes the outcome from result.outcome, not snapshot.caught", () => {
    screen.setResult({ ...escaped(), outcome: "caught" }, []);

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
  });

  it("shows the Flawless badge only for an Escaped Heist with no incorrect Answers", () => {
    screen.setResult(escaped(), []);
    expect(find("flawless").visible()).toBe(true);

    screen.setResult(escaped({ incorrectAnswers: 1, flawless: false }), []);
    expect(find("flawless").visible()).toBe(false);

    screen.setResult(caught({ incorrectAnswers: 0 }), []);
    expect(find("flawless").visible()).toBe(false);
  });

  it("formats the stats, with Bonus Rooms counted inside Rooms solved", () => {
    screen.setResult(escaped({ score: 1234 }), []);

    expect(stat("score")).toBe("1,234");
    expect(stat("money")).toBe("$1,200.00");
    expect(stat("time")).toBe("00:01:05");
    expect(stat("difficulty")).toBe("Medium");
    expect(stat("rooms")).toBe("2");
    expect(stat("bonus")).toBe("1");
    expect(stat("incorrect")).toBe("0");
  });

  it.each([
    [Difficulty.Easy, "Easy"],
    [Difficulty.Medium, "Medium"],
    [Difficulty.Hard, "Hard"],
  ])("labels Difficulty %s as %s", (difficulty, label) => {
    screen.setResult(escaped({ difficulty }), []);

    expect(stat("difficulty")).toBe(label);
  });

  it("keeps zero stats visible", () => {
    screen.setResult(escaped({ score: 0, money: 0, roomsSolved: 0, bonusRoomsSolved: 0, timeSpentMs: 0 }), []);

    expect(stat("score")).toBe("0");
    expect(stat("money")).toBe("$0.00");
    expect(stat("time")).toBe("00:00:00");
    expect(stat("rooms")).toBe("0");
    expect(stat("bonus")).toBe("0");
  });

  it("lists the leaderboard entries it is given, or says there are none", () => {
    screen.setResult(escaped(), []);
    expect(visibleTexts(screen.layer)).toContain("No saved scores yet.");

    screen.setResult(escaped(), [entry("Ana", 900), entry("Bo", 500)]);
    const texts = visibleTexts(screen.layer);
    expect(texts).toEqual(expect.arrayContaining(["Leaderboard: Medium", "1.", "Ana", "900", "2.", "Bo", "500"]));
    expect(texts).not.toContain("No saved scores yet.");
  });

  it("entering a name calls onSaveScore; after the next setResult the box is gone and the entry is listed", () => {
    const result = escaped();
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(result, []);

    input.enter("  Ana  ");
    expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Ana");

    screen.setResult(result, [entry("Ana", result.snapshot.score)]);
    expect(nameBoxShown()).toBe(false);
    expect(visibleTexts(screen.layer)).toContain("Ana");

    input.enter("Ana again");
    expect(onSaveScore).toHaveBeenCalledOnce();
  });

  describe("showSaveResult", () => {
    function message(): { shown: boolean; text: string } {
      const node = find("save-message") as Konva.Text;
      return { shown: node.visible(), text: node.text() };
    }

    it("shows the rank when the score made the board", () => {
      screen.setResult(escaped(), []);
      screen.showSaveResult({ status: "ranked", rank: 2 });

      expect(message()).toEqual({ shown: true, text: "Saved! You're #2 on the Medium leaderboard." });
    });

    it("says so when the score didn't make the board", () => {
      screen.setResult(escaped(), []);
      screen.showSaveResult({ status: "notRanked" });

      expect(message()).toEqual({ shown: true, text: "Not on the Medium leaderboard this time. Try again!" });
    });

    it("says so when saving failed", () => {
      screen.setResult(escaped(), []);
      screen.showSaveResult({ status: "saveFailed" });

      expect(message().shown).toBe(true);
      expect(message().text).toContain("Couldn't save your score");
    });

    it("keeps the message when the same result is shown again (the leaderboard refresh)", () => {
      const result = escaped();
      screen.setResult(result, []);
      screen.showSaveResult({ status: "ranked", rank: 1 });

      screen.setResult(result, [entry("Ana", result.snapshot.score)]);

      expect(message().shown).toBe(true);
    });

    it("clears the message for a new result", () => {
      screen.setResult(escaped(), []);
      screen.showSaveResult({ status: "ranked", rank: 1 });

      screen.setResult(escaped(), []);

      expect(message().shown).toBe(false);
    });
  });

  it("the Save button saves the typed name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped(), []);

    input.value = "Bo";
    find("save").fire("click");

    expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Bo");
  });

  it("ignores an empty name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped(), []);

    input.enter("   ");

    expect(onSaveScore).not.toHaveBeenCalled();
    expect(nameBoxShown()).toBe(true);
  });

  it("offers the name box again for a new result", () => {
    screen.onSaveScore(() => {});
    screen.setResult(escaped(), []);
    input.enter("Ana");

    screen.setResult(escaped(), []);

    expect(nameBoxShown()).toBe(true);
  });

  it("hides the name box's input while the screen is hidden", () => {
    screen.setResult(escaped(), []);

    screen.hide();
    expect(input.visible()).toBe(false);

    screen.show();
    expect(input.visible()).toBe(true);
  });

  it("Play Again and Back to Start fire their own callbacks", () => {
    const onPlayAgain = vi.fn();
    const onBackToStart = vi.fn();
    screen.onPlayAgain(onPlayAgain);
    screen.onBackToStart(onBackToStart);

    find("play-again").fire("click");
    expect(onPlayAgain).toHaveBeenCalledOnce();
    expect(onBackToStart).not.toHaveBeenCalled();

    find("back-to-start").fire("click");
    expect(onBackToStart).toHaveBeenCalledOnce();
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it("stops calling callbacks once unsubscribed", () => {
    const onPlayAgain = vi.fn();
    screen.onPlayAgain(onPlayAgain)();

    find("play-again").fire("click");

    expect(onPlayAgain).not.toHaveBeenCalled();
  });


  describe("Review Answers", () => {

    function answer(
        question: AnswerRecord["question"],
        playerAnswer: string,
        isCorrect: boolean,
        isLastStep = true
    ): AnswerRecord {
        return {
            question,
            playerAnswer,
            correctAnswer: question.answer,
            isCorrect,
            isLastStep
        };
    }

    function openReview(history: AnswerRecord[] = []): void {
        screen.setResult({ ...escaped(), history }, []);
        find("review-answers").fire("click");
    }

    //Test 1: Modal should stay hidden until clicked
    it("starts hidden and opens when Review Answers is clicked", () => {
        screen.setResult(escaped(), []);

        expect(find("review-modal").visible()).toBe(false);

        find("review-answers").fire("click");

        expect(find("review-modal").visible()).toBe(true);
    });

    //Test 2: Modal should close when button is clicked
    it("closes the Review Answers modal", () => {
    openReview();

    expect(find("review-modal").visible()).toBe(true);

    find("close-review").fire("click");

    expect(find("review-modal").visible()).toBe(false);
    });

    //Test 3: Displayes question and Answer
    it("displays the question, player answer, and correct answer", () => {
    const question = {
        prompt: "3x + 2 = 17",
        answer: "5"
    };

    openReview([answer(question, "4", false)]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("3x + 2 = 17");
    expect(texts).toContain("Your answer: 4");
    expect(texts).toContain("Correct answer: 5");
    expect(texts).toContain("Question 1 of 1");
    expect(texts).toContain("Incorrect");
    });

    //Test 4: Display correct status
    it("shows Correct! for a correct answer", () => {
    const question = {
        prompt: "6 + 2 = ?",
        answer: "8"
    };

    openReview([answer(question, "8", true)]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("Correct!");
    expect(texts).not.toContain("Incorrect");
    });

    //Test 5: Incorrect questions shoud display first
    it("displays incorrect questions before correct questions", () => {
    const correctQuestion = {
        prompt: "2 + 6 = ?",
        answer: "8"
    };

    const incorrectQuestion = {
        prompt: "5 x 3 = ?",
        answer: "15"
    };

    openReview([
        answer(correctQuestion, "8", true),
        answer(incorrectQuestion, "12", false)
    ]);

    // incorrect question should display first
    expect(visibleTexts(screen.layer)).toContain("5 x 3 = ?");
    expect(visibleTexts(screen.layer)).toContain("Incorrect");

    find("review-next").fire("click");

    expect(visibleTexts(screen.layer)).toContain("2 + 6 = ?");
    expect(visibleTexts(screen.layer)).toContain("Correct!");   
    });

    //Test 6: Next and Previous Buttons
    it("navigates between questions using Next and Previous", () => {
    const q1 = { prompt: "1 + 1 = ?", answer: "2" };
    const q2 = { prompt: "2 + 2 = ?", answer: "4" };
    const q3 = { prompt: "3 + 3 = ?", answer: "6" };

    openReview([
        answer(q1, "2", true),
        answer(q2, "4", true),
        answer(q3, "6", true)
    ]);

    expect(visibleTexts(screen.layer)).toContain("Question 1 of 3");

    find("review-next").fire("click");

    expect(visibleTexts(screen.layer)).toContain("2 + 2 = ?");
    expect(visibleTexts(screen.layer)).toContain("Question 2 of 3");

    find("review-previous").fire("click");

    expect(visibleTexts(screen.layer)).toContain("1 + 1 = ?");
    expect(visibleTexts(screen.layer)).toContain("Question 1 of 3");
  });

  //Test 7: Can't navigate if out of bounds
  it("does not navigate before the first or after the last question", () => {
    const q1 = { prompt: "1 + 1 = ?", answer: "2" };
    const q2 = { prompt: "2 + 2 = ?", answer: "4" };

    openReview([
        answer(q1, "2", true),
        answer(q2, "4", true)
    ]);

    find("review-previous").fire("click");

    expect(visibleTexts(screen.layer)).toContain("Question 1 of 2");

    find("review-next").fire("click");

    expect(visibleTexts(screen.layer)).toContain("Question 2 of 2");

    find("review-next").fire("click");

    expect(visibleTexts(screen.layer)).toContain("Question 2 of 2");
    expect(visibleTexts(screen.layer)).toContain("2 + 2 = ?");
});

//Test 8: Intermediate steps shouldn't be displayed
it("only displays final-step answers", () => {
    const intermediate = {
        prompt: "Intermediate question",
        answer: "2"
    };

    const finalQuestion = {
        prompt: "Final question",
        answer: "5"
    };

    openReview([
        answer(intermediate, "2", true, false),
        answer(finalQuestion, "5", true, true)
    ]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("Final question");
    expect(texts).not.toContain("Intermediate question");
    expect(texts).toContain("Question 1 of 1");
});

//Test 9: No Duplicate submissions
it("keeps only the latest final submission for a question", () => {
    const question = {
        prompt: "3x + 2 = 17",
        answer: "5"
    };

    openReview([
        answer(question, "4", false),
        answer(question, "5", true)
    ]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("Question 1 of 1");
    expect(texts).toContain("Your answer: 5");
    expect(texts).toContain("Correct!");
    expect(texts).not.toContain("Your answer: 4");
});

//Test 10: Empty History
it("handles an empty answer history", () => {
    openReview([]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("No answers to review.");
    expect(texts).toContain("Question 0 of 0");
    expect(texts).not.toContain("Correct!");
    expect(texts).not.toContain("Incorrect");

    find("review-next").fire("click");
    find("review-previous").fire("click");

    expect(visibleTexts(screen.layer)).toContain(
        "No answers to review."
    );
});

//Test 11: New Game Reset Review
it("resets the review when a new game result arrives", () => {
    const q1 = { prompt: "First question", answer: "2" };
    const q2 = { prompt: "Second question", answer: "4" };
    const q3 = { prompt: "New game question", answer: "6" };

    openReview([
        answer(q1, "2", true),
        answer(q2, "4", true)
    ]);

    find("review-next").fire("click");

    expect(visibleTexts(screen.layer)).toContain("Question 2 of 2");

    // New Game
    screen.setResult({
        ...escaped(),
        history: [answer(q3, "6", true)]
    }, []);

    expect(find("review-modal").visible()).toBe(false);

    find("review-answers").fire("click");

    expect(visibleTexts(screen.layer)).toContain("New game question");
    expect(visibleTexts(screen.layer)).toContain("Question 1 of 1");
});


});

});
