"use client";

import { useEffect, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { ToastProvider } from "./toast";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <SWRConfig value={{ revalidateOnFocus: true, shouldRetryOnError: (err) => err?.status !== 401 && err?.status !== 404 }}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}
