"use client";

import type { Grid, TextItem } from "./statement-core";
import { gridFromTextItems } from "./statement-core";

export class PdfPasswordError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "That password didn't work." : "This PDF is password-protected.");
  }
}

/** Read a statement file in the browser. Nothing is uploaded. */
export async function readStatementFile(file: File, password?: string): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv" || name.endsWith(".txt")) return readCsv(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return readXlsx(file);
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file, password);
  throw new Error("Use a CSV, Excel (.xlsx) or PDF statement.");
}

async function readCsv(file: File): Promise<Grid> {
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  const res = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true });
  return res.data.map((r) => r.map((c) => String(c ?? "")));
}

async function readXlsx(file: File): Promise<Grid> {
  if (file.name.toLowerCase().endsWith(".xls")) throw new Error("Old .xls files aren't supported. Save it as .xlsx or CSV first.");
  const { readSheet } = await import("read-excel-file/browser");
  const rows = await readSheet(file);
  return rows.map((r) =>
    r.map((c: unknown) => {
      if (c === null || c === undefined) return "";
      if (c instanceof Date) {
        // Excel dates come back as UTC midnight-based; keep the wall-clock value.
        const p = (n: number) => String(n).padStart(2, "0");
        return `${c.getUTCFullYear()}-${p(c.getUTCMonth() + 1)}-${p(c.getUTCDate())} ${p(c.getUTCHours())}:${p(c.getUTCMinutes())}`;
      }
      return String(c);
    }),
  );
}

async function readPdf(file: File, password?: string): Promise<Grid> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password, isEvalSupported: false }).promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") throw new PdfPasswordError(err.code === 2);
    throw new Error("Couldn't read this PDF. Try the CSV or Excel version of the statement.");
  }
  const items: TextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: height - it.transform[5], page: p });
    }
  }
  if (!items.length) throw new Error("This PDF has no text (it may be a scanned image). Try the CSV or Excel version.");
  return gridFromTextItems(items);
}
