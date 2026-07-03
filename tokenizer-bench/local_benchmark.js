/**
 * LOCAL OFFLINE TOKENIZER BENCHMARK UTILITY
 * Runs BPE tokenization calculations completely offline using open-source tokenizers.
 * No API keys required, zero spend.
 * * To run this script:
 * 1. Initialize a node directory:  npm init -y
 * 2. Install js-tiktoken:         npm install js-tiktoken
 * 3. Execute this utility:        node local_benchmark.js
 */

const { getEncoding } = require("js-tiktoken");

// Initialize local tokenizers (completely offline, zero network requests)
// cl100k_base: Used by gpt-4, gpt-3.5-turbo, Claude 3/3.5 (comparative approximation)
// o200k_base:  Used by gpt-4o and newer optimized models
const cl100k = getEncoding("cl100k_base");

// Sample test dataset (Your Boulder Hikes Payload)
const samplePayload = {
  "context": {
    "task": "Our favorite hikes together",
    "location": "Boulder",
    "season": "spring_2025"
  },
  "friends": ["ana", "luis", "sam"],
  "hikes": [
    { "id": 1, "name": "Blue Lake Trail", "distanceKm": 7.5, "elevationGain": 320, "companion": "ana", "wasSunny": true },
    { "id": 2, "name": "Ridge Overlook", "distanceKm": 9.2, "elevationGain": 540, "companion": "luis", "wasSunny": false },
    { "id": 3, "name": "Wildflower Loop", "distanceKm": 5.1, "elevationGain": 180, "companion": "sam", "wasSunny": true }
  ]
};

// --- Format Serialization Engines ---

// 1. Standard JSON Compact
function toCompactJson(data) {
    return JSON.stringify(data);
}

// 2. TOON Format (Tabular Uniform Array + Indentation)
function toToon(data) {
    const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);
    const isPrimitiveArray = (val) => Array.isArray(val) && val.every(item => typeof item !== 'object');
    const isObjectArray = (val) => Array.isArray(val) && val.every(item => typeof item === 'object');

    const processValue = (val, indent = 0) => {
        if (isPrimitiveArray(val)) {
            return val.join(',');
        } else if (isObjectArray(val)) {
            if (val.length === 0) return '[]';
            const keys = Object.keys(val[0]);
            let headerLine = `${keys.join(',')}`;
            let rows = val.map(item => {
                return keys.map(k => {
                    const v = item[k];
                    return v === undefined || v === null ? '_' : String(v);
                }).join(',');
            });
            return `[${val.length}]{${headerLine}}:\n` + rows.map(r => ' '.repeat(indent + 2) + r).join('\n');
        } else if (isObject(val)) {
            return '\n' + Object.keys(val).map(k => {
                return ' '.repeat(indent + 2) + `${k}: ${processValue(val[k], indent + 2)}`;
            }).join('\n');
        } else {
            return String(val === undefined || val === null ? '_' : val);
        }
    };

    if (isObject(data)) {
        return Object.keys(data).map(k => {
            const processed = processValue(data[k], 0);
            if (processed.startsWith('\n')) {
                return `${k}:${processed}`;
            } else if (processed.startsWith('[')) {
                return `${k}${processed}`;
            }
            return `${k}: ${processed}`;
        }).join('\n');
    }
    return String(data);
}

// 3. Vigesimal Compression with Configurable Delimiters
function toVigesimal(data, options = { leftDelim: '[', rightDelim: ']', separator: '|', dresdenCheck: true }) {
    const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);
    const isPrimitiveArray = (val) => Array.isArray(val) && val.every(item => typeof item !== 'object');
    const isObjectArray = (val) => Array.isArray(val) && val.every(item => typeof item === 'object');

    const mapPrimitiveVal = (v) => {
        if (v === undefined || v === null) return '_';
        if (v === true) return '+';
        if (v === false) return '-';
        return String(v);
    };

    const mapObjectToTuple = (obj, prefix) => {
        const keys = Object.keys(obj);
        const values = keys.map(k => {
            const val = obj[k];
            if (Array.isArray(val)) return val.map(mapPrimitiveVal).join('+');
            if (typeof val === 'object' && val !== null) return '{...}';
            return mapPrimitiveVal(val);
        });
        let txt = `${prefix}${options.leftDelim}${values.join(options.separator)}${options.rightDelim}`;
        if (options.dresdenCheck && keys.length > 0) {
            txt += ` CHECK:${keys[0]}=${mapPrimitiveVal(obj[keys[0]])}`;
        }
        return txt;
    };

    if (Array.isArray(data)) {
        if (data.length === 0) return '[]';
        if (typeof data[0] === 'object') {
            const schemaName = `S${Object.keys(data[0]).length}`;
            return data.map(item => mapObjectToTuple(item, schemaName)).join('\n');
        } else {
            return `S1${options.leftDelim}${data.map(mapPrimitiveVal).join('+')}${options.rightDelim}`;
        }
    }

    let outputLines = [];
    let rootFlatKeys = [];
    let rootFlatObj = {};

    for (const key in data) {
        const val = data[key];
        const upperPrefix = key.substring(0, 3).toUpperCase();

        if (isObjectArray(val)) {
            val.forEach(item => {
                outputLines.push(mapObjectToTuple(item, upperPrefix));
            });
        } else if (isPrimitiveArray(val)) {
            const itemsJoined = val.map(mapPrimitiveVal).join('+');
            outputLines.push(`${upperPrefix}${options.leftDelim}${itemsJoined}${options.rightDelim}`);
        } else if (isObject(val)) {
            outputLines.push(mapObjectToTuple(val, upperPrefix));
        } else {
            rootFlatKeys.push(key);
            rootFlatObj[key] = val;
        }
    }

    if (rootFlatKeys.length > 0) {
        outputLines.unshift(mapObjectToTuple(rootFlatObj, `S${rootFlatKeys.length}`));
    }

    return outputLines.join('\n');
}

