// src/numeric.ts
function decimalKey(text) {
  const [mantissa, exponent = "0"] = text.toLowerCase().split("e");
  const negative = mantissa.startsWith("-");
  const unsigned = negative ? mantissa.slice(1) : mantissa;
  const fraction = unsigned.includes(".") ? unsigned.length - unsigned.indexOf(".") - 1 : 0;
  const digits = unsigned.replace(".", "").replace(/^0+/, "");
  if (!digits) return negative ? "-0" : "0";
  const trimmed = digits.replace(/0+$/, "");
  return `${negative ? "-" : ""}${trimmed}e${Number(exponent) - fraction + digits.length - trimmed.length}`;
}
function parseNumericLiteral(text) {
  const value = Number(text);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(value) || Object.is(value, -0) || decimalKey(text) !== decimalKey(JSON.stringify(value))) {
    throw new Error("Invalid number or precision loss. Quote exact IDs or decimals as strings.");
  }
  return value;
}

// src/encoder/scalars.ts
function quoteCsv(s) {
  return '"' + s.replace(/"/g, '""') + '"';
}
function encodeScalar(v) {
  if (v === true) return "1";
  if (v === false) return "0";
  if (v === null || v === void 0) return "_";
  if (typeof v !== "string" && (typeof v !== "number" || !Number.isFinite(v) || Object.is(v, -0))) {
    throw new Error("Unsupported scalar value");
  }
  const s = String(v);
  if (s === "" || s === "_" || /[,"\r\n]/.test(s)) return quoteCsv(s);
  return s;
}
function decodeScalar(s, type) {
  if (s === "_") return null;
  let raw = s;
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    raw = raw.slice(1, -1).replace(/""/g, '"');
  }
  if (type === "boolean") {
    if (raw !== "1" && raw !== "0") throw new Error(`Invalid boolean: ${raw}`);
    return raw === "1";
  }
  if (type === "numeric") {
    return parseNumericLiteral(raw);
  }
  return raw;
}
function splitCsvRow(line) {
  const parts = [];
  let current = "";
  let inQuotes = false;
  let closed = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '""';
        i++;
      } else if (ch === '"') {
        current += '"';
        inQuotes = false;
        closed = true;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      if (current !== "" && !/^~[^=]+=\s*$/.test(current)) throw new Error("Unexpected quote in CSV field");
      if (closed) throw new Error("Unexpected quote after CSV field");
      current += '"';
      inQuotes = true;
    } else if (ch === ",") {
      parts.push(current);
      current = "";
      closed = false;
    } else {
      if (closed) throw new Error("Unexpected text after quoted CSV field");
      current += ch;
    }
  }
  if (inQuotes) throw new Error("Unterminated quoted CSV field");
  parts.push(current);
  return parts;
}

