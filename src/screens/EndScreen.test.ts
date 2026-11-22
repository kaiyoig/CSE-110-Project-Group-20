import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("konva", () => import("./testing/fakeKonva"));
vi.mock("../text-input/text-input", () => import("./testing/fakeTextInput"));

import type Konva from "konva";
import { EndScreen } from "./EndScreen";
import { Difficulty, type AddEntryResult, type LeaderboardEntry, type LoadResult, type ScoreSnapshot } from "../score";
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

function entry(playerName: string, score: number, isMine = false): LeaderboardEntry {
  return { id: playerName, playerName, difficulty: Difficulty.Medium, score, timeSpentMs: 65_000, date: "2026-11-02T00:00:00.000Z", isMine };
}

function saved(rank: number, isNewBest = true, best = entry("Me", 900, true)): AddEntryResult {
  return { status: "saved", rank, isNewBest, best };
}

function loaded(...entries: LeaderboardEntry[]): LoadResult {
  return { status: "loaded", entries };
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
    screen.setResult(escaped());

    expect((find("outcome") as Konva.Text).text()).toBe("Escaped!");
    expect(nameBoxShown()).toBe(true);
  });

  it.each([[720, 450], [390, 844], [1920, 1080]])(
    "keeps save, review and replay controls separate and inside a %i by %i stage",
    (width, height) => {
      screen = new EndScreen(width, height);
      screen.setResult(escaped());
      const save = find("save");
      const review = find("review-answers");
      const replay = find("play-again");
      const back = find("back-to-start");
      const face = (control: Konva.Node) => (control as Konva.Group).findOne<Konva.Rect>(".face")!;
      expect(save.x() + face(save).width()).toBeLessThan(review.x());
      expect(review.y() + face(review).height() + 4).toBeLessThan(replay.y());
      expect(replay.x() + face(replay).width()).toBeLessThan(back.x());
      const scale = screen.layer.scale();
      for (const control of [save, review, replay, back]) {
        expect(screen.layer.x() + control.x() * scale.x).toBeGreaterThanOrEqual(0);
        expect(screen.layer.y() + control.y() * scale.y).toBeGreaterThanOrEqual(0);
        expect(screen.layer.x() + (control.x() + face(control).width()) * scale.x).toBeLessThanOrEqual(width);
        expect(screen.layer.y() + (control.y() + face(control).height() + 4) * scale.y).toBeLessThanOrEqual(height);
      }
    },
  );

  it("hides name entry during answer review and restores it when review closes", () => {
    screen.setResult(escaped());
    find("review-answers").fire("click");
    expect(nameBoxShown()).toBe(false);
    screen.show();
    expect(nameBoxShown()).toBe(false);
    find("close-review").fire("click");
    expect(nameBoxShown()).toBe(true);
  });

  it("shows Caught!, score 0 and no name box for a Caught Heist", () => {
    screen.setResult(caught());

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
    expect(stat("score")).toBe("0");
    expect(nameBoxShown()).toBe(false);
  });

  it("takes the outcome from result.outcome, not snapshot.caught", () => {
    screen.setResult({ ...escaped(), outcome: "caught" });

    expect((find("outcome") as Konva.Text).text()).toBe("Caught!");
  });

  it("shows the Flawless badge only for an Escaped Heist with no incorrect Answers", () => {
    screen.setResult(escaped());
    expect(find("flawless").visible()).toBe(true);

    screen.setResult(escaped({ incorrectAnswers: 1, flawless: false }));
    expect(find("flawless").visible()).toBe(false);

    screen.setResult(caught({ incorrectAnswers: 0 }));
    expect(find("flawless").visible()).toBe(false);
  });

  it("formats the stats, with Bonus Rooms counted inside Rooms solved", () => {
    screen.setResult(escaped({ score: 1234 }));

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
    screen.setResult(escaped({ difficulty }));

    expect(stat("difficulty")).toBe(label);
  });

  it("keeps zero stats visible", () => {
    screen.setResult(escaped({ score: 0, money: 0, roomsSolved: 0, bonusRoomsSolved: 0, timeSpentMs: 0 }));

    expect(stat("score")).toBe("0");
    expect(stat("money")).toBe("$0.00");
    expect(stat("time")).toBe("00:00:00");
    expect(stat("rooms")).toBe("0");
    expect(stat("bonus")).toBe("0");
  });

  describe("leaderboard", () => {
    function rows(): string[][] {
      return screen.layer.find(".leaderboard-row").map((row) => visibleTexts(row));
    }

    function highlighted(): boolean[] {
      return screen.layer.find(".leaderboard-row").map((row) => (row as Konva.Group).findOne(".mine-highlight") !== undefined);
    }

    it("shows the board as loading for a new result", () => {
      screen.setResult(escaped());

      expect(visibleTexts(screen.layer)).toContain("Loading leaderboard…");
      expect(rows()).toEqual([]);
    });

    it("lists the entries it is given, or says there are none", () => {
      screen.setResult(escaped());
      screen.setLeaderboard(loaded());
      expect(visibleTexts(screen.layer)).toContain("No saved scores yet.");

      screen.setLeaderboard(loaded(entry("Ana", 900), entry("Bo", 500)));
      expect(visibleTexts(screen.layer)).toContain("Leaderboard: Medium");
      expect(rows()).toEqual([["1.", "Ana", "900", "00:01:05"], ["2.", "Bo", "500", "00:01:05"]]);
      expect(visibleTexts(screen.layer)).not.toContain("No saved scores yet.");
      expect(visibleTexts(screen.layer)).not.toContain("Loading leaderboard…");
    });

    it("says so when the board couldn't load", () => {
      screen.setResult(escaped());
      screen.setLeaderboard({ status: "loadFailed" });

      expect(visibleTexts(screen.layer)).toContain("Couldn't load the leaderboard.");
    });

    it("keeps the board when the same result is shown again, and resets it for a new one", () => {
      const result = escaped();
      screen.setResult(result);
      screen.setLeaderboard(loaded(entry("Ana", 900)));

      screen.setResult(result);
      expect(rows()).toHaveLength(1);

      screen.setResult(escaped());
      expect(rows()).toEqual([]);
      expect(visibleTexts(screen.layer)).toContain("Loading leaderboard…");
    });

    it("highlights the current Player's rows", () => {
      screen.setResult(escaped());
      screen.setLeaderboard(loaded(entry("Ana", 900), entry("Me", 800, true), entry("Bo", 500)));

      expect(highlighted()).toEqual([false, true, false]);
    });

    it("pins a saved Personal Best outside the top 10 in the last row, with its Rank", () => {
      const top = Array.from({ length: 10 }, (_, i) => entry(`P${i + 1}`, 1000 - i));
      screen.setResult(escaped());
      screen.showSaveResult(saved(57, true, entry("Me", 10, true)));
      screen.setLeaderboard(loaded(...top));

      const shown = rows();
      expect(shown).toHaveLength(10);
      expect(shown[8]).toEqual(["9.", "P9", "992", "00:01:05"]);
      expect(shown[9]).toEqual(["57.", "Me", "10", "00:01:05"]);
      expect(highlighted()[9]).toBe(true);
    });

    it("doesn't pin a Personal Best that is already on the board", () => {
      const me = entry("Me", 950, true);
      screen.setResult(escaped());
      screen.showSaveResult(saved(2, true, me));
      screen.setLeaderboard(loaded(entry("Ana", 1000), me, entry("Bo", 500)));

      expect(rows().map((row) => row[1])).toEqual(["Ana", "Me", "Bo"]);
    });

    it("drops the pinned row for a new result", () => {
      screen.setResult(escaped());
      screen.showSaveResult(saved(57, true, entry("Me", 10, true)));

      screen.setResult(escaped());
      screen.setLeaderboard(loaded(entry("Ana", 900)));

      expect(rows()).toEqual([["1.", "Ana", "900", "00:01:05"]]);
    });
  });

  describe("saving", () => {
    function saveButton(): Konva.Group {
      return find("save") as Konva.Group;
    }

    function prompt(): string {
      return (find("name-prompt") as Konva.Text).text();
    }

    it("caps the name box at the database's name length", () => {
      expect(input.options.maxLength).toBe(20);
    });

    it("entering a name calls onSaveScore once, and greys out Save until the result comes back", () => {
      const onSaveScore = vi.fn();
      screen.onSaveScore(onSaveScore);
      screen.setResult(escaped());

      input.enter("  Ana  ");
      expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Ana");
      expect(nameBoxShown()).toBe(true);
      expect(saveButton().opacity()).toBe(0.5);
      expect(saveButton().listening()).toBe(false);
      expect(visibleTexts(saveButton())).toEqual(["Saving…"]);

      input.enter("Ana again");
      saveButton().fire("click");
      expect(onSaveScore).toHaveBeenCalledOnce();
    });

    it("hides the name box once saved", () => {
      const onSaveScore = vi.fn();
      screen.onSaveScore(onSaveScore);
      screen.setResult(escaped());
      input.enter("Ana");

      screen.showSaveResult(saved(1));

      expect(nameBoxShown()).toBe(false);
      input.enter("Ana again");
      expect(onSaveScore).toHaveBeenCalledOnce();
    });

    it("offers the name box again with an error after a failed save, and lets the player retry", () => {
      const onSaveScore = vi.fn();
      screen.onSaveScore(onSaveScore);
      screen.setResult(escaped());
      input.enter("Ana");

      screen.showSaveResult({ status: "saveFailed" });

      expect(nameBoxShown()).toBe(true);
      expect(prompt()).toBe("Couldn't save your score. Try again.");
      expect(saveButton().opacity()).toBe(1);
      expect(visibleTexts(saveButton())).toEqual(["Save"]);
      expect((find("save-message") as Konva.Text).visible()).toBe(false);

      saveButton().fire("click");
      expect(onSaveScore).toHaveBeenCalledTimes(2);
      expect(prompt()).toBe("Enter your name to save your score");
    });

    it("fills the name box with the suggested name for each new result", () => {
      screen.suggestName("Ana");
      screen.setResult(escaped());
      expect(input.text()).toBe("Ana");

      input.value = "typed";
      screen.setResult(escaped());
      expect(input.text()).toBe("Ana");
    });
  });

  describe("showSaveResult", () => {
    function message(): { shown: boolean; text: string } {
      const node = find("save-message") as Konva.Text;
      return { shown: node.visible(), text: node.text() };
    }

    it("shows the Rank of a new Personal Best", () => {
      screen.setResult(escaped());
      screen.showSaveResult(saved(2));

      expect(message()).toEqual({ shown: true, text: "New Personal Best! You're #2 on the Medium leaderboard." });
    });

    it("says the Personal Best still stands when the run was worse", () => {
      screen.setResult(escaped());
      screen.showSaveResult(saved(3, false));

      expect(message()).toEqual({ shown: true, text: "Saved. Your Personal Best is still #3 on Medium." });
    });

    it("adds a nudge when the Rank is outside the top 10", () => {
      screen.setResult(escaped());
      screen.showSaveResult(saved(10));
      expect(message().text).toBe("New Personal Best! You're #10 on the Medium leaderboard.");

      screen.showSaveResult(saved(11));
      expect(message().text).toBe("New Personal Best! You're #11 on the Medium leaderboard. Top 10 next time!");

      screen.showSaveResult(saved(42, false));
      expect(message().text).toBe("Saved. Your Personal Best is still #42 on Medium. Top 10 next time!");
    });

    it("says so when the score saved but the Rank couldn't load", () => {
      screen.setResult(escaped());
      screen.showSaveResult({ status: "savedUnranked" });

      expect(message()).toEqual({ shown: true, text: "Saved! Couldn't load the leaderboard to show your rank." });
    });

    it("keeps the message when the board refreshes or the same result is shown again", () => {
      const result = escaped();
      screen.setResult(result);
      screen.showSaveResult(saved(1));

      screen.setLeaderboard(loaded(entry("Ana", result.snapshot.score)));
      screen.setResult(result);

      expect(message().shown).toBe(true);
    });

    it("clears the message for a new result", () => {
      screen.setResult(escaped());
      screen.showSaveResult(saved(1));

      screen.setResult(escaped());

      expect(message().shown).toBe(false);
    });
  });

  it("the Save button saves the typed name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped());

    input.value = "Bo";
    find("save").fire("click");

    expect(onSaveScore).toHaveBeenCalledExactlyOnceWith("Bo");
  });

  it("ignores an empty name", () => {
    const onSaveScore = vi.fn();
    screen.onSaveScore(onSaveScore);
    screen.setResult(escaped());

    input.enter("   ");

    expect(onSaveScore).not.toHaveBeenCalled();
    expect(nameBoxShown()).toBe(true);
  });

  it("offers the name box again for a new result", () => {
    screen.onSaveScore(() => {});
    screen.setResult(escaped());
    input.enter("Ana");

    screen.setResult(escaped());

    expect(nameBoxShown()).toBe(true);
  });

  it("hides the name box's input while the screen is hidden", () => {
    screen.setResult(escaped());

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
        screen.setResult({ ...escaped(), history });
        find("review-answers").fire("click");
    }

    //Test 1: Modal should stay hidden until clicked
    it("starts hidden and opens when Review Answers is clicked", () => {
        screen.setResult(escaped());

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

    //Test 3: Display question and first incorrect answer attempt
    it("displays the question, player answer, and correct answer", () => {
    const question = {
        prompt: "3x + 2 = 17",
        answer: "5"
    };

    openReview([answer(question, "4", false)]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("3x + 2 = 17");
    expect(texts).toContain("Your attempt: 4");
    expect(texts).toContain("Expected: 5");
    expect(texts).toContain("Question 1 of 1");
    expect(texts).toContain("Not solved");

    //check one mistake card was created
    expect((find("review-mistakes") as Konva.Group).getChildren()
    ).toHaveLength(1);
    });

    //Test 4: Display correct status
    it("shows Solved for a correctly answered question", () => {
    const question = {
        prompt: "6 + 2 = ?",
        answer: "8"
    };

    openReview([answer(question, "8", true)]);

    const texts = visibleTexts(screen.layer);


    expect(texts).toContain("Solved");
    expect(texts).toContain("No incorrect attempts!");
    expect(texts).toContain("Question 1 of 1");

    //no mistake cards should be created
    expect((find("review-mistakes") as Konva.Group).getChildren()
    ).toHaveLength(0);
    });

    //Test 5: Verify questions display in order and update their status
    it("displays incorrect questions in order with their correct status", () => {
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

    // first question was solved correctly
        let texts = visibleTexts(screen.layer);

        expect(texts).toContain("2 + 6 = ?");
        expect(texts).toContain("Solved");
        expect(texts).toContain("Question 1 of 2");

        expect(
            (find("review-mistakes") as Konva.Group).getChildren()
        ).toHaveLength(0);

        // navigate to the incorrect question
        find("review-next").fire("click");

        texts = visibleTexts(screen.layer);

        expect(texts).toContain("5 x 3 = ?");
        expect(texts).toContain("Not solved");
        expect(texts).toContain("Your attempt: 12");
        expect(texts).toContain("Expected: 15");
        expect(texts).toContain("Question 2 of 2");

        expect((find("review-mistakes") as Konva.Group).getChildren()
        ).toHaveLength(1);
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

//Test 8: Intermediate steps should be displayed even if question is solved
it("tracks intermediate mistakes when final answer is correct", () => {
    const question = {
      prompt: "3x + 2 = 17",
      answer: "5"
    };

    openReview([
      answer(question, "4", false, false),
      answer(question, "5", true, false),
      answer(question, "5", true, true)
    ]);

  const texts = visibleTexts(screen.layer);

  expect(texts).toContain("3x + 2 = 17");
  expect(texts).toContain("Solved with mistakes");
  expect(texts).toContain("Question 1 of 1");

  // earlier mistake should still be visible
  expect(texts).toContain("Your attempt: 4");
  expect(texts).toContain("Expected: 5");
  expect(texts).toContain("Total incorrect attempts: 1");

  expect((find("review-mistakes") as Konva.Group).getChildren()
  ).toHaveLength(1);
});

//Test 9: Repeated incorrect attempts should be grouped into one card
it("groups repeated mistakes for same step", () => {
    const question = {
        prompt: "3x + 2 = 17",
        answer: "5"
    };

    openReview([
        answer(question, "4", false),
        answer(question, "3", false),
        answer(question, "5", true)
    ]);

    const texts = visibleTexts(screen.layer);

    expect(texts).toContain("Question 1 of 1");
    expect(texts).toContain("Solved with mistakes");

    //verify only first incorrect attempt is displayed
    expect(texts).toContain("Your attempt: 4");
    expect(texts).not.toContain("Your attempt: 3");
    expect(texts).toContain("Expected: 5");

    // Both incorrect submissions should be counted
    expect(texts).toContain("Total incorrect attempts: 2");

    // Only one card because both mistakes occurred on Step 1
    expect((find("review-mistakes") as Konva.Group).getChildren()
    ).toHaveLength(1);
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
    });

    expect(find("review-modal").visible()).toBe(false);

    find("review-answers").fire("click");

    expect(visibleTexts(screen.layer)).toContain("New game question");
    expect(visibleTexts(screen.layer)).toContain("Question 1 of 1");
});

//Test 12: Has pagination when there is more than 4 mistakes
it("paginates when a question has more than four mistakes", () => {
  const question = {
    prompt: "x + 3 = 8",
    answer: "5"
  };

  const history: AnswerRecord[] = Array.from(
    { length: 5 },
    (_, index) => ({
      question,
      playerAnswer: `wrong-${index + 1}`,
      correctAnswer: "-",
      isCorrect: false,
      isLastStep: false,
      stepNumber: index + 1,
      stepPrompt: `Operation ${index + 1}`
    })
  );

  openReview(history);

  const cards = () =>
    (find("review-mistakes") as Konva.Group).getChildren();

  // first page shows four mistakes
  expect(cards()).toHaveLength(4);
  expect(visibleTexts(screen.layer)).toContain("Page 1 of 2");

  // navigate to second page
  find("review-page-next").fire("click");

  expect(cards()).toHaveLength(1);
  expect(visibleTexts(screen.layer)).toContain("Page 2 of 2");
  expect(visibleTexts(screen.layer)).toContain(
    "Step 5 — Operation 5"
  );

  // navigate back to first page
  find("review-page-previous").fire("click");

  expect(cards()).toHaveLength(4);
  expect(visibleTexts(screen.layer)).toContain("Page 1 of 2");
});

});

});