// --- Benchmark Execution ---

function runBenchmark() {
    console.log("=========================================================");
    console.log("🚀 STARTING LOCAL OFFLINE TOKENIZATION BENCHMARK");
    console.log("=========================================================\n");

    const jsonText = toCompactJson(samplePayload);
    const toonText = toToon(samplePayload);

    // Variant A: Vigesimal using Exotic Delimiters (causes Token Fragmentation)
    const vigExoticText = toVigesimal(samplePayload, {
        leftDelim: '⟨',
        rightDelim: '⟩',
        separator: '·',
        dresdenCheck: true
    });

    // Variant B: Vigesimal using ASCII-Optimized Delimiters (prevents fragmentation)
    const vigOptimizedText = toVigesimal(samplePayload, {
        leftDelim: '[',
        rightDelim: ']',
        separator: '|',
        dresdenCheck: true
    });

    // Helper to evaluate character and actual offline BPE token counts
    const evaluate = (name, text) => {
        const tokens = cl100k.encode(text);
        return {
            name,
            charLength: text.length,
            tokenCount: tokens.length,
            snippet: text.substring(0, 80).replace(/\n/g, "\\n") + (text.length > 80 ? "..." : "")
        };
    };

    const results = [
        evaluate("Standard Compact JSON", jsonText),
        evaluate("TOON Format Specification", toonText),
        evaluate("Vigesimal (Exotic Unicode: ⟨ ⟩ ·)", vigExoticText),
        evaluate("Vigesimal (Optimized ASCII: [ ] |)", vigOptimizedText)
    ];

    // Display Results
    console.table(results.map(r => ({
        "Format Profile": r.name,
        "Char Length": r.charLength,
        "cl100k Tokens (Offline)": r.tokenCount,
        "Savings vs JSON": `${Math.round((results[0].tokenCount - r.tokenCount) / results[0].tokenCount * 100)}%`,
        "Snippet Preview": r.snippet
    })));

    console.log("\n💡 INSIGHT:");
    const exotic = results[2].tokenCount;
    const optimized = results[3].tokenCount;
    console.log(`- Exotic Unicode delimiters resulted in:   ${exotic} tokens`);
    console.log(`- ASCII-Optimized delimiters resulted in:  ${optimized} tokens`);
    console.log(`- Net Difference: Saving ${exotic - optimized} tokens (~${Math.round((exotic-optimized)/exotic*100)}% extra cost) purely by choosing safe delimiters!`);
    console.log("=========================================================");
}

runBenchmark();


// =========================================================
// VIGESIMAL v3 SKILL — DELIMITER TOKEN COST ANALYSIS
// Tests the exact strings the skill produces in production
// =========================================================

