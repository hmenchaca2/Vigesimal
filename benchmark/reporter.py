"""Benchmark reporter: computes statistics and writes a Markdown report.

Input:  list[RunResult] from runner.py
Output: summary dict + Markdown file at output_path
"""

from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
from typing import Any

from config import (
    COST_PER_1M_INPUT,
    COST_PER_1M_OUTPUT,
    DEFAULT_COST_PER_1M_INPUT,
    DEFAULT_COST_PER_1M_OUTPUT,
)
from runner import RunResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_div(num: float, den: float, default: float = 0.0) -> float:
    return num / den if den else default


def _accuracy(results: list[RunResult]) -> float:
    if not results:
        return 0.0
    return sum(r.correct for r in results) / len(results)


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _group_by(results: list[RunResult], key_fn) -> dict[str, list[RunResult]]:
    groups: dict[str, list[RunResult]] = defaultdict(list)
    for r in results:
        groups[key_fn(r)].append(r)
    return dict(groups)


def _encoder_stats(results: list[RunResult], model: str) -> dict[str, Any]:
    acc = _accuracy(results)
    avg_encoded = _avg([r.encoded_data_tokens for r in results])
    avg_total = _avg([r.input_tokens + r.output_tokens for r in results])
    efficiency = _safe_div(acc, avg_total) * 1000 if avg_total else 0.0

    by_category: dict[str, Any] = {}
    for cat, cat_results in _group_by(results, lambda r: r.category).items():
        by_category[cat] = {
            "accuracy": _accuracy(cat_results),
            "count": len(cat_results),
        }

    by_dataset: dict[str, Any] = {}
    for ds, ds_results in _group_by(results, lambda r: r.dataset).items():
        by_dataset[ds] = {
            "accuracy": _accuracy(ds_results),
            "count": len(ds_results),
        }

    return {
        "accuracy": acc,
        "avg_input_tokens": avg_encoded,
        "avg_total_tokens": avg_total,
        "efficiency": efficiency,
        "by_category": by_category,
        "by_dataset": by_dataset,
    }


def _cost_estimate(results: list[RunResult], model: str) -> float:
    cost_in = COST_PER_1M_INPUT.get(model, DEFAULT_COST_PER_1M_INPUT)
    cost_out = COST_PER_1M_OUTPUT.get(model, DEFAULT_COST_PER_1M_OUTPUT)
    total_input = sum(r.input_tokens for r in results)
    total_output = sum(r.output_tokens for r in results)
    return (total_input / 1_000_000 * cost_in) + (total_output / 1_000_000 * cost_out)


# ---------------------------------------------------------------------------
# Markdown helpers
# ---------------------------------------------------------------------------


def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    sep = ["---"] * len(headers)
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(sep) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(c) for c in row) + " |")
    return "\n".join(lines)


def _pct(v: float) -> str:
    return f"{v * 100:.1f}%"


def _fmt(v: float, decimals: int = 1) -> str:
    return f"{v:.{decimals}f}"


# ---------------------------------------------------------------------------
# BenchmarkReporter
# ---------------------------------------------------------------------------


