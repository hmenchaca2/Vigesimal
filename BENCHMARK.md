# Benchmark Methodology

Everything needed to audit or reproduce the numbers in the README.

## Evaluation design

| Item | Value |
|---|---|
| Model | `claude-haiku-4-5-20251001` (primary run) |
| Temperature | API default (not set) |
| Max output tokens | 256 |
| Questions | 179, generated deterministically (`seed=42`) by [`benchmark/questions/generator.py`](benchmark/questions/generator.py) |
| Categories | field_retrieval (72), aggregation (45), filtering (32), structure_aware (24), constraint_check (6) |
| Datasets | 6 synthetic datasets in [`benchmark/datasets/`](benchmark/datasets/): employee_records (50 rows), ecommerce_orders, time_series, github_repos, event_logs, config (nested dict) |
| Encoders | [`benchmark/encoders/`](benchmark/encoders/) — `json_pretty`, `json_compact`, `toon`, `vigesimal_v1` (early prototype), `vigesimal_v3`, `vigesimal_v4` (released as **Vigesimal v1**) |
| Token counting | js-tiktoken `o200k_base` for encoded-payload counts ([`benchmark/token_counter.py`](benchmark/token_counter.py)); API-reported `usage` tokens for cost |
| Runner | [`benchmark/runner.py`](benchmark/runner.py) |

### Exact prompt template

Identical for every encoder and question (`benchmark/runner.py`):

```
system: You are a precise data retrieval assistant. You will be given data in a
specific format, followed by a question. Answer the question using ONLY the
provided data. Be concise — give only the answer, no explanation. If the answer
is a list, give comma-separated values sorted alphabetically. If the answer is
a number, give only the number.

user: DATA:\n{encoded_data}\n\nQUESTION: {question_text}\n\nAnswer:
```

No condition receives format instructions beyond what the encoded block itself carries (vigesimal blocks include their one-line legend; JSON and TOON are presented bare). Questions are submitted in parallel (8 workers); order does not affect scoring since each question is an independent API call.

### Scoring

- `numeric` — parse both sides as float, correct if |expected − got| < 0.01
- `list` — comma-split, trim, sort, exact set match
- `exact`/`boolean` — case-insensitive string equality

## Results (2026-07-03, claude-haiku-4-5)

| Encoder | Accuracy | Avg encoded tokens | Efficiency |
|---|---|---|---|
| vigesimal_v4 (= released v1) | 63.7% | 1,888 | 0.296 |
| toon | 63.1% | 1,901 | 0.287 |
| vigesimal_v3 | 59.2% | 1,978 | 0.260 |
| vigesimal_v1 (prototype) | 58.7% | 2,074 | 0.246 |
| json_compact | 56.4% | 3,253 | 0.155 |
| json_pretty | 54.2% | 5,005 | 0.091 |

### Raw artifacts (machine-readable)

Per-question JSONL — one row per (encoder, dataset, question) with `question_id`,
`encoder_name`, `dataset`, `model_response`, `input_tokens`, `output_tokens`,
`encoded_data_tokens`, `correct`, `category`, `latency_ms`:

- [`benchmark/results/`](benchmark/results/) — `raw_<encoder>_<dataset>_<timestamp>.jsonl`
- [`benchmark/results/v4_report_final.md`](benchmark/results/v4_report_final.md) — generated summary

### Reproduce

```bash
cd benchmark
pip install anthropic pytest
export ANTHROPIC_API_KEY=sk-ant-...
python3 -m pytest tests/            # encoder unit tests (31, free)
# full run: ~$0.10 per encoder on claude-haiku-4-5
```

## Threats to validity

Stated plainly so you don't have to discover them yourself:

1. **Single model family (primary run).** The headline numbers are claude-haiku-4-5. Relative rankings may differ on other models; a second-model validation run is tracked below.
2. **Flat tabular data only.** All list datasets are homogeneous flat records — the shape the format is designed for. Deeply nested or heterogeneous JSON is out of scope (and the README says not to use vigesimal there).
3. **Aggregation is weak for every encoder** (9–16% accuracy across the board). This measures model arithmetic, not serialization quality; treat aggregation rows as noise.
4. **The format legend travels with the block.** Vigesimal's header includes its one-line legend, so the model is "taught" the format inside the data payload while JSON is assumed known from pretraining. We consider this fair — the legend's token cost is counted against vigesimal — but it is a design choice.
5. **Synthetic datasets.** Generated data ([`benchmark/datasets/generate.py`](benchmark/datasets/generate.py)) may not reflect your distribution of value lengths and repetition rates, which drive dictionary-code payoff.
6. **Payoff estimates during the benchmark used real token counts** (js-tiktoken via the pluggable estimator); the library's default estimator is chars/4, which makes slightly different coding decisions.

## Cross-model validation

| Model | Encoders | Status |
|---|---|---|
| claude-haiku-4-5 | all 6 | ✅ complete (table above) |
| claude-sonnet-5 | toon, vigesimal_v4 | ✅ complete (below) |

### claude-sonnet-5 results (2026-07-03, thinking disabled, same 179 questions)

| Encoder | Accuracy | Avg input tokens |
|---|---|---|
| vigesimal_v4 (= released v1) | **59.2%** | **1,870** |
| toon | 57.0% | 1,883 |

The ranking replicates: vigesimal leads toon on both accuracy (+2.2 pts) and
tokens on a second, stronger model. Notes: (a) thinking was explicitly disabled
to match the Haiku condition; (b) two calls (of 358) failed with transient 529
overload errors and are scored as wrong; (c) raw JSONLs in
[`benchmark/results/sonnet5/`](benchmark/results/sonnet5/). Absolute accuracy
is lower than Haiku's run — most of the delta is in aggregation/filtering
questions where Sonnet 5 without thinking answers more tersely; the
encoder-relative comparison is the meaningful signal here.
