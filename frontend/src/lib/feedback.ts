"use client";

// Small, tasteful feedback: haptics where the device supports them (Android Chrome),
// and confetti for real milestones only. Both respect "reduce motion".

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const haptic = {
  tap: () => vibrate(8),
  success: () => vibrate([12, 40, 18]),
  warn: () => vibrate([30, 60, 30]),
};

function vibrate(pattern: number | number[]) {
  try {
    if (!reduced() && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

export async function confetti(kind: "small" | "big" = "small") {
  if (reduced()) return;
  const fire = (await import("canvas-confetti")).default;
  const colors = ["#22c55e", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6"];
  if (kind === "small") {
    fire({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: 0.75 }, colors, disableForReducedMotion: true, zIndex: 70 });
  } else {
    fire({ particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.6 }, colors, disableForReducedMotion: true, zIndex: 70 });
    setTimeout(() => fire({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 70 }), 180);
    setTimeout(() => fire({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 70 }), 320);
  }
}

const SEEN_KEY = "trackaa.badges-seen";

/** Badges earned since we last looked, so we can celebrate each one exactly once per device. */
export function newlyEarned(earned: string[]): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const seen = new Set<string>(raw ? JSON.parse(raw) : []);
    const fresh = earned.filter((k) => !seen.has(k));
    localStorage.setItem(SEEN_KEY, JSON.stringify(earned));
    // First visit on this device: don't throw a party for old achievements.
    return raw === null ? [] : fresh;
  } catch {
    return [];
  }
}
