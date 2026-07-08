from __future__ import annotations
"""LLMLingua-2 baseline encoder — token-pruning compression via a trained classifier.

Compresses the json_compact rendering of each dataset once (task-agnostic,
matching how every other encoder in this harness works — one encode, N
questions asked against it), targeting vigesimal_v4's already-recorded
average token count for that dataset so the comparison holds token budget
roughly equal. See docs/superpowers/specs/2026-07-07-llmlingua2-baseline-design.md.
"""

import threading

from .base import Encoder
from .json_compact import JsonCompactEncoder

# vigesimal_v4's recorded avg encoded_data_tokens per dataset (claude-haiku-4-5
# run, 2026-07-03) — see benchmark/results/raw_vigesimal_v4_<dataset>_20260703T011920.jsonl.
# LLMLingua-2 is calibrated to match these so results compare at equal token budget.
TARGET_TOKENS: dict[str, int] = {
    "config": 144,
    "ecommerce_orders": 1740,
    "employee_records": 1863,
    "event_logs": 1887,
    "github_repos": 3182,
    "time_series": 1512,
}

MODEL_NAME = "microsoft/llmlingua-2-xlm-roberta-large-meetingbank"


class LLMLingua2Encoder(Encoder):
    """Compresses via Microsoft LLMLingua-2 (classifier-based token pruning)."""

    name = "llmlingua2"

    def __init__(self) -> None:
        self._compressor = None  # lazy-loaded on first encode() call
        self._json_encoder = JsonCompactEncoder()
        self._cache: dict[str, str] = {}
        # Guards compressor construction and compress_prompt calls: the
        # runner shares one encoder instance across a ThreadPoolExecutor,
        # so without this, concurrent threads hitting the same dataset_name
        # before the cache is populated would each load their own multi-GB
        # PromptCompressor and/or redo the compression forward pass.
        self._lock = threading.Lock()

    def _get_compressor(self):
        if self._compressor is None:
            from llmlingua import PromptCompressor
            self._compressor = PromptCompressor(
                model_name=MODEL_NAME,
                use_llmlingua2=True,
                device_map="cpu",
            )
        return self._compressor

    def encode(self, dataset_name: str, data: list | dict) -> str:
        if dataset_name in self._cache:
            return self._cache[dataset_name]

        if dataset_name not in TARGET_TOKENS:
            raise ValueError(
                f"No calibration target for dataset {dataset_name!r}; "
                f"add it to TARGET_TOKENS in {__name__}."
            )

        with self._lock:
            if dataset_name in self._cache:  # re-check: another thread may have finished while we waited
                return self._cache[dataset_name]

            source_text = self._json_encoder.encode(dataset_name, data)
            compressor = self._get_compressor()
            result = compressor.compress_prompt(
                context=[source_text],
                rate=0.5,  # inert here: target_token below overrides rate per llmlingua's own docstring
                target_token=TARGET_TOKENS[dataset_name],
            )
            compressed = result["compressed_prompt"]
            self._cache[dataset_name] = compressed
            return compressed
