import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type RuntimeActionStatus = "submitted" | "completed" | "failed";

export interface CreateActionEnvelopeInput {
  id: string;
  serverId: string;
  actorId: string;
  actionType: string;
  payload: unknown;
  nonce: string;
  idempotencyKey: string;
  createdAt: Date;
  signature?: string;
}

export interface RuntimeActionEnvelope {
  id: string;
  serverId: string;
  actorId: string;
  actionType: string;
  payloadHash: string;
  signature?: string;
  nonce: string;
  idempotencyKey: string;
  status: RuntimeActionStatus;
  createdAt: Date;
  completedAt?: Date;
}

export function createActionEnvelope(input: CreateActionEnvelopeInput): RuntimeActionEnvelope {
  return {
    id: input.id,
    serverId: input.serverId,
    actorId: input.actorId,
    actionType: input.actionType,
    payloadHash: hashPayload(input.payload),
    signature: input.signature,
    nonce: input.nonce,
    idempotencyKey: input.idempotencyKey,
    status: "submitted",
    createdAt: input.createdAt
  };
}

export function signActionEnvelope(envelope: RuntimeActionEnvelope, secret: string): string {
  return createHmac("sha256", secret).update(actionSigningPayload(envelope)).digest("hex");
}

export function verifyActionEnvelopeSignature(envelope: RuntimeActionEnvelope, secret: string): boolean {
  if (!envelope.signature) {
    return false;
  }

  const expected = signActionEnvelope(envelope, secret);
  const actual = Buffer.from(envelope.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);

  return `{${entries.join(",")}}`;
}

export class InMemoryActionBus {
  private readonly actionsById = new Map<string, RuntimeActionEnvelope>();
  private readonly actionsByIdempotencyKey = new Map<string, RuntimeActionEnvelope>();
  private readonly usedNonces = new Set<string>();

  public constructor(private readonly options: {
    verifySignature?: (envelope: RuntimeActionEnvelope) => boolean;
  } = {}) {}

  public submit(envelope: RuntimeActionEnvelope): RuntimeActionEnvelope {
    const idempotencyKey = `${envelope.serverId}:${envelope.idempotencyKey}`;
    const existing = this.actionsByIdempotencyKey.get(idempotencyKey);
    if (existing) {
      if (
        existing.actorId !== envelope.actorId ||
        existing.actionType !== envelope.actionType ||
        existing.payloadHash !== envelope.payloadHash
      ) {
        throw new Error("Idempotency conflict");
      }

      return existing;
    }

    const nonceKey = `${envelope.serverId}:${envelope.nonce}`;
    if (this.usedNonces.has(nonceKey)) {
      throw new Error("Nonce replay");
    }

    if (this.options.verifySignature && !this.options.verifySignature(envelope)) {
      throw new Error("Invalid action signature");
    }

    this.actionsById.set(envelope.id, envelope);
    this.actionsByIdempotencyKey.set(idempotencyKey, envelope);
    this.usedNonces.add(nonceKey);
    return envelope;
  }

  public getById(id: string): RuntimeActionEnvelope | undefined {
    return this.actionsById.get(id);
  }

  public complete(id: string, status: "completed" | "failed", completedAt: Date): RuntimeActionEnvelope {
    const action = this.actionsById.get(id);
    if (!action) {
      throw new Error(`Unknown action: ${id}`);
    }
    if (action.completedAt) {
      throw new Error("Action is already completed");
    }

    const completed: RuntimeActionEnvelope = {
      ...action,
      status,
      completedAt
    };
    this.actionsById.set(id, completed);
    this.actionsByIdempotencyKey.set(`${completed.serverId}:${completed.idempotencyKey}`, completed);
    return completed;
  }
}

function actionSigningPayload(envelope: RuntimeActionEnvelope): string {
  return [
    envelope.serverId,
    envelope.actorId,
    envelope.actionType,
    envelope.payloadHash,
    envelope.nonce,
    envelope.idempotencyKey
  ].join("\n");
}
