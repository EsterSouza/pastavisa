import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const PLAN_TOKEN_TTL_SECONDS = 2 * 60 * 60;

interface TokenEnvelope<T> {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  plan: T;
}

export class InvalidPlanTokenError extends Error {
  constructor(message = "Token de planejamento inválido.") {
    super(message);
    this.name = "InvalidPlanTokenError";
  }
}

function signingSecret(value?: string): string {
  const secret = value ?? process.env.PLANNER_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("PLANNER_SIGNING_SECRET não configurado.");
  return secret;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function signPlan<T>(
  plan: T,
  options: { secret?: string; now?: number } = {}
): string {
  const issuedAt = Math.floor(options.now ?? Date.now() / 1000);
  const envelope: TokenEnvelope<T> = {
    version: 1,
    issuedAt,
    expiresAt: issuedAt + PLAN_TOKEN_TTL_SECONDS,
    plan,
  };
  const payload = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  const digest = signature(payload, signingSecret(options.secret)).toString("base64url");
  return `${payload}.${digest}`;
}

export function verifyPlan<T>(
  token: string,
  options: { secret?: string; now?: number } = {}
): TokenEnvelope<T> {
  const [payload, encodedDigest, extra] = token.split(".");
  if (!payload || !encodedDigest || extra) throw new InvalidPlanTokenError();

  const expected = signature(payload, signingSecret(options.secret));
  let received: Buffer;
  try {
    received = Buffer.from(encodedDigest, "base64url");
  } catch {
    throw new InvalidPlanTokenError();
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InvalidPlanTokenError();
  }

  let envelope: TokenEnvelope<T>;
  try {
    envelope = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenEnvelope<T>;
  } catch {
    throw new InvalidPlanTokenError();
  }

  const now = Math.floor(options.now ?? Date.now() / 1000);
  if (
    envelope.version !== 1 ||
    !Number.isSafeInteger(envelope.issuedAt) ||
    !Number.isSafeInteger(envelope.expiresAt) ||
    envelope.expiresAt <= now ||
    envelope.expiresAt - envelope.issuedAt !== PLAN_TOKEN_TTL_SECONDS ||
    !("plan" in envelope)
  ) {
    throw new InvalidPlanTokenError();
  }

  return envelope;
}
