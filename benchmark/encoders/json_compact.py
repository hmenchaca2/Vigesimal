from __future__ import annotations
"""JSON compact encoder — no whitespace, no indentation."""

import json

from .base import Encoder


class JsonCompactEncoder(Encoder):
    name = "json_compact"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
