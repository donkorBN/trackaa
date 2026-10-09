// Pure helpers for turning a MoMo / bank statement (CSV, Excel or PDF text) into
// signed transactions. No browser or library imports here so it can be unit tested.

export type Grid = string[][];

export interface Mapping {
  date: number | null;
  description: number[];
  reference: number | null;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  balance: number | null; // balance after
  balanceBefore: number | null;
  fees: number[];
  direction: "signed" | "debit_credit" | "balance";
}

export interface ParsedLine {
  occurred_at: string; // ISO
  amount: number; // signed pesewas, + in, - out
  description: string | null;
  reference: string | null;
  balance: number | null;
  row: number; // source row index (for the preview)
  fee?: boolean;
}

export interface ParseResult {
  lines: ParsedLine[];
  skipped: { row: number; reason: string }[];
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Day-first date parser covering the formats MoMo and Ghanaian bank statements use. Local time. */
export function parseStatementDate(raw: string): Date | null {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  let y: number, mo: number, d: number;
  let rest = "";
  let m: RegExpMatchArray | null;

  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](.*))?$/))) {
    [y, mo, d] = [+m[1], +m[2] - 1, +m[3]];
    rest = m[4] ?? "";
  } else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ ,T]+(.*))?$/))) {
    [d, mo, y] = [+m[1], +m[2] - 1, +m[3]];
    rest = m[4] ?? "";
  } else if ((m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ,]+(\d{2,4})(?:[ ,T]+(.*))?$/))) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon === undefined) return null;
    [d, mo, y] = [+m[1], mon, +m[3]];
    rest = m[4] ?? "";
  } else if ((m = s.match(/^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})(?:[ ,T]+(.*))?$/))) {
    const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon === undefined) return null;
    [mo, d, y] = [mon, +m[2], +m[3]];
    rest = m[4] ?? "";
  } else {
    return null;
  }
  if (y < 100) y += 2000;

  let hh = 0,
    mm = 0,
    ss = 0;
  const t = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (t) {
    hh = +t[1];
    mm = +t[2];
    ss = t[3] ? +t[3] : 0;
    const ap = t[4]?.toLowerCase();
    if (ap === "pm" && hh < 12) hh += 12;
    if (ap === "am" && hh === 12) hh = 0;
  }
  const date = new Date(y, mo, d, hh, mm, ss);
  if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null; // e.g. 31/02
  return date;
}

/** "GHS 1,250.50", "(300.00)", "250.00 DR", "-12" -> signed pesewas. Null if not a number. */
export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw * 100) : null;
  let s = raw.trim();
  if (!s || s === "-" || s === "—") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (/\bDR\.?$/i.test(s)) {
    neg = true;
    s = s.replace(/\bDR\.?$/i, "");
  }
  s = s.replace(/\bCR\.?$/i, "");
  s = s.replace(/GH[S₵¢C]|GHS|₵|¢/gi, "").replace(/[,\s]/g, "");
  if (s.startsWith("-")) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  const pesewas = Number(w) * 100 + Math.round(Number(("0." + f + "000").slice(0, 6)) * 100);
  if (!Number.isSafeInteger(pesewas)) return null;
  return neg ? -pesewas : pesewas;
}

const H = {
  date: /\b(date|time|txn date|transaction date|trans\.? date)\b/i,
  balanceBefore: /bal(ance)?\.?\s*(before|b4)|opening bal/i,
  balance: /bal(ance)?\.?\s*(after)?$|bal(ance)?\.?\s*after|closing bal|running bal|^bal\.?$|^balance$/i,
  debit: /debit|withdraw|money out|paid out|^dr\.?$|^out$/i,
  credit: /credit|deposit|money in|^cr\.?$|^in$|received/i,
  fees: /fee|charge|levy|e-?levy|\btax\b|commission/i,
  amount: /amount|amt|value|^ghs$/i,
  reference: /\bref|reference|transaction id|trans\.? id|txn id|financial id|\bf_?id\b|^id$/i,
  description:
    /desc|details|narration|particular|trans\.? type|transaction type|^type$|name|note|remark|purpose|to no|from no|counterparty|beneficiary|sender|recipient/i,
};

