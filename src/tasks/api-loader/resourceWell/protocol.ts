import { decode } from "cbor-x";
import { inflateSync } from "node:zlib";

export type FanoutMessage = {
  channel?: unknown;
  status?: unknown;
  cid?: unknown;
  seqid?: unknown;
  data?: unknown;
};

export type ResourceWellPayload = {
  remainingValues: number;
  givenValues: number;
};

export function decodeFanoutMessage(data: ArrayBuffer | Uint8Array): FanoutMessage {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const decoded = decode(bytes);

  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Fanout message is not an object");
  }

  return decoded as FanoutMessage;
}

export function decodeFanoutData(data: unknown): unknown {
  if (!(data instanceof Uint8Array)) return data;

  let text: string;

  try {
    text = inflateSync(data).toString("utf8");
  } catch {
    // The fanout server can also send uncompressed data.
    text = Buffer.from(data).toString("utf8");
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function parseResourceWellPayload(data: unknown): ResourceWellPayload | null {
  if (
    typeof data !== "object" ||
    data === null ||
    !("remaining_values" in data) ||
    !("given_values" in data)
  ) {
    return null;
  }

  const payload = data as { remaining_values: unknown; given_values: unknown };
  const remainingValues = payload.remaining_values;
  const givenValues = payload.given_values;

  if (
    typeof remainingValues !== "number" ||
    !Number.isSafeInteger(remainingValues) ||
    remainingValues < 0 ||
    typeof givenValues !== "number" ||
    !Number.isSafeInteger(givenValues) ||
    givenValues < 0
  ) {
    return null;
  }

  return { remainingValues, givenValues };
}

export function parseUInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }

  return value;
}
