import assert from "node:assert/strict";
import { autoMap, buildLines, dominantMonth, findHeaderRow, gridFromTextItems, parseMoney, parseStatementDate } from "./statement-core.ts";

const d = (s: string) => { const x = parseStatementDate(s); return x && [x.getFullYear(), x.getMonth() + 1, x.getDate(), x.getHours(), x.getMinutes()].join("-"); };
assert.equal(d("2025-10-03 14:22:10"), "2025-10-3-14-22");
assert.equal(d("03-10-2025 14:22"), "2025-10-3-14-22");
assert.equal(d("03/10/2025"), "2025-10-3-0-0");
assert.equal(d("3-Oct-2025 2:05 PM"), "2025-10-3-14-5");
assert.equal(d("03 Oct 2025"), "2025-10-3-0-0");
assert.equal(d("Oct 3, 2025 09:01"), "2025-10-3-9-1");
assert.equal(d("31/02/2025"), null);
assert.equal(d("Payment received"), null);

assert.equal(parseMoney("GHS 1,250.50"), 125050);
assert.equal(parseMoney("(300.00)"), -30000);
assert.equal(parseMoney("250.00 DR"), -25000);
assert.equal(parseMoney("-12"), -1200);
assert.equal(parseMoney("0.1"), 10);
assert.equal(parseMoney("1.005"), 101);
assert.equal(parseMoney("abc"), null);
assert.equal(parseMoney(12.5), 1250);

// MTN-style: amount always positive, direction from balance before/after, fees separate.
const mtn = [
  ["MTN MOBILE MONEY STATEMENT"],
  ["TRANSACTION DATE", "FROM NAME", "TRANS. TYPE", "AMOUNT", "FEES", "E-LEVY", "BAL BEFORE", "BAL AFTER", "TO NAME", "F_ID"],
  ["01-10-2025 08:00", "KWAME", "TRANSFER", "100.00", "0.75", "1.00", "500.00", "398.25", "AMA", "111"],
  ["02-10-2025 09:30", "BOSS LTD", "CASH IN", "1,200.00", "0", "0", "398.25", "1,598.25", "KWAME", "112"],
  ["05-10-2025 12:00", "KWAME", "PAYMENT", "25.50", "0", "0", "1,598.25", "1,572.75", "CHOP BAR", "113"],
];
const h = findHeaderRow(mtn);
assert.equal(h, 1);
const map = autoMap(mtn[h], mtn.slice(h + 1));
assert.equal(map.date, 0);
assert.equal(map.amount, 3);
assert.deepEqual(map.fees, [4, 5]);
assert.equal(map.balanceBefore, 6);
assert.equal(map.balance, 7);
assert.equal(map.reference, 9);
assert.equal(map.direction, "balance");
const res = buildLines(mtn, h, map, { feesAsLines: true });
assert.deepEqual(res.lines.map((l) => l.amount), [-10000, -175, 120000, -2550]);
assert.equal(res.lines[1].fee, true);
assert.ok(res.lines[0].description?.includes("TRANSFER"));
assert.equal(res.lines[3].reference, "113");
assert.equal(dominantMonth(res.lines), "2025-10");

// Bank-style: debit / credit columns, descending order, opening row without date skipped.
const bank = [
  ["Date", "Narration", "Debit", "Credit", "Balance"],
  ["", "Opening balance", "", "", "1,000.00"],
  ["06/10/2025", "POS Shoprite", "300.00", "", "1,900.00"],
  ["04/10/2025", "Salary", "", "1,200.00", "2,200.00"],
];
const bm = autoMap(bank[0], bank.slice(1));
assert.equal(bm.direction, "debit_credit");
const br = buildLines(bank, 0, bm, { feesAsLines: true });
assert.deepEqual(br.lines.map((l) => l.amount), [120000, -30000]); // sorted by date
assert.equal(br.skipped.length, 1);

// Signed amount column.
const signed = [["Date", "Description", "Amount"], ["2025-10-01", "Airtime", "-5.00"], ["2025-10-02", "Refund", "20"]];
const sm = autoMap(signed[0], signed.slice(1));
assert.equal(sm.direction, "signed");
assert.deepEqual(buildLines(signed, 0, sm, { feesAsLines: false }).lines.map((l) => l.amount), [-500, 2000]);

// PDF text items -> grid (header anchors, wrapped text merged, repeated header dropped).
const items = [
  { str: "Statement for 024XXXXXXX", x: 20, y: 10, page: 1 },
  { str: "Date", x: 20, y: 50, page: 1 }, { str: "Details", x: 120, y: 50, page: 1 }, { str: "Amount", x: 300, y: 50, page: 1 }, { str: "Balance", x: 380, y: 50, page: 1 },
  { str: "01/10/2025 10:00", x: 20, y: 70, page: 1 }, { str: "Payment to", x: 120, y: 70, page: 1 }, { str: "-25.00", x: 305, y: 70, page: 1 }, { str: "75.00", x: 385, y: 70, page: 1 },
  { str: "KOFI STORES", x: 120, y: 80, page: 1 },
  { str: "Date", x: 20, y: 30, page: 2 }, { str: "Details", x: 120, y: 30, page: 2 }, { str: "Amount", x: 300, y: 30, page: 2 }, { str: "Balance", x: 380, y: 30, page: 2 },
  { str: "02/10/2025 11:00", x: 20, y: 50, page: 2 }, { str: "Cash in", x: 120, y: 50, page: 2 }, { str: "50.00", x: 310, y: 50, page: 2 }, { str: "125.00", x: 385, y: 50, page: 2 },
];
const g = gridFromTextItems(items);
assert.deepEqual(g[0], ["Date", "Details", "Amount", "Balance"]);
assert.equal(g.length, 3);
assert.equal(g[1][1], "Payment to KOFI STORES");
const pm = autoMap(g[0], g.slice(1));
assert.deepEqual(buildLines(g, 0, pm, { feesAsLines: true }).lines.map((l) => l.amount), [-2500, 5000]);
console.log("statement-core: all assertions passed");
