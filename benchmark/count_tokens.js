#!/usr/bin/env node
/**
 * Token counter using js-tiktoken.
 * Reads JSON from stdin: {"model": "o200k_base", "texts": ["text1", "text2"]}
 * Writes JSON array of counts to stdout: [3, 7]
 */

// js-tiktoken is installed in the sibling tokenizer-bench workspace
const path = require("path");
const { getEncoding } = require(path.join(__dirname, "..", "tokenizer-bench", "node_modules", "js-tiktoken"));

let input = "";
process.stdin.setEncoding("utf8");

process.stdin.on("data", (chunk) => {
  input += chunk;
});

process.stdin.on("end", () => {
  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    process.stderr.write("count_tokens.js: failed to parse stdin JSON: " + e.message + "\n");
    process.exit(1);
  }

  const model = parsed.model || "o200k_base";
  const texts = parsed.texts;

  if (!Array.isArray(texts)) {
    process.stderr.write("count_tokens.js: 'texts' must be an array\n");
    process.exit(1);
  }

  let enc;
  try {
    enc = getEncoding(model);
  } catch (e) {
    process.stderr.write("count_tokens.js: failed to get encoding '" + model + "': " + e.message + "\n");
    process.exit(1);
  }

  const counts = texts.map((text) => {
    if (typeof text !== "string") return 0;
    return enc.encode(text).length;
  });

  process.stdout.write(JSON.stringify(counts) + "\n");
});
