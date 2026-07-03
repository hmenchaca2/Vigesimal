from __future__ import annotations
"""JSON pretty-printed encoder (2-space indent, sorted keys)."""

import json

from .base import Encoder


class JsonPrettyEncoder(Encoder):
    name = "json_pretty"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        return json.dumps(data, indent=2, ensure_ascii=False)