class BenchmarkReporter:
    """Generate statistics and a Markdown report from a list of RunResults."""

    def generate_report(
        self,
        results: list[RunResult],
        model: str = "claude-haiku-4-5-20251001",
        output_path: str = "results/benchmark_report.md",
    ) -> dict:
        """Compute summary statistics and write a Markdown report.

        Args:
            results:     All RunResult objects from the benchmark run.
            model:       Model name (used for cost estimation).
            output_path: Where to write the .md file.

        Returns:
            Summary dict with structure documented in the spec.
        """
        by_encoder = _group_by(results, lambda r: r.encoder_name)

        summary: dict[str, Any] = {}
        for encoder_name, enc_results in by_encoder.items():
            summary[encoder_name] = _encoder_stats(enc_results, model)

        # Winner = highest efficiency
        winner = max(summary, key=lambda e: summary[e]["efficiency"]) if summary else ""

        cost = _cost_estimate(results, model)

        report = {
            "summary": summary,
            "winner": winner,
            "total_calls": len(results),
            "total_cost_estimate": round(cost, 6),
        }

        # Write the Markdown file
        md = self._build_markdown(report, results, model)
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(md, encoding="utf-8")

        return report

    # ------------------------------------------------------------------
    # Markdown construction
    # ------------------------------------------------------------------

    def _build_markdown(
        self, report: dict, results: list[RunResult], model: str
    ) -> str:
        sections: list[str] = []

        sections.append("# Vigesimal Compression Benchmark Report\n")
        sections.append(
            f"**Model:** {model}  \n"
            f"**Total calls:** {report['total_calls']}  \n"
            f"**Estimated cost:** ${report['total_cost_estimate']:.4f}  \n"
            f"**Winner (efficiency):** `{report['winner']}`\n"
        )

        # --- 1. Summary table ------------------------------------------------
        sections.append("## 1. Summary\n")
        encoders = list(report["summary"].keys())
        # Rank by efficiency descending
        ranked = sorted(encoders, key=lambda e: report["summary"][e]["efficiency"], reverse=True)

        rows = []
        for rank, enc in enumerate(ranked, 1):
            s = report["summary"][enc]
            rows.append([
                f"`{enc}`",
                _pct(s["accuracy"]),
                _fmt(s["avg_input_tokens"]),
                _fmt(s["avg_total_tokens"]),
                _fmt(s["efficiency"], 2),
                str(rank),
            ])
        sections.append(
            _md_table(
                ["Encoder", "Accuracy", "Avg Encoded Tokens", "Avg Total Tokens", "Efficiency", "Rank"],
                rows,
            )
        )
        sections.append("")

        # --- 2. Per-category breakdown ----------------------------------------
        sections.append("## 2. Per-Category Accuracy\n")
        # Collect all categories
        all_cats: set[str] = set()
        for s in report["summary"].values():
            all_cats.update(s["by_category"].keys())
        all_cats_sorted = sorted(all_cats)

        cat_headers = ["Category"] + [f"`{e}`" for e in ranked]
        cat_rows = []
        for cat in all_cats_sorted:
            row = [cat]
            for enc in ranked:
                cat_data = report["summary"][enc]["by_category"].get(cat)
                if cat_data:
                    row.append(_pct(cat_data["accuracy"]))
                else:
                    row.append("—")
            cat_rows.append(row)
        sections.append(_md_table(cat_headers, cat_rows))
        sections.append("")

        # --- 3. Per-dataset breakdown -----------------------------------------
        sections.append("## 3. Per-Dataset Accuracy\n")
        all_ds: set[str] = set()
        for s in report["summary"].values():
            all_ds.update(s["by_dataset"].keys())
        all_ds_sorted = sorted(all_ds)

        ds_headers = ["Dataset"] + [f"`{e}`" for e in ranked]
        ds_rows = []
        for ds in all_ds_sorted:
            row = [ds]
            for enc in ranked:
                ds_data = report["summary"][enc]["by_dataset"].get(ds)
                if ds_data:
                    row.append(_pct(ds_data["accuracy"]))
                else:
                    row.append("—")
            ds_rows.append(row)
        sections.append(_md_table(ds_headers, ds_rows))
        sections.append("")

        # --- 4. Top 5 divergence questions -----------------------------------
        sections.append("## 4. Top 5 Questions Where Formats Diverged\n")
        divergence = self._find_divergent_questions(results, top_n=5)
        if divergence:
            for i, (qid, info) in enumerate(divergence, 1):
                correct_fmts = ", ".join(f"`{e}`" for e in info["correct"])
                wrong_fmts = ", ".join(f"`{e}`" for e in info["wrong"])
                sections.append(
                    f"**{i}. Question `{qid}`** (dataset: {info['dataset']}, "
                    f"category: {info['category']})\n\n"
                    f"- Correct on: {correct_fmts or '—'}\n"
                    f"- Wrong on: {wrong_fmts or '—'}\n"
                )
        else:
            sections.append("_No divergent questions found._\n")

        # --- 5. Token savings examples ----------------------------------------
        sections.append("## 5. Token Savings Examples\n")
        sections.append(self._token_savings_section(results))

        return "\n".join(sections)

    def _find_divergent_questions(
        self, results: list[RunResult], top_n: int = 5
    ) -> list[tuple[str, dict]]:
        """Find questions with the highest variance in correctness across encoders."""
        by_question: dict[str, list[RunResult]] = defaultdict(list)
        for r in results:
            by_question[r.question_id].append(r)

        # Score = how "split" the question is; most interesting = ~50% correct
        divergent = []
        for qid, qresults in by_question.items():
            if len(qresults) < 2:
                continue
            n_correct = sum(r.correct for r in qresults)
            n_wrong = len(qresults) - n_correct
            # Divergence score: higher when split is more even and more encoders differ
            score = min(n_correct, n_wrong)
            if score == 0:
                continue  # all same — skip
            divergent.append((
                qid,
                score,
                {
                    "dataset": qresults[0].dataset,
                    "category": qresults[0].category,
                    "correct": [r.encoder_name for r in qresults if r.correct],
                    "wrong": [r.encoder_name for r in qresults if not r.correct],
                },
            ))

        divergent.sort(key=lambda x: x[1], reverse=True)
        return [(qid, info) for qid, _, info in divergent[:top_n]]

    def _token_savings_section(self, results: list[RunResult]) -> str:
        """Build a table showing encoded_data_tokens per encoder for each dataset."""
        # Pick one representative result per (encoder, dataset)
        sample: dict[tuple[str, str], RunResult] = {}
        for r in results:
            key = (r.encoder_name, r.dataset)
            if key not in sample:
                sample[key] = r

        # Gather unique encoders and datasets
        encoders: set[str] = set()
        datasets: set[str] = set()
        for enc, ds in sample:
            encoders.add(enc)
            datasets.add(ds)

        enc_list = sorted(encoders)
        ds_list = sorted(datasets)

        if not enc_list or not ds_list:
            return "_No samples available._\n"

        headers = ["Dataset"] + [f"`{e}`" for e in enc_list]
        rows = []
        for ds in ds_list:
            row = [ds]
            baseline = None
            for enc in enc_list:
                r = sample.get((enc, ds))
                if r is None:
                    row.append("—")
                else:
                    tok = r.encoded_data_tokens
                    if baseline is None:
                        baseline = tok
                    if baseline and baseline != tok:
                        pct = (tok - baseline) / baseline * 100
                        sign = "+" if pct > 0 else ""
                        row.append(f"{tok} ({sign}{pct:.0f}%)")
                    else:
                        row.append(str(tok))
            rows.append(row)

        lines = [
            "_Token counts for the encoded data payload (first question per dataset). "
            "Percentage is relative to the leftmost encoder._\n",
            _md_table(headers, rows),
            "",
        ]
        return "\n".join(lines)
