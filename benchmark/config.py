"""Benchmark configuration constants."""

MODELS = [
    "claude-haiku-4-5-20251001",
    # Add others when ready:
    # "claude-sonnet-4-5",
]

ENCODERS = ["json_pretty", "json_compact", "toon", "vigesimal_v1", "vigesimal_v3", "vigesimal_v4"]

DATASETS = [
    "employee_records",
    "ecommerce_orders",
    "time_series",
    "github_repos",
    "event_logs",
    "config",
]

# Cost per 1M tokens (USD) — for estimate only
COST_PER_1M_INPUT: dict[str, float] = {
    "claude-haiku-4-5-20251001": 1.00,
    "claude-sonnet-5": 2.00,  # introductory pricing through 2026-08-31 ($3 after)
}
COST_PER_1M_OUTPUT: dict[str, float] = {
    "claude-haiku-4-5-20251001": 5.00,
    "claude-sonnet-5": 10.00,  # introductory pricing through 2026-08-31 ($15 after)
}

# Default fallback prices for unknown models (cents per 1M tokens)
DEFAULT_COST_PER_1M_INPUT: float = 1.0
DEFAULT_COST_PER_1M_OUTPUT: float = 5.0
