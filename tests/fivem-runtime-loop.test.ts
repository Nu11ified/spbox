import { describe, expect, it } from "vitest";
import {
  FiveMRuntimeSyncLoop,
  type FiveMRuntimeSyncLoopScheduler
} from "../src/connectors/fivem-runtime-loop.js";

class ManualScheduler implements FiveMRuntimeSyncLoopScheduler {
  private nextId = 0;
  private readonly callbacks = new Map<number, () => void>();

  public setInterval(callback: () => void, _intervalMs: number): number {
    const id = ++this.nextId;
    this.callbacks.set(id, callback);
    return id;
  }

  public clearInterval(id: number): void {
    this.callbacks.delete(id);
  }

  public tick(id = 1): void {
    this.callbacks.get(id)?.();
  }

  public has(id = 1): boolean {
    return this.callbacks.has(id);
  }
}

describe("FiveMRuntimeSyncLoop", () => {
  it("runs syncAll immediately and then on the configured interval", async () => {
    const scheduler = new ManualScheduler();
    const calls: string[] = [];
    const loop = new FiveMRuntimeSyncLoop({
      intervalMs: 250,
      scheduler,
      connector: {
        async syncAll() {
          calls.push("sync");
          return { ok: true };
        }
      }
    });

    await loop.start();
    scheduler.tick();
    await loop.drain();

    expect(calls).toEqual(["sync", "sync"]);
    expect(loop.isRunning()).toBe(true);
  });

  it("does not overlap sync passes when an interval fires during an active pass", async () => {
    const scheduler = new ManualScheduler();
    let release: (() => void) | undefined;
    const calls: string[] = [];
    const loop = new FiveMRuntimeSyncLoop({
      intervalMs: 250,
      scheduler,
      connector: {
        async syncAll() {
          calls.push("sync");
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      }
    });

    const start = loop.start();
    scheduler.tick();
    expect(calls).toEqual(["sync"]);
    release?.();
    await start;
    await loop.drain();

    expect(calls).toEqual(["sync"]);
  });

  it("records sync failures and keeps the loop running", async () => {
    const scheduler = new ManualScheduler();
    const errors: string[] = [];
    let attempt = 0;
    const loop = new FiveMRuntimeSyncLoop({
      intervalMs: 250,
      scheduler,
      onError(error) {
        errors.push(error instanceof Error ? error.message : String(error));
      },
      connector: {
        async syncAll() {
          attempt += 1;
          if (attempt === 1) {
            throw new Error("sync failed");
          }
          return { ok: true };
        }
      }
    });

    await loop.start();
    scheduler.tick();
    await loop.drain();

    expect(errors).toEqual(["sync failed"]);
    expect(attempt).toBe(2);
    expect(loop.getLastError()?.message).toBe("sync failed");
    expect(loop.isRunning()).toBe(true);
  });

  it("stops scheduled sync ticks", async () => {
    const scheduler = new ManualScheduler();
    const calls: string[] = [];
    const loop = new FiveMRuntimeSyncLoop({
      intervalMs: 250,
      scheduler,
      connector: {
        async syncAll() {
          calls.push("sync");
        }
      }
    });

    await loop.start();
    loop.stop();
    scheduler.tick();
    await loop.drain();

    expect(scheduler.has()).toBe(false);
    expect(calls).toEqual(["sync"]);
    expect(loop.isRunning()).toBe(false);
  });
});