function runVigesimalSkillBenchmark() {
    console.log("\n\n=========================================================");
    console.log("🔬 VIGESIMAL v3 SKILL — REAL-WORLD DELIMITER ANALYSIS");
    console.log("=========================================================\n");

    const o200k = getEncoding("o200k_base");

    const evalCases = [
        // Eval 1: Agent state — what the skill actually outputs
        {
            label: "Eval-1 original prose (38-token claim)",
            text: "The user is a free-tier subscriber at step 2 of 5 in the onboarding flow. Their preferred language is English. Available tools: search, summarize. Current status: ok. Current intent: complete profile."
        },
        {
            label: "Eval-1 v3 exotic ⟨·⟩ output",
            text: "S1⟨free·2/5·en·srch+sum·ok·complete_profile⟩"
        },
        {
            label: "Eval-1 ASCII equivalent [|]",
            text: "S1[free|2/5|en|srch+sum|ok|complete_profile]"
        },
        // Eval 2: Tool output
        {
            label: "Eval-2 original JSON (23-token claim)",
            text: '{"tool":"web_search","status":"success","results":5,"latency_ms":342,"cached":false}'
        },
        {
            label: "Eval-2 v3 exotic T1⟨·⟩ output",
            text: "T1⟨srch·+·5·342·0⟩"
        },
        {
            label: "Eval-2 ASCII equivalent T1[|]",
            text: "T1[srch|+|5|342|0]"
        },
        // Eval 3: Tabular ticket block
        {
            label: "Eval-3 original prose tickets (45-token claim)",
            text: "Ticket 101: open, billing, high\nTicket 102: closed, technical, low\nTicket 103: open, technical, medium\nTicket 104: in-progress, billing, medium\nTicket 105: open, feature, high"
        },
        {
            label: "Eval-3 v3 exotic tabular (25-token claim)",
            text: "TKT×5{id,status,category,priority}:\n  101,open,billing,hi\n  102,closed,tech,lo\n  103,open,tech,med\n  104,inprog,billing,med\n  105,open,feat,hi"
        },
        {
            label: "Eval-3 ASCII tabular (no × symbol)",
            text: "TKT*5{id,status,category,priority}:\n  101,open,billing,hi\n  102,closed,tech,lo\n  103,open,tech,med\n  104,inprog,billing,med\n  105,open,feat,hi"
        },
        // Panel-A codex cost
        {
            label: "Panel-A codex (195-token claim)",
            text: "## GRAMMAR v3 [A:core]\n⟨⟩·,+  +=present _=absent 0=zero -=err  count=version  out-of-domain=absent\nS1⟨tier·step·lang·tools·status·intent⟩\n  tier:prem|free|trial|ent  step:N/M  lang:ISO2\n  tools:srch|sum|db|api(+multi)  status:ok|err|to|_  intent:code|_\nT1⟨tool·status·results·latency·cached⟩ status:+|_|-  cached:+|0\nSRC:doc·sec·para·sent·page\nCONSTRAINTS: status=err→latency≠_  step=1/N→tools=_\nVERIFY:S1⟨free·1/3·en·_·ok·onboard⟩=tier=free,step=1/3,lang=en,tools=none,status=ok,intent=onboard"
        },
        {
            label: "Panel-A codex ASCII rewrite",
            text: "## GRAMMAR v3 [A:core]\n[]|,+  +=present _=absent 0=zero -=err  count=version  out-of-domain=absent\nS1[tier|step|lang|tools|status|intent]\n  tier:prem|free|trial|ent  step:N/M  lang:ISO2\n  tools:srch|sum|db|api(+multi)  status:ok|err|to|_  intent:code|_\nT1[tool|status|results|latency|cached] status:+|_|-  cached:+|0\nSRC:doc|sec|para|sent|page\nCONSTRAINTS: status=err->latency!=_  step=1/N->tools=_\nVERIFY:S1[free|1/3|en|_|ok|onboard]=tier=free,step=1/3,lang=en,tools=none,status=ok,intent=onboard"
        },
    ];

    const rows = evalCases.map(({ label, text }) => {
        const cl100kTokens = cl100k.encode(text).length;
        const o200kTokens = o200k.encode(text).length;
        return {
            "Case": label,
            "cl100k": cl100kTokens,
            "o200k": o200kTokens,
            "chars": text.length,
        };
    });

    console.table(rows);

    console.log("\n💡 KEY FINDINGS:");
    // Compare exotic vs ASCII for each eval pair
    const pairs = [
        { name: "Eval-1 state tuple", exotic: rows[1], ascii: rows[2] },
        { name: "Eval-2 tool output", exotic: rows[4], ascii: rows[5] },
        { name: "Eval-3 tabular (× vs *)", exotic: rows[7], ascii: rows[8] },
        { name: "Panel-A codex", exotic: rows[9], ascii: rows[10] },
    ];
    pairs.forEach(({ name, exotic, ascii }) => {
        const diff = exotic.o200k - ascii.o200k;
        const pct = Math.round(diff / exotic.o200k * 100);
        console.log(`  ${name}: exotic=${exotic.o200k} vs ascii=${ascii.o200k} → ${diff > 0 ? '+' : ''}${diff} tokens (${diff > 0 ? '+' : ''}${pct}% overhead for Unicode delimiters)`);
    });
}

runVigesimalSkillBenchmark();
