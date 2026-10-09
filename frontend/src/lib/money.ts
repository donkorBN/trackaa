// All money is handled as integer pesewas (1 GH₵ = 100 pesewas). Never floats.

const MAX_PESEWAS = 100_000_000_000_00; // GH₵ 100 billion: sanity ceiling

/** Parse user input like "1,250.5" into pesewas. Returns null when invalid. */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[,\s]/g, "").replace(/^GH₵/i, "");
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === "" || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  const pesewas = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(pesewas) || pesewas > MAX_PESEWAS) return null;
  return pesewas;
}

/** Pesewas -> plain editable string ("12.50"). */
export function toInputString(pesewas: number): string {
  const whole = Math.trunc(pesewas / 100);
  const frac = pesewas % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}

const grouper = new Intl.NumberFormat("en-GH", { maximumFractionDigits: 0 });

/** Format pesewas as "GH₵ 1,250.50". `sign` adds +/− for non-zero values. */
export function formatGHS(pesewas: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const negative = pesewas < 0;
  const abs = Math.abs(pesewas);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  let body = grouper.format(whole);
  if (!(opts.compact && frac === 0)) body += "." + String(frac).padStart(2, "0");
  const prefix = negative ? "−" : opts.sign && pesewas > 0 ? "+" : "";
  return `${prefix}GH₵ ${body}`;
}
