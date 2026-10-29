// new event types should be added here
export enum EventType {
  Correct = "correct",
  Incorrect = "incorrect",
  GameStart = "gameStart",
  GameOver = "gameOver"
}

export interface Event {
  eventType: EventType;
  additionalInfo?: string;
}
