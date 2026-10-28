// new event types should be added here
export enum EventType {
  Correct,
  Incorrect
}

export interface Event {
  eventType: EventType;
  additionalInfo?: string;
}
