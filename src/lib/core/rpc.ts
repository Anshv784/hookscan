import { Connection } from "@solana/web3.js";

const TIMEOUT_MS = 25_000;

function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

let cached: Connection | null = null;

export function rpcUrl(): string {
  const url = process.env.RPC_URL;
  if (!url) throw new Error("RPC_URL is not set");
  return url;
}

export function connection(): Connection {
  if (!cached) {
    cached = new Connection(rpcUrl(), {
      commitment: "confirmed",
      fetch: timedFetch as typeof fetch,
      disableRetryOnRateLimit: false,
    });
  }
  return cached;
}

/** Retry an RPC-bound call a few times; public and free-tier RPCs drop sockets under load. */
export async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}
