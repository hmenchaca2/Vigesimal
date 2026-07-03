"""Benchmark runner: orchestrates encoder × dataset × question combinations.

Calls the Anthropic API (claude-haiku-4-5 by default) for each combination,
scores responses, and saves raw results to JSONL files as they arrive.
Supports dry_run mode for harness testing without API budget.
"""

from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import anthropic

from token_counter import TokenCounter

# ---------------------------------------------------------------------------
# Interfaces expected from sibling modules (imported lazily to avoid hard deps)
# ---------------------------------------------------------------------------

# questions.generator.Question (dataclass with these fields):
#   id, category, dataset, question_text, expected_answer, answer_type
#
# questions.scorer.Scorer:
#   score(question, model_response) -> bool
#
# encoders.base.Encoder:
#   name: str
#   encode(dataset_name, data) -> str

SYSTEM_PROMPT = (
    "You are a precise data retrieval assistant. You will be given data in a specific "
    "format, followed by a question. Answer the question using ONLY the provided data. "
    "Be concise — give only the answer, no explanation. If the answer is a list, give "
    "comma-separated values sorted alphabetically. If the answer is a number, give only "
    "the number."
)


def _user_message(encoded_data: str, question_text: str) -> str:
    return f"DATA:\n{encoded_data}\n\nQUESTION: {question_text}\n\nAnswer:"


# ---------------------------------------------------------------------------
# RunResult
# ---------------------------------------------------------------------------


@dataclass
class RunResult:
    question_id: str
    encoder_name: str
    dataset: str
    model_response: str
    input_tokens: int        # from API response usage
    output_tokens: int       # from API response usage
    encoded_data_tokens: int # token count of the encoded_data string
    correct: bool
    category: str
    latency_ms: float

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# BenchmarkResult
# ---------------------------------------------------------------------------


@dataclass
class BenchmarkResult:
    results: list[RunResult]
    model: str
    started_at: str
    finished_at: str

    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "results": [r.to_dict() for r in self.results],
        }


# ---------------------------------------------------------------------------
# BenchmarkRunner
# ---------------------------------------------------------------------------


