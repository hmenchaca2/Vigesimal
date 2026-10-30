"""Benchmark configuration constants."""

MODELS = [
    "claude-haiku-4-5-20251001",
    # Add others when ready:
    # "claude-sonnet-4-5",
]

ENCODERS = ["json_pretty", "json_compact", "toon", "vigesimal_v1", "vigesimal_v3", "vigesimal_v4", "llmlingua2"]

DATASETS = [
    "employee_records",
    "ecommerce_orders",
    "time_series",
    "github_repos",
    "event_logs",
    "config",
]

# Cost per 1M tokens (USD) — for estimate only. Verified against official
# pricing as of 2026-10-30; re-verify before any paid run (prices change).
COST_PER_1M_INPUT: dict[str, float] = {
    "claude-haiku-4-5-20251001": 1.00,
    "claude-sonnet-5": 2.00,
}
COST_PER_1M_OUTPUT: dict[str, float] = {
    "claude-haiku-4-5-20251001": 5.00,
    "claude-sonnet-5": 10.00,
}

# Default fallback prices for unknown models (cents per 1M tokens)
DEFAULT_COST_PER_1M_INPUT: float = 1.0
DEFAULT_COST_PER_1M_OUTPUT: float = 5.0
