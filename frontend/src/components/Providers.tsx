"use client";

import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import "@/lib/install"; // start listening for the install prompt early
import { applyTheme, getThemePref } from "@/lib/theme";
import { ServerWaking } from "./ServerWaking";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      // A new deploy ships a new service worker; when it takes over, reload once so
      // nobody keeps running an old copy of the app.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController && !reloaded) {
          reloaded = true;
          location.reload();
        }
      });
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          reg.update().catch(() => {});
          // Check again whenever the app comes back to the foreground.
          document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update().catch(() => {}));
        })
        .catch(() => {});
    }
    // Follow OS theme changes when the preference is "system".
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => getThemePref() === "system" && applyTheme("system");
    applyTheme(getThemePref());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <SWRConfig value={{ revalidateOnFocus: true, shouldRetryOnError: (err) => err?.status !== 401 && err?.status !== 404 }}>
      <ToastProvider>
        <ServerWaking />
        {children}
      </ToastProvider>
    </SWRConfig>
  );
}
