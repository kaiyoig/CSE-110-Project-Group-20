import { Event, EventType } from "./Event"

export type Handler = (event: Event) => void;

export class NotificationManager {
  private handlers = new Map<EventType, Set<Handler>>();
  
  private pending: Event[] = []; // list of pending events to handle
  private dispatching = false; // tracks whether send is already handling events

  subscribe(type: EventType, handler: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) { this.handlers.set(type, (set = new Set())); }

    set.add(handler);
    return () => set.delete(handler);
  }

  send(event: Event): void {
    // TODO
  }
}
