import { describe, expect, it } from "vitest";
import {
  createActionEnvelope,
  InMemoryActionBus,
  signActionEnvelope,
  verifyActionEnvelopeSignature
} from "../src/core/actions.js";

describe("runtime action envelopes", () => {
  it("hashes canonical payloads independent of key order", () => {
    const first = createActionEnvelope({
      id: "action-1",
      serverId: "server-1",
      actorId: "player:1",
      actionType: "economy.transfer",
      payload: { to: "b", amount: 50, from: "a" },
      nonce: "nonce-1",
      idempotencyKey: "idem-1",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });
    const second = createActionEnvelope({
      id: "action-2",
      serverId: "server-1",
      actorId: "player:1",
      actionType: "economy.transfer",
      payload: { amount: 50, from: "a", to: "b" },
      nonce: "nonce-2",
      idempotencyKey: "idem-2",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    expect(first.payloadHash).toBe(second.payloadHash);
  });

  it("rejects idempotency key reuse with a different payload hash", () => {
    const bus = new InMemoryActionBus();
    bus.submit(
      createActionEnvelope({
        id: "action-1",
        serverId: "server-1",
        actorId: "player:1",
        actionType: "economy.transfer",
        payload: { amount: 50 },
        nonce: "nonce-1",
        idempotencyKey: "idem-1",
        createdAt: new Date("2026-05-18T00:00:00.000Z")
      })
    );

    expect(() =>
      bus.submit(
        createActionEnvelope({
          id: "action-2",
          serverId: "server-1",
          actorId: "player:1",
          actionType: "economy.transfer",
          payload: { amount: 5000 },
          nonce: "nonce-2",
          idempotencyKey: "idem-1",
          createdAt: new Date("2026-05-18T00:00:01.000Z")
        })
      )
    ).toThrow("Idempotency conflict");
  });

  it("signs envelopes and rejects invalid signatures or nonce replay", () => {
    const secret = "server-secret";
    const envelope = createActionEnvelope({
      id: "action-1",
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });
    const signed = {
      ...envelope,
      signature: signActionEnvelope(envelope, secret)
    };
    const bus = new InMemoryActionBus({
      verifySignature: (candidate) => verifyActionEnvelopeSignature(candidate, secret)
    });

    expect(verifyActionEnvelopeSignature(signed, secret)).toBe(true);
    expect(bus.submit(signed)).toBe(signed);
    expect(() => bus.submit({ ...signed, id: "action-2", idempotencyKey: "repair-11" })).toThrow("Nonce replay");
    expect(() =>
      bus.submit({
        ...signed,
        id: "action-3",
        nonce: "nonce-2",
        idempotencyKey: "repair-12",
        signature: "bad-signature"
      })
    ).toThrow("Invalid action signature");
  });

  it("scopes nonce replay protection to the runtime server", () => {
    const bus = new InMemoryActionBus();
    const first = createActionEnvelope({
      id: "action-1",
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-shared",
      idempotencyKey: "server-1:repair-10",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });
    const second = createActionEnvelope({
      id: "action-2",
      serverId: "server-2",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-shared",
      idempotencyKey: "server-2:repair-10",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    expect(bus.submit(first)).toBe(first);
    expect(bus.submit(second)).toBe(second);
    expect(() =>
      bus.submit({
        ...first,
        id: "action-3",
        idempotencyKey: "server-1:repair-11"
      })
    ).toThrow("Nonce replay");
  });

  it("scopes idempotency keys to the runtime server", () => {
    const bus = new InMemoryActionBus();
    const first = createActionEnvelope({
      id: "action-1",
      serverId: "server-1",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 10 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });
    const second = createActionEnvelope({
      id: "action-2",
      serverId: "server-2",
      actorId: "player:1",
      actionType: "vehicle.repair",
      payload: { netId: 20 },
      nonce: "nonce-1",
      idempotencyKey: "repair-10",
      createdAt: new Date("2026-05-18T00:00:00.000Z")
    });

    expect(bus.submit(first)).toBe(first);
    expect(bus.submit(second)).toBe(second);
    expect(() =>
      bus.submit({
        ...first,
        id: "action-3",
        nonce: "nonce-2",
        payloadHash: createActionEnvelope({
          ...first,
          id: "action-conflict",
          payload: { netId: 99 }
        }).payloadHash
      })
    ).toThrow("Idempotency conflict");
  });
});
