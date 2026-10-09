"use client";

import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import "@/lib/install"; // start listening for the install prompt early
import { applyTheme, getThemePref } from "@/lib/theme";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
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
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