class BenchmarkRunner:
    """Runs the full benchmark matrix: encoders × datasets × questions."""

    _MAX_RETRIES = 3
    _RETRY_BASE_DELAY = 1.0  # seconds; doubles on each retry

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "claude-haiku-4-5-20251001",
    ) -> None:
        self.model = model
        self._token_counter = TokenCounter()
        # Anthropic client — may be None in dry_run mode
        self._client: anthropic.Anthropic | None = None
        _key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if _key:
            self._client = anthropic.Anthropic(api_key=_key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_single(self, encoded_data: str, question: Any) -> RunResult:
        """Call the LLM with encoded_data + question, return a RunResult.

        This does NOT do scoring — it only returns the raw model_response.
        Pass correct=False; the caller should set correct after scoring.
        """
        t0 = time.monotonic()
        response_text, input_tok, output_tok = self._call_api(
            encoded_data, question.question_text
        )
        latency = (time.monotonic() - t0) * 1000.0

        encoded_data_tokens = self._token_counter.count(encoded_data)

        return RunResult(
            question_id=question.id,
            encoder_name="",
            dataset=question.dataset,
            model_response=response_text,
            input_tokens=input_tok,
            output_tokens=output_tok,
            encoded_data_tokens=encoded_data_tokens,
            correct=False,  # caller must set after scoring
            category=question.category,
            latency_ms=latency,
        )

    def run_benchmark(
        self,
        encoders: list[Any],
        datasets: dict[str, Any],
        questions: list[Any],
        scorer: Any,
        output_dir: str = "results",
        max_workers: int = 5,
        dry_run: bool = False,
    ) -> BenchmarkResult:
        """Run the full benchmark.

        Args:
            encoders:    List of Encoder instances.
            datasets:    Mapping of dataset_name -> raw data (list or dict).
            questions:   List of Question dataclass instances.
            scorer:      Scorer instance with .score(question, response) -> bool.
            output_dir:  Directory to write raw JSONL results.
            max_workers: Thread pool size for parallel API calls.
            dry_run:     If True, skip API calls and return mock response "42".

        Returns:
            BenchmarkResult with all RunResult objects.
        """
        if not dry_run and self._client is None:
            raise ValueError(
                "No ANTHROPIC_API_KEY set and dry_run=False. "
                "Set the env var or pass api_key to BenchmarkRunner."
            )

        out_path = Path(output_dir)
        out_path.mkdir(parents=True, exist_ok=True)

        started_at = datetime.now(timezone.utc).isoformat()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")

        # Build the flat list of (encoder, dataset_name, question) triples
        tasks: list[tuple[Any, str, Any]] = []
        for encoder in encoders:
            for question in questions:
                ds_name = question.dataset
                if ds_name not in datasets:
                    continue  # dataset not loaded — skip
                tasks.append((encoder, ds_name, question))

        all_results: list[RunResult] = []
        total = len(tasks)

        # JSONL writers — one file per (encoder, dataset) pair
        jsonl_handles: dict[str, Any] = {}

        def _get_handle(encoder_name: str, ds_name: str):
            key = f"{encoder_name}__{ds_name}"
            if key not in jsonl_handles:
                fname = out_path / f"raw_{encoder_name}_{ds_name}_{timestamp}.jsonl"
                jsonl_handles[key] = open(fname, "a", encoding="utf-8")
            return jsonl_handles[key]

        def _run_task(args: tuple[Any, str, Any]) -> RunResult:
            encoder, ds_name, question = args
            raw_data = datasets[ds_name]
            encoded_data = encoder.encode(ds_name, raw_data)

            t0 = time.monotonic()

            if dry_run:
                response_text = "42"
                input_tok = 0
                output_tok = 0
            else:
                response_text, input_tok, output_tok = self._call_api(
                    encoded_data, question.question_text
                )

            latency = (time.monotonic() - t0) * 1000.0

            encoded_data_tokens = self._token_counter.count(encoded_data)
            correct = scorer.score(question, response_text)

            result = RunResult(
                question_id=question.id,
                encoder_name=encoder.name,
                dataset=ds_name,
                model_response=response_text,
                input_tokens=input_tok,
                output_tokens=output_tok,
                encoded_data_tokens=encoded_data_tokens,
                correct=correct,
                category=question.category,
                latency_ms=latency,
            )
            return result

        completed = 0
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            future_to_task = {pool.submit(_run_task, t): t for t in tasks}
            for future in as_completed(future_to_task):
                task = future_to_task[future]
                encoder, ds_name, question = task
                try:
                    result = future.result()
                except Exception as exc:
                    # On failure, record an error result so we don't lose the slot
                    result = RunResult(
                        question_id=question.id,
                        encoder_name=encoder.name,
                        dataset=ds_name,
                        model_response=f"ERROR: {exc}",
                        input_tokens=0,
                        output_tokens=0,
                        encoded_data_tokens=0,
                        correct=False,
                        category=question.category,
                        latency_ms=0.0,
                    )

                all_results.append(result)
                completed += 1

                # Write to JSONL immediately (crash recovery)
                fh = _get_handle(result.encoder_name, result.dataset)
                fh.write(json.dumps(result.to_dict()) + "\n")
                fh.flush()

                # Progress line
                status = "✓" if result.correct else "✗"
                print(
                    f"{status} [{result.encoder_name}] {result.dataset} "
                    f"Q{result.question_id} ({result.category}) "
                    f"{'correct' if result.correct else 'wrong'} "
                    f"[{completed}/{total}]"
                )

        # Close JSONL handles
        for fh in jsonl_handles.values():
            fh.close()

        finished_at = datetime.now(timezone.utc).isoformat()
        return BenchmarkResult(
            results=all_results,
            model=self.model,
            started_at=started_at,
            finished_at=finished_at,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _call_api(
        self, encoded_data: str, question_text: str
    ) -> tuple[str, int, int]:
        """Call the Anthropic API with retry logic.

        Returns:
            (response_text, input_tokens, output_tokens)
        """
        if self._client is None:
            raise RuntimeError("Anthropic client not initialised (no API key).")

        user_msg = _user_message(encoded_data, question_text)
        delay = self._RETRY_BASE_DELAY

        for attempt in range(1, self._MAX_RETRIES + 1):
            try:
                response = self._client.messages.create(
                    model=self.model,
                    max_tokens=256,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_msg}],
                )
                text = response.content[0].text.strip()
                input_tok = response.usage.input_tokens
                output_tok = response.usage.output_tokens
                return text, input_tok, output_tok

            except anthropic.RateLimitError:
                if attempt == self._MAX_RETRIES:
                    raise
                print(
                    f"  [rate limit] attempt {attempt}/{self._MAX_RETRIES}, "
                    f"retrying in {delay:.1f}s …"
                )
                time.sleep(delay)
                delay *= 2

            except anthropic.APIStatusError as exc:
                # Retry on transient 5xx errors
                if exc.status_code >= 500 and attempt < self._MAX_RETRIES:
                    print(
                        f"  [API {exc.status_code}] attempt {attempt}/{self._MAX_RETRIES}, "
                        f"retrying in {delay:.1f}s …"
                    )
                    time.sleep(delay)
                    delay *= 2
                else:
                    raise

        raise RuntimeError("Exceeded max retries for API call.")  # should be unreachable
