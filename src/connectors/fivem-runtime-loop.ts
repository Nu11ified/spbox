export interface FiveMRuntimeSyncLoopConnector {
  syncAll(): Promise<unknown>;
}

export interface FiveMRuntimeSyncLoopScheduler {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface FiveMRuntimeSyncLoopOptions {
  connector: FiveMRuntimeSyncLoopConnector;
  intervalMs: number;
  scheduler?: FiveMRuntimeSyncLoopScheduler;
  onError?: (error: unknown) => void;
}

export class FiveMRuntimeSyncLoop {
  private readonly connector: FiveMRuntimeSyncLoopConnector;
  private readonly intervalMs: number;
  private readonly scheduler: FiveMRuntimeSyncLoopScheduler;
  private readonly onError?: (error: unknown) => void;
  private handle: unknown;
  private running = false;
  private active: Promise<void> | undefined;
  private lastError: Error | undefined;

  public constructor(options: FiveMRuntimeSyncLoopOptions) {
    if (!Number.isSafeInteger(options.intervalMs) || options.intervalMs <= 0) {
      throw new Error("FiveM runtime sync interval must be a positive integer");
    }

    this.connector = options.connector;
    this.intervalMs = options.intervalMs;
    this.scheduler = options.scheduler ?? nativeScheduler;
    this.onError = options.onError;
  }

  public async start(): Promise<void> {
    if (this.running) {
      return this.drain();
    }

    this.running = true;
    this.handle = this.scheduler.setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    await this.runOnce();
  }

  public stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.handle !== undefined) {
      this.scheduler.clearInterval(this.handle);
      this.handle = undefined;
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getLastError(): Error | undefined {
    return this.lastError;
  }

  public async drain(): Promise<void> {
    await this.active;
  }

  private runOnce(): Promise<void> {
    if (this.active) {
      return this.active;
    }

    const active = this.connector.syncAll()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.lastError = error instanceof Error ? error : new Error(String(error));
        this.onError?.(error);
      })
      .finally(() => {
        this.active = undefined;
      });
    this.active = active;
    return active;
  }
}

const nativeScheduler: FiveMRuntimeSyncLoopScheduler = {
  setInterval(callback, intervalMs) {
    return setInterval(callback, intervalMs);
  },
  clearInterval(handle) {
    clearInterval(handle as NodeJS.Timeout);
  }
};
