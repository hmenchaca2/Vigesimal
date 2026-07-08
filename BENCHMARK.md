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
| Encoders | [`benchmark/encoders/`](benchmark/encoders/) — `json_pretty`, `json_compact`, `toon`, **Vigesimal v1**, `llmlingua2` (same 179 questions / 6 datasets as every other encoder) |
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
| Vigesimal v1 | 63.7% | 1,888 | 0.296 |
| toon | 63.1% | 1,901 | 0.287 |
| json_compact | 56.4% | 3,253 | 0.155 |
| json_pretty | 54.2% | 5,005 | 0.091 |
| llmlingua2 | 39.1% | 2,388 | 0.143 |

### LLMLingua-2 calibration

LLMLingua-2 compresses from `json_compact` and is task-agnostic — it has no
query awareness, so each dataset is compressed once (not once per question).
To keep the comparison fair on tokens, each dataset's `target_token` was
calibrated to match Vigesimal v1's recorded average, via `TARGET_TOKENS` in
[`benchmark/encoders/llmlingua2.py`](benchmark/encoders/llmlingua2.py).

Achieved vs. target (free local calibration pass):

| Dataset | Target tokens | Actual tokens | Delta |
|---|---|---|---|
| config | 144 | 106 | -26.4% |
| ecommerce_orders | 1,740 | 2,372 | +36.3% |
| employee_records | 1,863 | 2,588 | +38.9% |
| event_logs | 1,887 | 2,388 | +26.6% |
| github_repos | 3,182 | 3,687 | +15.9% |
| time_series | 1,512 | 1,875 | +24.0% |

LLMLingua-2 systematically overshot its target on 5 of 6 datasets (by
16–39%) and undershot on the smallest (`config`, by 26%) — `target_token` is
a request to the compressor, not a hard guarantee, especially on
structured/repetitive text quite different from the prose/meeting-transcript
data LLMLingua-2 was tuned on. This means the actual paid run used *more*
tokens on average (2,388) than Vigesimal v1 (1,888) despite the calibration
attempt — worth stating plainly since it affects how to read the accuracy
comparison: LLMLingua-2 didn't just lose on accuracy, it also didn't hit its
token-budget target.

Per-category accuracy: 100% on constraint_check, 63.9% on field_retrieval,
33.3% on structure_aware, 28.1% on filtering, and just 2.2% on
aggregation — the weakest category by far. Per-dataset accuracy ranged from
83.3% (`config`, the smallest/simplest dataset) down to 25.7%
(`github_repos`).

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

