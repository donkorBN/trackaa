import { api } from "./api";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Subscribe this device to the server's daily reminder. Returns false if the
 * server has no push keys configured (the in-app reminder still works).
 */
export async function enablePush(): Promise<"enabled" | "denied" | "unavailable"> {
  if (!pushSupported()) return "unavailable";
  const { public_key } = await api<{ public_key: string | null }>("/push/key");
  if (!public_key) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(public_key) }));
  await api("/push/subscribe", { method: "POST", body: sub.toJSON() });
  return "enabled";
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api("/push/subscribe", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export async function pushActive(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription());
}
