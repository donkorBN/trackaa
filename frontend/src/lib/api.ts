const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
const TOKEN_KEY = "trackaa.token";

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(message: string, status: number, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/*
 * Slow-request signal. The free server sleeps when idle and takes up to a minute to wake;
 * while any request has been pending for a few seconds, the UI shows a "waking up" note.
 */
const SLOW_AFTER_MS = 3500;
const TIMEOUT_MS = 90_000;
let slowCount = 0;
const slowListeners = new Set<(slow: boolean) => void>();

export function onSlowChange(fn: (slow: boolean) => void): () => void {
  slowListeners.add(fn);
  fn(slowCount > 0);
  return () => slowListeners.delete(fn);
}

function setSlow(delta: number) {
  const was = slowCount > 0;
  slowCount = Math.max(0, slowCount + delta);
  if (was !== slowCount > 0) slowListeners.forEach((fn) => fn(slowCount > 0));
}

/** fetch with a hard timeout and slow-request tracking. */
async function trackedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let slow = false;
  const slowTimer = setTimeout(() => {
    slow = true;
    setSlow(1);
  }, SLOW_AFTER_MS);
  const killTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new ApiError("The server took too long to answer. Try again in a moment.", 0);
    throw e;
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(killTimer);
    if (slow) setSlow(-1);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    qs.set(k, v === true ? "1" : String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await trackedFetch(BASE + path, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      if (typeof window !== "undefined" && !location.pathname.startsWith("/login")) location.href = "/login";
    }
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status, data?.errors ?? {});
  }
  return data as T;
}

export const fetcher = <T,>(path: string) => api<T>(path);

/** Download a file from an authenticated endpoint (e.g. CSV export). */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await trackedFetch(BASE + path, { headers: { Accept: "text/csv", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) throw new ApiError(`Export failed (${res.status})`, res.status);
  const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
