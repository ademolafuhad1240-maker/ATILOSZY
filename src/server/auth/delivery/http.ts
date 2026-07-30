import {
  AuthDeliveryProviderError,
} from "./errors";
import type {
  AuthDeliveryFetch,
} from "./types";

const DEFAULT_TIMEOUT_MS = 8_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;

export function normalizeDeliveryTimeout(
  value?: number,
): number {
  const timeout =
    value ?? DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(timeout) ||
    timeout < MIN_TIMEOUT_MS ||
    timeout > MAX_TIMEOUT_MS
  ) {
    throw new AuthDeliveryProviderError(
      "configuration",
      "CONFIGURATION",
    );
  }

  return timeout;
}

export async function sendDeliveryRequest(
  input: {
    provider: string;
    url: string;
    init: RequestInit;
    timeoutMs?: number;
    fetchImplementation?:
      AuthDeliveryFetch;
  },
): Promise<Response> {
  const controller =
    new AbortController();
  const timeoutMs =
    normalizeDeliveryTimeout(
      input.timeoutMs,
    );

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await (
      input.fetchImplementation ??
      fetch
    )(
      input.url,
      {
        ...input.init,
        signal: controller.signal,
      },
    );
  } catch (error) {
    throw new AuthDeliveryProviderError(
      input.provider,
      controller.signal.aborted ||
        (error instanceof Error &&
          error.name === "AbortError")
        ? "TIMEOUT"
        : "NETWORK",
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function readJsonRecord(
  response: Response,
): Promise<Record<string, unknown> | null> {
  let value: unknown;

  try {
    value = await response.json();
  } catch {
    return null;
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as
    Record<string, unknown>;
}
