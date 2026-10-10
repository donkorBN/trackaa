"use client";

import { useEffect, useState } from "react";
import { onSlowChange } from "@/lib/api";
import { useToast } from "./toast";
import { Spinner } from "./ui";

/** Shown while the free server wakes up, so a slow first request doesn't look like a broken app. */
export function ServerWaking() {
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowChange(setSlow), []);
  if (!slow) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4" role="status" aria-live="polite">
      <div className="flex max-w-md animate-pop items-center gap-3 rounded-control border-2 border-brand-ink bg-hero px-4 py-2.5 text-[13px] text-hero-fg shadow-hard">
        <Spinner className="shrink-0 text-brand" />
        <span>
          <span className="font-bold">Waking up the server…</span>{" "}
          <span className="text-hero-muted">It naps when nobody&apos;s using it. Up to a minute; anything you save is kept.</span>
        </span>
      </div>
    </div>
  );
}

/** The service worker serves the cached app instantly; when it finds a newer version, offer a reload. */
export function UpdateReady() {
  const toast = useToast();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "trackaa:update-ready") {
        toast({ message: "A new version of Trackaa is ready.", action: { label: "Reload", onClick: () => location.reload() } });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [toast]);
  return null;
}
