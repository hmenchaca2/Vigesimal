const { getEncoding } = require("js-tiktoken");
const o200k = getEncoding("o200k_base");

// The real comparison: tabular form vs N individual S1⟨·⟩ tuples
// This is what the skill actually proposes — not tabular vs prose

// Simulate N records of the ticket schema {id, status, category, priority}
function makeTabular(n) {
  const header = "TKT×" + n + "{id,status,category,priority}:\n";
  const rows = [];
  for (let i = 0; i < n; i++) {
    const statuses = ["open","closed","inprog","open","open"];
    const cats = ["billing","tech","tech","billing","feat"];
    const pris = ["hi","lo","med","med","hi"];
    rows.push(`  ${100+i+1},${statuses[i%5]},${cats[i%5]},${pris[i%5]}`);
  }
  return header + rows.join("\n");
}

function makeIndividualTuples(n) {
  const statuses = ["open","closed","inprog","open","open"];
  const cats = ["billing","tech","tech","billing","feat"];
  const pris = ["hi","lo","med","med","hi"];
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(`TKT⟨${100+i+1}·${statuses[i%5]}·${cats[i%5]}·${pris[i%5]}⟩`);
  }
  return rows.join("\n");
}

function makeProse(n) {
  const statuses = ["open","closed","in-progress","open","open"];
  const cats = ["billing","technical","technical","billing","feature"];
  const pris = ["high","low","medium","medium","high"];
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(`Ticket ${100+i+1}: ${statuses[i%5]}, ${cats[i%5]}, ${pris[i%5]}`);
  }
  return rows.join("\n");
}

const ns = [1,2,3,4,5,6,8,10,15,20,50];
console.log("Tabular vs individual tuples vs prose (o200k_base):\n");
console.table(ns.map(n => {
  const tab = o200k.encode(makeTabular(n)).length;
  const tup = o200k.encode(makeIndividualTuples(n)).length;
  const pro = o200k.encode(makeProse(n)).length;
  return {
    "N": n,
    "tabular": tab,
    "tuples ⟨·⟩": tup,
    "prose": pro,
    "tab vs tuples": tab - tup,
    "tab beats tuples": tab < tup,
    "tab beats prose": tab < pro,
  };
}));

console.log("\nConclusion: tabular beats individual tuples at N>=__, beats prose never.");
