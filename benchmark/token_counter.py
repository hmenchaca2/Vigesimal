"""Token counter using js-tiktoken via a Node.js subprocess.

Uses the Node script at count_tokens.js (same directory) which loads js-tiktoken
from the tokenizer-bench installation.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

_NODE_SCRIPT = Path(__file__).parent / "count_tokens.js"


class TokenCounter:
    """Count tokens for one or more strings using js-tiktoken (Node.js)."""

    def __init__(self, node_script: str | Path = _NODE_SCRIPT) -> None:
        self._script = str(node_script)

    def _call_node(self, texts: list[str], model: str) -> list[int]:
        """Call the Node script with the given texts and return a list of counts."""
        payload = json.dumps({"model": model, "texts": texts})
        try:
            result = subprocess.run(
                ["node", self._script],
                input=payload,
                capture_output=True,
                text=True,
                timeout=30,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                "node is not installed or not on PATH. "
                "Install Node.js to use TokenCounter."
            ) from exc

        if result.returncode != 0:
            raise RuntimeError(
                f"count_tokens.js exited with code {result.returncode}: "
                f"{result.stderr.strip()}"
            )

        try:
            counts = json.loads(result.stdout.strip())
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"count_tokens.js returned non-JSON output: {result.stdout!r}"
            ) from exc

        if not isinstance(counts, list):
            raise RuntimeError(
                f"count_tokens.js returned unexpected type: {type(counts)}"
            )

        return counts

    def count(self, text: str, model: str = "o200k_base") -> int:
        """Return the token count for a single string."""
        counts = self._call_node([text], model)
        return counts[0]

    def count_batch(self, texts: list[str], model: str = "o200k_base") -> list[int]:
        """Return token counts for a list of strings (single Node invocation)."""
        if not texts:
            return []
        return self._call_node(texts, model)
