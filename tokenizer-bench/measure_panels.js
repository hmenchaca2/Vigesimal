const { getEncoding } = require("js-tiktoken");
const o200k = getEncoding("o200k_base");
const cl100k = getEncoding("cl100k_base");

const PANEL_A = `## GRAMMAR v3 [A:core]
⟨⟩·,+  +=present _=absent 0=zero -=err  count=version  out-of-domain=absent
S1⟨tier·step·lang·tools·status·intent⟩
  tier:prem|free|trial|ent  step:N/M  lang:ISO2
  tools:srch|sum|db|api(+multi)  status:ok|err|to|_  intent:code|_
T1⟨tool·status·results·latency·cached⟩ status:+|_|-  cached:+|0
SRC:doc·sec·para·sent·page
CONSTRAINTS: status=err→latency≠_  step=1/N→tools=_
VERIFY:S1⟨free·1/3·en·_·ok·onboard⟩=tier=free,step=1/3,lang=en,tools=none,status=ok,intent=onboard`;

const PANEL_B = `[B:tabular] S1×N{f1,f2,...}:
  row1_val1,row1_val2,...
  Δ,changed,fields,only   ← delta rows use Δ prefix`;

const PANEL_C = `[C:delta] Δ⟨...⟩ or Δ,... = changed fields only; empty=unchanged
RESET: session_start|tier_upgrade|err_recovery|intent_pivot|Δfields>18|turns>8
Drift: reset_threshold = floor(18 / avg_fields_per_turn)`;

const PANEL_D = `[D:emblem] EMBLEM: LONG-ID=@x  (IDs >8 chars ref ≥10× only)`;

const cases = [
  { label: "Panel-A only (claimed 195)", text: PANEL_A },
  { label: "Panel-A+B (claimed 226)", text: PANEL_A + "\n" + PANEL_B },
  { label: "Panel-A+B+C (claimed 270)", text: PANEL_A + "\n" + PANEL_B + "\n" + PANEL_C },
  { label: "Panel-A+B+C+D (claimed 295)", text: PANEL_A + "\n" + PANEL_B + "\n" + PANEL_C + "\n" + PANEL_D },
  { label: "Panel-B alone", text: PANEL_B },
  { label: "Panel-C alone", text: PANEL_C },
  { label: "Panel-D alone", text: PANEL_D },
];

console.log("Panel token counts (o200k_base vs cl100k_base):\n");
console.table(cases.map(({ label, text }) => ({
  "Panel": label,
  "o200k": o200k.encode(text).length,
  "cl100k": cl100k.encode(text).length,
  "chars": text.length,
})));

// Also measure actual tuple costs for delimiter comparison
console.log("\nDelimiter cost per tuple type (o200k):\n");
const tuples = [
  { label: "S1 state — exotic ⟨·⟩", text: "S1⟨prem·3/7·en·srch+sum·ok·onboard⟩" },
  { label: "S1 state — ASCII [|]",   text: "S1[prem|3/7|en|srch+sum|ok|onboard]" },
  { label: "T1 tool — exotic ⟨·⟩",  text: "T1⟨srch·+·5·342·0⟩" },
  { label: "T1 tool — ASCII [|]",    text: "T1[srch|+|5|342|0]" },
  { label: "delta — exotic Δ⟨·⟩",   text: "Δ⟨·5/8·····⟩" },
  { label: "delta — ASCII D[|]",     text: "D[|5/8|||||]" },
];
console.table(tuples.map(({ label, text }) => ({
  "Tuple": label,
  "o200k": o200k.encode(text).length,
  "cl100k": cl100k.encode(text).length,
})));

// Tabular break-even analysis
console.log("\nTabular break-even (o200k) — N rows of 4 fields:\n");
const TABULAR_HEADER = "TKT×N{id,status,category,priority}:\n";
const ROW = "  101,open,billing,hi\n";
const PROSE_ROW = "Ticket 101: open, billing, high\n";

const breakEvenRows = [1,2,3,4,5,6,7,8,10,12,15,20];
console.table(breakEvenRows.map(n => {
  const tabular = o200k.encode(TABULAR_HEADER + ROW.repeat(n)).length;
  const prose   = o200k.encode(PROSE_ROW.repeat(n)).length;
  return {
    "N rows": n,
    "tabular tokens": tabular,
    "prose tokens": prose,
    "delta": tabular - prose,
    "tabular wins": tabular < prose,
  };
}));
