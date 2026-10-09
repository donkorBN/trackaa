"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { Transaction, TxInput } from "./types";

/**
 * Outbox for transactions recorded while offline. Each entry keeps its
 * client_ref, so retrying can never create a duplicate on the server.
 */
export interface Pending {
  body: TxInput & { client_ref: string; occurred_at: string };
  queued_at: string;
}

const KEY = "trackaa.outbox";
const EVENT = "trackaa:outbox";

export function readOutbox(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(items: Pending[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function enqueue(body: Pending["body"]) {
  write([...readOutbox().filter((p) => p.body.client_ref !== body.client_ref), { body, queued_at: new Date().toISOString() }]);
}

let flushing: Promise<{ synced: number; failed: string[] }> | null = null;

/** Send everything queued. Stops at the first network failure; drops items the server rejects. */
export function flushOutbox(): Promise<{ synced: number; failed: string[] }> {
  if (flushing) return flushing;
  flushing = (async () => {
    let synced = 0;
    const failed: string[] = [];
    for (const item of readOutbox()) {
      try {
        await api<Transaction>("/transactions", { method: "POST", body: item.body });
        synced++;
      } catch (err) {
        const e = err as ApiError;
        if (e.status === 0 || e.status >= 500 || e.status === 429) break; // still offline / server trouble: retry later
        if (e.status === 401) break;
        failed.push(Object.values(e.fields ?? {})[0]?.[0] ?? e.message);
      }
      write(readOutbox().filter((p) => p.body.client_ref !== item.body.client_ref));
    }
    return { synced, failed };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function useOutboxCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readOutbox().length);
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return count;
}
