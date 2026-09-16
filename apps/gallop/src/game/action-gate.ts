// One request per press: while a JUMP or COLLECT is in flight, further presses are ignored (client spec
// "One request per press"). A lost response is retried with the same action key by the service.

export class ActionGate {
  private busy = false;

  get inFlight() {
    return this.busy;
  }

  /** Runs `task` unless one is already running; returns null when the press was ignored. */
  async run<T>(task: () => Promise<T>): Promise<T | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      return await task();
    } finally {
      this.busy = false;
    }
  }
}