// src/encoder/codes.ts
var DIGITS = "123456789ABCDEFGHIJ";
function estTokens(s) {
  return Math.max(1, Math.ceil(s.length / 4));
}
function codesValue(s) {
  if (s === "" || /[\s=,"]/.test(s)) return quoteCsv(s);
  return s;
}
function fieldLetters(fields) {
  const taken = /* @__PURE__ */ new Set();
  const letters = /* @__PURE__ */ new Map();
  for (const field of fields) {
    let letter;
    for (const ch of field) {
      const up = ch.toUpperCase();
      if (/^[A-Z]$/.test(up) && !taken.has(up)) {
        letter = up;
        break;
      }
    }
    if (letter === void 0) {
      for (const up of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        if (!taken.has(up)) {
          letter = up;
          break;
        }
      }
    }
    if (letter === void 0) continue;
    taken.add(letter);
    letters.set(field, letter);
  }
  return letters;
}
function buildCodes(fields, records, est = estTokens) {
  const codeCost = est("X1");
  const qualifying = /* @__PURE__ */ new Map();
  for (const field of fields) {
    const counts = /* @__PURE__ */ new Map();
    for (const r of records) {
      const v = r[field];
      if (typeof v === "string") counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const payers = [];
    for (const [value, occ] of counts) {
      if (occ * (est(value) - codeCost) > est(` X1=${codesValue(value)}`)) {
        payers.push([value, occ]);
      }
    }
    if (payers.length > 0) {
      payers.sort((a, b) => b[1] * (est(b[0]) - codeCost) - a[1] * (est(a[0]) - codeCost));
      qualifying.set(field, payers.slice(0, 19));
    }
  }
  const letters = fieldLetters([...qualifying.keys()]);
  const codes = /* @__PURE__ */ new Map();
  for (const [field, payers] of qualifying) {
    const letter = letters.get(field);
    if (letter === void 0) continue;
    const m = /* @__PURE__ */ new Map();
    payers.forEach(([value], i) => m.set(value, `${letter}${DIGITS[i]}`));
    codes.set(field, m);
  }
  return codes;
}

// src/schema/validate.ts
function validateName(name) {
  if (!name || /["\r\n\x00-\x1f]/.test(name)) throw new Error("Dataset name must be nonempty, single-line, and contain no quotes");
}
function validateField(name) {
  if (!name || /[",=~\r\n\x00-\x1f]/.test(name)) throw new Error(`Unsupported field name: ${JSON.stringify(name)}`);
}
function validateSchema(schema) {
  validateName(schema.name);
  const names = /* @__PURE__ */ new Set();
  for (const field of schema.fields) {
    validateField(field.name);
    if (names.has(field.name)) throw new Error(`Duplicate field: ${field.name}`);
    names.add(field.name);
    if (!["string", "numeric", "boolean"].includes(field.type)) throw new Error(`Unsupported type: ${field.type}`);
  }
}
function validateRecords(records, schema) {
  if (!Array.isArray(records)) throw new Error("Expected an array of flat records");
  if (schema) validateSchema(schema);
  const types = /* @__PURE__ */ new Map();
  for (const [index, row] of records.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row) || ![Object.prototype, null].includes(Object.getPrototypeOf(row))) {
      throw new Error(`Row ${index}: expected a plain record`);
    }
    if (Object.getOwnPropertySymbols(row).length) throw new Error(`Row ${index}: symbol keys are unsupported`);
    for (const key of Object.keys(row)) {
      validateField(key);
      const field = schema?.fields.find((f) => f.name === key);
      if (schema && !field) throw new Error(`Row ${index}: field ${key} is missing from schema`);
      const value = row[key];
      if (value === null || value === void 0) continue;
      const type = typeof value;
      if (!["string", "number", "boolean"].includes(type) || type === "number" && (!Number.isFinite(value) || Object.is(value, -0))) {
        throw new Error(`Row ${index}, field ${key}: unsupported value; use finite scalars (excluding -0) or null`);
      }
      if (types.has(key) && types.get(key) !== type) throw new Error(`Field ${key}: mixed types are unsupported`);
      types.set(key, type);
      if (field && (field.type === "numeric" ? "number" : field.type) !== type) {
        throw new Error(`Row ${index}, field ${key}: value does not match schema type ${field.type}`);
      }
    }
  }
  if (records.length && (schema ? schema.fields.length === 0 : !records.some((r) => Object.keys(r).length))) {
    throw new Error("Nonempty datasets must have at least one field");
  }
}

// src/encoder/panels.ts
var LEGEND = "bool: 1=yes 0=no  null: _";
function encodeHeader(name, rowCount, schema, codes) {
  validateName(name);
  validateSchema(schema);
  const lines = [`## ${name}: ${rowCount} rows`, `fields: ${schema.fields.map((f) => f.name).join(",")}`];
  lines.push(`types: ${schema.fields.map((f) => f.type).join(",")}`);
  if (codes.size > 0) {
    const pairs = [];
    for (const field of schema.fields) {
      const m = codes.get(field.name);
      if (!m) continue;
      for (const [value, code] of m) pairs.push(`${code}=${codesValue(value)}`);
    }
    lines.push("codes: " + pairs.join(" "));
  }
  lines.push(LEGEND);
  lines.push("");
  lines.push("");
  return lines.join("\n");
}
function encodeRow(record, schema, codes) {
  validateRecords([record], schema);
  const assigned = new Set([...codes.values()].flatMap((m) => [...m.values()]));
  return schema.fields.map((f) => {
    const v = Object.prototype.hasOwnProperty.call(record, f.name) ? record[f.name] : void 0;
    const fieldCodes = codes.get(f.name);
    if (fieldCodes && typeof v === "string") {
      const code = fieldCodes.get(v);
      if (code !== void 0) return code;
    }
    if (typeof v === "string" && assigned.has(v)) return quoteCsv(v);
    return encodeScalar(v);
  }).join(",");
}
function encodeTabular(name, records, schema, est) {
  validateName(name);
  validateRecords(records, schema);
  if (records.length === 0) return `## ${name}: 0 rows
`;
  const codes = buildCodes(schema.fields.map((f) => f.name), records, est);
  const header = encodeHeader(name, records.length, schema, codes);
  const rows = records.map((r) => encodeRow(r, schema, codes));
  return header + rows.join("\n") + "\n";
}
function encodeDelta(delta) {
  const pairs = Object.entries(delta).map(([k, v]) => {
    validateField(k);
    return `~${k}=${encodeScalar(v)}`;
  });
  return pairs.length > 0 ? pairs.join(",") : "~";
}

// src/verify/decode.ts
function logicalLines(encoded) {
  const lines = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i];
    if (ch === '"') {
      if (quoted && encoded[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      quoted = !quoted;
    }
    if (ch === "\n" && !quoted) {
      lines.push(current.endsWith("\r") ? current.slice(0, -1) : current);
      current = "";
    } else current += ch;
  }
  if (quoted) throw new Error("Unterminated quoted value");
  if (current) lines.push(current);
  return lines;
}
function decodeTabular(encoded, schema) {
  if (schema) validateSchema(schema);
  const lines = logicalLines(encoded);
  const header = /^## ([^"\r\n]+): (0|[1-9]\d*) rows$/.exec(lines[0] ?? "");
  if (!header) throw new Error("Malformed vigesimal block: invalid dataset header");
  const count = Number(header[2]);
  if (!Number.isSafeInteger(count)) throw new Error("Invalid row count");
  if (count === 0 && lines.length === 1) return [];
  if (!lines[1]?.startsWith("fields: ")) throw new Error('Malformed vigesimal block: missing "fields:" line');
  const fields = lines[1].slice(8).split(",");
  fields.forEach(validateField);
  if (new Set(fields).size !== fields.length) throw new Error("Duplicate fields");
  if (schema && (schema.fields.length !== fields.length || schema.fields.some((f, i2) => f.name !== fields[i2]))) {
    throw new Error("Schema fields do not match the block");
  }
  let i = 2;
  let types = schema?.fields.map((f) => f.type) ?? fields.map(() => "string");
  if (lines[i]?.startsWith("types: ")) {
    const declared = lines[i++].slice(7).split(",");
    if (declared.length !== fields.length || declared.some((t) => !["numeric", "boolean", "string"].includes(t))) {
      throw new Error("Invalid type declaration");
    }
    if (schema && declared.some((t, index) => t !== types[index])) throw new Error("Schema types do not match the block");
    types = declared;
  }
  const codes = /* @__PURE__ */ new Map();
  if (lines[i]?.startsWith("codes: ")) {
    let src = lines[i++].slice(7);
    while (src) {
      const pair = /^([A-Z][1-9A-J])=("(?:[^"]|"")*"|[^\s"]+)(?: |$)/.exec(src);
      if (!pair || codes.has(pair[1])) throw new Error("Invalid or duplicate dictionary declaration");
      const value = pair[2].startsWith('"') ? pair[2].slice(1, -1).replace(/""/g, '"') : pair[2];
      codes.set(pair[1], value);
      src = src.slice(pair[0].length);
    }
  }
  if (lines[i++] !== LEGEND) throw new Error("Malformed vigesimal block: missing legend line");
  if (lines[i] === "") i++;
  const out = [];
  for (const line of lines.slice(i)) {
    const parts = splitCsvRow(line);
    if (parts.length !== fields.length) throw new Error(`Row ${out.length}: field count mismatch`);
    const entries = fields.map((field, index) => {
      const part = parts[index];
      if (!part.startsWith('"') && codes.has(part)) {
        if (types[index] !== "string") throw new Error(`Dictionary code in non-string field ${field}`);
        return [field, codes.get(part)];
      }
      return [field, decodeScalar(part, types[index])];
    });
    out.push(Object.fromEntries(entries));
  }
  if (out.length !== count) throw new Error(`Row count mismatch: expected ${count}, got ${out.length}`);
  return out;
}
function decodeDelta(encoded, schema) {
  validateSchema(schema);
  if (encoded === "~") return {};
  const types = new Map(schema.fields.map((f) => [f.name, f.type]));
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const part of splitCsvRow(encoded)) {
    if (!part.startsWith("~")) throw new Error(`Malformed delta pair: ${part}`);
    const eq = part.indexOf("=");
    if (eq === -1) throw new Error(`Malformed delta pair: ${part}`);
    const field = part.slice(1, eq);
    validateField(field);
    if (!types.has(field) || seen.has(field)) throw new Error(`Unknown or duplicate delta field: ${field}`);
    seen.add(field);
    entries.push([field, decodeScalar(part.slice(eq + 1), types.get(field))]);
  }
  return Object.fromEntries(entries);
}

// src/schema/infer.ts
function inferSchema(name, sampleData) {
  validateName(name);
  validateRecords(sampleData);
  if (sampleData.length === 0) return { name, fields: [] };
  const fieldNames = [...new Set(sampleData.flatMap((r) => Object.keys(r)))];
  const fields = fieldNames.map((fieldName) => {
    const allValues = sampleData.map((r) => Object.prototype.hasOwnProperty.call(r, fieldName) ? r[fieldName] : void 0);
    const nonNull = allValues.filter((v) => v !== null && v !== void 0);
    let type;
    if (nonNull.length && nonNull.every((v) => typeof v === "boolean")) {
      type = "boolean";
    } else if (nonNull.length && nonNull.every((v) => typeof v === "number")) {
      type = "numeric";
    } else {
      type = "string";
    }
    const uniqueEncoded = [...new Set(allValues.map((v) => encodeScalar(v)))];
    const domain = uniqueEncoded.length <= 8 ? uniqueEncoded : void 0;
    return { name: fieldName, type, domain };
  });
  return { name, fields };
}

// src/api.ts
function encode(records, options = {}) {
  const name = options.name ?? "data";
  const schema = options.schema ?? inferSchema(name, records);
  return encodeTabular(name, records, schema, options.est);
}
function decode(encoded, schema) {
  return decodeTabular(encoded, schema);
}

// src/analyze.ts
function validateJson(value, ancestors = /* @__PURE__ */ new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (typeof value !== "object" || !value) throw new Error("Analysis requires JSON-compatible data");
  if (ancestors.has(value)) throw new Error("Analysis requires acyclic JSON data");
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error("Analysis requires plain JSON objects");
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error("Symbol keys are not JSON-compatible");
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) validateJson(value[i], ancestors);
  } else {
    for (const entry of Object.values(value)) validateJson(entry, ancestors);
  }
  ancestors.delete(value);
}
function analyze(data, options = {}) {
  validateJson(data);
  const json = JSON.stringify(data);
  const counter = options.est ?? estTokens;
  const counts = /* @__PURE__ */ new Map();
  const count = (text) => {
    const cached = counts.get(text);
    if (cached !== void 0) return cached;
    const result = counter(text);
    if (!Number.isSafeInteger(result) || result < 0) throw new Error("Token counter must return a nonnegative integer");
    counts.set(text, result);
    return result;
  };
  const inputTokens = count(json);
  const warnings = [];
  let supported = false;
  let roundTrip = false;
  let encoded = null;
  let schema;
  try {
    if (!Array.isArray(data)) throw new Error("Vigesimal requires an array of flat records");
    const rows = data;
    validateName(options.name ?? "data");
    schema = options.schema ?? inferSchema(options.name ?? "data", rows);
    validateRecords(rows, schema);
    const fields = schema.fields;
    if (rows.some((row) => fields.some((f) => !Object.prototype.hasOwnProperty.call(row, f.name)))) {
      throw new Error("Sparse records normalize missing fields to null; keeping JSON preserves their shape");
    }
    supported = true;
  } catch (error) {
    warnings.push(error.message);
  }
  if (supported) {
    const rows = data;
    encoded = encode(rows, { ...options, schema, est: count });
    if (rows.length && encoded.includes("\ncodes: ")) {
      const codes = /* @__PURE__ */ new Map();
      const uncoded = encodeHeader(options.name ?? "data", rows.length, schema, codes) + rows.map((row) => encodeRow(row, schema, codes)).join("\n") + "\n";
      if (count(uncoded) <= count(encoded)) encoded = uncoded;
    }
    const decoded = decode(encoded);
    roundTrip = decoded.length === rows.length && decoded.every((row, index) => Object.keys(row).length === Object.keys(rows[index]).length && Object.keys(row).every((key) => Object.is(row[key], rows[index][key])));
    if (!roundTrip) warnings.push("Round-trip verification failed; keeping JSON");
  }
  const vigesimalTokens = encoded === null ? null : count(encoded);
  const useVigesimal = roundTrip && vigesimalTokens !== null && vigesimalTokens < inputTokens;
  const outputTokens = useVigesimal ? vigesimalTokens : inputTokens;
  if (supported && !useVigesimal && roundTrip) warnings.push("Vigesimal is not smaller; keeping compact JSON");
  if (!options.est) warnings.push("Token counts are character-based estimates, not model billing counts");
  return {
    supported,
    roundTrip,
    format: useVigesimal ? "vigesimal" : "json",
    output: useVigesimal ? encoded : json,
    encoded,
    inputTokens,
    vigesimalTokens,
    outputTokens,
    reduction: inputTokens ? 1 - outputTokens / inputTokens : 0,
    tokenizer: options.tokenizer ?? (options.est ? "custom" : "chars/4"),
    estimated: !options.est,
    warnings
  };
}