/** First row (within the first 40) that looks like a header. */
export function findHeaderRow(grid: Grid): number {
  let best = -1;
  let bestScore = 1;
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const cells = grid[i].map((c) => c.trim()).filter(Boolean);
    let score = 0;
    for (const c of cells)
      if (
        c.length < 40 &&
        (H.date.test(c) || H.amount.test(c) || H.balance.test(c) || H.debit.test(c) || H.credit.test(c) || H.description.test(c))
      )
        score++;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

export function autoMap(headers: string[], sampleRows: Grid): Mapping {
  const m: Mapping = {
    date: null,
    description: [],
    reference: null,
    amount: null,
    debit: null,
    credit: null,
    balance: null,
    balanceBefore: null,
    fees: [],
    direction: "signed",
  };
  headers.forEach((raw, i) => {
    const h = raw.trim();
    if (!h) return;
    if (m.date === null && H.date.test(h)) return void (m.date = i);
    if (H.balanceBefore.test(h)) return void (m.balanceBefore ??= i);
    if (/bal/i.test(h) && H.balance.test(h)) return void (m.balance ??= i);
    if (H.fees.test(h)) return void m.fees.push(i);
    if (H.debit.test(h)) return void (m.debit ??= i);
    if (H.credit.test(h)) return void (m.credit ??= i);
    if (H.amount.test(h)) return void (m.amount ??= i);
    if (H.reference.test(h)) return void (m.reference ??= i);
    if (H.description.test(h)) return void m.description.push(i);
  });
  m.direction = guessDirection(m, sampleRows);
  return m;
}

export function guessDirection(m: Mapping, rows: Grid): Mapping["direction"] {
  if (m.debit !== null && m.credit !== null) return "debit_credit";
  if (m.amount !== null && rows.some((r) => (parseMoney(r[m.amount!]) ?? 0) < 0)) return "signed";
  if (m.amount !== null && m.balance !== null) return "balance";
  return "signed";
}

/** Apply a mapping to the data rows. Rows without a valid date and amount are reported, not guessed. */
export function buildLines(grid: Grid, headerRow: number, m: Mapping, opts: { feesAsLines: boolean }): ParseResult {
  const lines: ParsedLine[] = [];
  const skipped: ParseResult["skipped"] = [];
  let prevBalance: number | null = null;

  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || row.every((c) => !String(c).trim())) continue;
    const date = m.date !== null ? parseStatementDate(String(row[m.date] ?? "")) : null;
    if (!date) {
      skipped.push({ row: r, reason: "no date" });
      continue;
    }
    const balance = m.balance !== null ? parseMoney(row[m.balance]) : null;
    const fees = m.fees.reduce((s, i) => s + Math.abs(parseMoney(row[i]) ?? 0), 0);

    let amount: number | null = null;
    if (m.direction === "debit_credit") {
      const dr = Math.abs(parseMoney(row[m.debit!]) ?? 0);
      const cr = Math.abs(parseMoney(row[m.credit!]) ?? 0);
      amount = cr - dr;
    } else if (m.direction === "signed") {
      amount = m.amount !== null ? parseMoney(row[m.amount]) : null;
    } else {
      const abs = m.amount !== null ? Math.abs(parseMoney(row[m.amount]) ?? 0) : null;
      const before = m.balanceBefore !== null ? parseMoney(row[m.balanceBefore]) : prevBalance;
      if (abs && balance !== null && before !== null) {
        amount = balance - before + fees >= 0 ? abs : -abs; // the balance moved up (net of fees) = money in
      } else if (abs !== null && balance !== null && before === null) {
        amount = null; // first row with no previous balance: can't tell the direction
      }
    }
    if (balance !== null) prevBalance = balance;
    if (!amount) {
      skipped.push({ row: r, reason: amount === 0 ? "zero amount" : "no amount" });
      continue;
    }
    const description =
      m.description
        .map((i) => String(row[i] ?? "").trim())
        .filter(Boolean)
        .join(" · ")
        .slice(0, 255) || null;
    const reference =
      m.reference !== null
        ? String(row[m.reference] ?? "")
            .trim()
            .slice(0, 100) || null
        : null;
    lines.push({
      occurred_at: date.toISOString(),
      amount,
      description,
      reference,
      balance: fees && opts.feesAsLines ? null : balance,
      row: r,
    });
    if (fees && opts.feesAsLines) {
      lines.push({
        occurred_at: date.toISOString(),
        amount: -fees,
        description: `Fees${description ? `: ${description}` : ""}`.slice(0, 255),
        reference,
        balance,
        row: r,
        fee: true,
      });
    }
  }
  lines.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.row - b.row);
  return { lines, skipped };
}

/** The month most lines fall in, as YYYY-MM. */
export function dominantMonth(lines: ParsedLine[]): string | null {
  const counts = new Map<string, number>();
  for (const l of lines) {
    const d = new Date(l.occurred_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function inMonth(iso: string, period: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === period;
}

/** Positioned text (from a PDF page) -> rows of cells, using the header row's x positions as columns. */
export interface TextItem {
  str: string;
  x: number;
  y: number; // top-down
  page: number;
}

export function gridFromTextItems(items: TextItem[]): Grid {
  // 1. Group into visual lines.
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of sorted) {
    const last = lines.at(-1);
    if (last && last[0].page === it.page && Math.abs(last[0].y - it.y) <= 3) last.push(it);
    else lines.push([it]);
  }
  lines.forEach((l) => l.sort((a, b) => a.x - b.x));

  // 2. Find the header line and use its cells as column anchors.
  const asCells = lines.map((l) => l.map((i) => i.str.trim()));
  const h = findHeaderRow(asCells);
  if (h < 0) return asCells;
  const anchors = lines[h].map((i) => i.x);
  const columnOf = (x: number) => {
    let col = 0;
    for (let c = 0; c < anchors.length; c++) if (x >= anchors[c] - 6) col = c;
    return col;
  };

  // 3. Re-cut every other line into those columns. Lines without a date in the date
  //    column are wrapped text from the line above, so merge them into it.
  const headerCells = asCells[h];
  const dateCol = headerCells.findIndex((c) => H.date.test(c));
  const out: Grid = [headerCells];
  for (let i = h + 1; i < lines.length; i++) {
    const cells: string[] = Array(anchors.length).fill("");
    for (const it of lines[i]) {
      const c = columnOf(it.x);
      cells[c] = cells[c] ? `${cells[c]} ${it.str.trim()}` : it.str.trim();
    }
    if (cells.join("").trim() === headerCells.join("").trim()) continue; // repeated header on later pages
    const prev = out.at(-1);
    const startsRow = dateCol < 0 || !!parseStatementDate(cells[dateCol]);
    if (!startsRow && prev && out.length > 1) {
      cells.forEach((c, k) => {
        if (c) prev[k] = prev[k] ? `${prev[k]} ${c}` : c;
      });
    } else {
      out.push(cells);
    }
  }
  return out;
}