# LLMLingua-2 baseline needs its own venv (classifier-based, CPU-only,
# ~2GB Hugging Face checkpoint downloaded on first use):
python3 -m venv .venv-llmlingua
source .venv-llmlingua/bin/activate
pip install -r requirements-llmlingua.txt
# The paid benchmark run additionally needs the anthropic client inside
# this same venv (requirements-llmlingua.txt covers llmlingua, torch,
# pytest, and anthropic):
# full run: ~$0.51 on claude-haiku-4-5 (higher than other encoders because
# llmlingua2 averaged 2,388 tokens/question vs. Vigesimal v1's 1,888 — see
# calibration table above)
```

## Threats to validity

Stated plainly so you don't have to discover them yourself:

1. **Single model family (primary run).** The headline numbers are claude-haiku-4-5. Relative rankings may differ on other models; a second-model validation run is tracked below.
2. **Flat tabular data only.** All list datasets are homogeneous flat records — the shape the format is designed for. Deeply nested or heterogeneous JSON is out of scope (and the README says not to use vigesimal there).
3. **Aggregation is weak for every encoder** (9–16% accuracy across the board). This measures model arithmetic, not serialization quality; treat aggregation rows as noise.
4. **The format legend travels with the block.** Vigesimal's header includes its one-line legend, so the model is "taught" the format inside the data payload while JSON is assumed known from pretraining. We consider this fair — the legend's token cost is counted against vigesimal — but it is a design choice.
5. **Synthetic datasets.** Generated data ([`benchmark/datasets/generate.py`](benchmark/datasets/generate.py)) may not reflect your distribution of value lengths and repetition rates, which drive dictionary-code payoff.
6. **Payoff estimates during the benchmark used real token counts** (js-tiktoken via the pluggable estimator); the library's default estimator is chars/4, which makes slightly different coding decisions.
7. **LLMLingua-2 is used off-label here.** It was designed and evaluated on
   prose/reasoning benchmarks (GSM8K, long-document QA, meeting transcripts).
   Applying it to structured tabular JSON is not its target use case, which
   may understate its real ceiling — stated plainly rather than hidden. The
   calibration data above (systematic target overshoot) is consistent with
   this: its redundancy model doesn't map cleanly onto repetitive tabular
   data the way it does onto natural prose.

## Cross-model validation

| Model | Encoders | Status |
|---|---|---|
| claude-haiku-4-5 | all 6 | ✅ complete (table above) |
| claude-sonnet-5 | toon, Vigesimal v1 | ✅ complete (below) |

### claude-sonnet-5 results (2026-07-03, thinking disabled, same 179 questions)

| Encoder | Accuracy | Avg input tokens |
|---|---|---|
| Vigesimal v1 | **59.2%** | **1,870** |
| toon | 57.0% | 1,883 |

The ranking replicates: vigesimal leads toon on both accuracy (+2.2 pts) and
tokens on a second, stronger model. Notes: (a) thinking was explicitly disabled
to match the Haiku condition; (b) two calls (of 358) failed with transient 529
overload errors and are scored as wrong; (c) raw JSONLs in
[`benchmark/results/sonnet5/`](benchmark/results/sonnet5/). Absolute accuracy
is lower than Haiku's run — most of the delta is in aggregation/filtering
questions where Sonnet 5 without thinking answers more tersely; the
encoder-relative comparison is the meaningful signal here.

## Related work

Vigesimal sits alongside four prompt/context compression techniques from
recent research. Only LLMLingua-2 is benchmarked live above (task-agnostic,
CPU-runnable, no finetuning required); the other three require a finetuned
model checkpoint to reproduce, so their numbers below are cited from the
original papers, not independently verified in this repo.

| Technique | Mechanism | Numbers | Requires finetuning? |
|---|---|---|---|
| [LLMLingua](https://arxiv.org/abs/2310.05736) (Jiang et al., EMNLP 2023) | Query-aware token pruning via a small LM budget controller | Up to ~20x compression, near-lossless at 2-5x (task-dependent, paper-reported) | No — uses an off-the-shelf small LM, but not run here |
| [LLMLingua-2](https://arxiv.org/abs/2403.12968) (Pan et al., ACL Findings 2024) | Task-agnostic token classification, distilled from GPT-4 | See Results table above (live run, this repo) | No — classifier checkpoint, run live in this benchmark |
| [Gist Tokens](https://arxiv.org/abs/2304.08467) (Mu, Li, Goodman, NeurIPS 2023) | Finetunes the model itself to compress a prompt into a handful of learned "gist" activation vectors | Paper reports up to ~26x compression on instruction prompts with minimal quality loss | **Yes** — requires instruction-finetuning the base model; not reproduced here |
| [ICAE](https://arxiv.org/abs/2307.06945) (Ge et al., ICLR 2024) | Trained LoRA encoder compresses context into "memory slots" a frozen LLM reads | Paper reports ~4x compression on Llama-based models | **Yes** — requires a trained encoder; not reproduced here |
| **Vigesimal** | Structural re-encoding: CSV-style rows + payoff-gated dictionary codes, no trained components | See Results table above (live run, this repo) | No |

Where Vigesimal differs mechanically from all four: it doesn't score or prune
tokens from prose (LLMLingua/-2), and it doesn't require a trained model
(Gist Tokens, ICAE). It re-encodes already-structured data into a denser
syntax — closer in spirit to normalizing a date format than to summarization.
That also means it doesn't apply to free-form prose, which is the one
"threats to validity" difference worth stating up front: LLMLingua/-2 works
on arbitrary text; Vigesimal only helps on structured, tabular-shaped data
(see the existing "Flat tabular data only" threat above).