// src/parseJson.ts
function parseJson(text) {
  const data = JSON.parse(text);
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  const stack = [];
  for (const match of text.matchAll(tokens)) {
    const token = match[0];
    const context = stack[stack.length - 1];
    if (token === "{" || token === "[") {
      stack.push({ keys: token === "{" ? /* @__PURE__ */ new Set() : null, expectingKey: token === "{" });
    } else if (token === "}" || token === "]") {
      stack.pop();
    } else if (token === ",") {
      if (context?.keys) context.expectingKey = true;
    } else if (token === ":") {
      if (context) context.expectingKey = false;
    } else if (token.startsWith('"')) {
      if (context?.keys && context.expectingKey) {
        const key = JSON.parse(token);
        if (context.keys.has(key)) throw new Error(`Duplicate JSON key at character ${match.index + 1}: ${JSON.stringify(key)}`);
        context.keys.add(key);
      }
    } else {
      try {
        parseNumericLiteral(token);
      } catch {
        throw new Error(`Numeric value at character ${match.index + 1} cannot round-trip without precision loss. Quote exact IDs or decimals as strings.`);
      }
    }
  }
  return data;
}

// src/verify/VigesimalVerifier.ts
var VigesimalVerifier = class {
  decode(encoded, schema) {
    return decodeTabular(encoded, schema);
  }
  verify(encoded, original, schema) {
    let decoded;
    try {
      validateRecords(original, schema);
      decoded = decodeTabular(encoded, schema);
    } catch (e) {
      return { valid: false, errors: [`decode failed: ${e.message}`] };
    }
    const errors = [];
    if (decoded.length !== original.length) {
      errors.push(`row count mismatch: expected ${original.length}, got ${decoded.length}`);
    }
    const n = Math.min(decoded.length, original.length);
    for (let i = 0; i < n; i++) {
      for (const f of schema.fields) {
        const want = Object.prototype.hasOwnProperty.call(original[i], f.name) ? original[i][f.name] ?? null : null;
        const got = decoded[i][f.name] ?? null;
        const wantNorm = want === void 0 ? null : want;
        if (!Object.is(wantNorm, got)) {
          errors.push(`row ${i} field ${f.name}: expected ${String(wantNorm)}, got ${String(got)}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
};

// src/types/index.ts
var Panel = /* @__PURE__ */ ((Panel2) => {
  Panel2["A"] = "A";
  Panel2["B"] = "B";
  Panel2["C"] = "C";
  return Panel2;
})(Panel || {});

// src/delta/venus.ts
function computeResetThreshold(totalDeltaFields, turnsObserved) {
  if (turnsObserved === 0 || totalDeltaFields === 0) return 18;
  const avg = totalDeltaFields / turnsObserved;
  return Math.floor(18 / avg);
}

// src/delta/DeltaTracker.ts
var DeltaTracker = class {
  constructor(config = {}) {
    this.prevState = null;
    this.turnCount = 0;
    this.totalDeltaFields = 0;
    this.config = config;
  }
  update(newState) {
    if (this.prevState === null) {
      this.prevState = { ...newState };
      this.turnCount = 1;
      return { type: "reset", delta: {}, resetReason: "session_start" };
    }
    for (const rule of this.config.resetRules ?? []) {
      const oldVal = this.prevState[rule.field];
      const newVal = newState[rule.field];
      if (rule.condition(oldVal, newVal)) {
        this.prevState = { ...newState };
        this.totalDeltaFields = 0;
        this.turnCount = 1;
        return { type: "reset", delta: {}, resetReason: rule.event };
      }
    }
    const delta = {};
    let changedCount = 0;
    const allKeys = /* @__PURE__ */ new Set([...Object.keys(this.prevState), ...Object.keys(newState)]);
    for (const key of allKeys) {
      const next = Object.prototype.hasOwnProperty.call(newState, key) ? newState[key] : void 0;
      const previous = Object.prototype.hasOwnProperty.call(this.prevState, key) ? this.prevState[key] : void 0;
      if (next !== previous) {
        Object.defineProperty(delta, key, { value: next, enumerable: true, configurable: true, writable: true });
        changedCount++;
      }
    }
    this.turnCount++;
    this.totalDeltaFields += changedCount;
    const threshold = computeResetThreshold(this.totalDeltaFields, this.turnCount);
    if (this.turnCount > threshold) {
      this.prevState = { ...newState };
      this.totalDeltaFields = 0;
      this.turnCount = 1;
      return { type: "reset", delta: {}, resetReason: "drift_exceeded" };
    }
    this.prevState = { ...newState };
    return { type: "delta", delta };
  }
  getTurnCount() {
    return this.turnCount;
  }
  shouldReset() {
    const threshold = computeResetThreshold(this.totalDeltaFields, this.turnCount);
    return this.turnCount > threshold;
  }
  getResetThreshold() {
    return computeResetThreshold(this.totalDeltaFields, this.turnCount);
  }
  getFieldChangeRate() {
    if (this.turnCount === 0) return 0;
    return this.totalDeltaFields / this.turnCount;
  }
  reset() {
    this.prevState = null;
    this.turnCount = 0;
    this.totalDeltaFields = 0;
  }
};

// src/adaptive/select.ts
function selectPanels(input) {
  const panels = ["A" /* A */];
  if (input.isArray && input.recordCount >= 3) {
    panels.push("B" /* B */);
  }
  if (input.sessionTurnCount > 1 && !input.shouldReset) {
    panels.push("C" /* C */);
  }
  return panels;
}

// src/adaptive/AdaptiveCompressor.ts
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
function makeStats(original, compressed) {
  const inputTokenEstimate = estimateTokens(original);
  const outputTokenEstimate = estimateTokens(compressed);
  const reduction = inputTokenEstimate === 0 ? 0 : 1 - outputTokenEstimate / inputTokenEstimate;
  return { inputTokenEstimate, outputTokenEstimate, reduction };
}
var AdaptiveCompressor = class {
  constructor(registry) {
    this.registry = registry;
  }
  compress(data, schemaName) {
    const schema = this.registry.get(schemaName);
    const output = encodeTabular(schemaName, [data], schema);
    return {
      output,
      panelsUsed: ["A" /* A */],
      stats: makeStats(JSON.stringify(data), output)
    };
  }
  compressRecords(rows, schemaName) {
    const schema = this.registry.get(schemaName);
    const panels = selectPanels({
      isArray: true,
      recordCount: rows.length,
      sessionTurnCount: 0,
      shouldReset: false
    });
    const output = encodeTabular(schemaName, rows, schema);
    return { output, panelsUsed: panels, stats: makeStats(JSON.stringify(rows), output) };
  }
  createSession(schemaName) {
    const schema = this.registry.get(schemaName);
    const tracker = new DeltaTracker();
    return {
      compress(state) {
        validateRecords([state], schema);
        const deltaResult = tracker.update(state);
        const panels = selectPanels({
          isArray: false,
          recordCount: 1,
          sessionTurnCount: tracker.getTurnCount(),
          shouldReset: deltaResult.type === "reset"
        });
        const output = deltaResult.type === "reset" ? encodeHeader(schemaName, 1, schema, /* @__PURE__ */ new Map()) + encodeRow(state, schema, /* @__PURE__ */ new Map()) + "\n" : encodeDelta(deltaResult.delta);
        return { output, panelsUsed: panels, stats: makeStats(JSON.stringify(state), output) };
      },
      reset() {
        tracker.reset();
      }
    };
  }
};

// src/schema/codex.ts
function buildCodex(schema) {
  validateSchema(schema);
  const lines = [
    `fields: ${schema.fields.map((f) => f.name).join(",")}`,
    `types: ${schema.fields.map((f) => f.type).join(",")}`,
    LEGEND
  ];
  for (const field of schema.fields) {
    if (field.domain && field.domain.length > 0) {
      lines.push(`  ${field.name}: ${field.domain.join("|")}`);
    }
  }
  return lines.join("\n") + "\n";
}

// src/schema/SchemaRegistry.ts
var SchemaRegistry = class {
  constructor() {
    this.schemas = /* @__PURE__ */ new Map();
  }
  register(name, schema) {
    this.schemas.set(name, schema);
  }
  get(name) {
    const schema = this.schemas.get(name);
    if (!schema) throw new Error(`Schema "${name}" not found`);
    return schema;
  }
  infer(name, sampleData) {
    const schema = inferSchema(name, sampleData);
    this.schemas.set(name, schema);
    return schema;
  }
  getCodex(name) {
    return buildCodex(this.get(name));
  }
};
export {
  AdaptiveCompressor,
  DeltaTracker,
  LEGEND,
  Panel,
  SchemaRegistry,
  VigesimalVerifier,
  analyze,
  buildCodes,
  buildCodex,
  computeResetThreshold,
  decode,
  decodeDelta,
  decodeScalar,
  decodeTabular,
  encode,
  encodeDelta,
  encodeHeader,
  encodeRow,
  encodeScalar,
  encodeTabular,
  estTokens,
  fieldLetters,
  inferSchema,
  parseJson,
  quoteCsv,
  selectPanels,
  splitCsvRow
};
//# sourceMappingURL=index.mjs.map