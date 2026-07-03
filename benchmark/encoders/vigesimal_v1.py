from __future__ import annotations
"""Vigesimal v1 encoder — simple positional tuples, no panel system.

Tabular (list of dicts):
    SCHEMA: S1(field1|field2|field3)
    S1(val1|val2|val3)
    S1(val1|val2|val3)

Config (dict) — flattened key=value pairs with section headers:
    SCHEMA: S1(key|value)
    S1(section.key|value)

Booleans: + (true) / - (false)
Null/absent: _
"""

from .base import Encoder


def _v1_scalar(v) -> str:
    """Render a scalar for Vigesimal v1 tuple format."""
    if v is None:
        return "_"
    if isinstance(v, bool):
        return "+" if v else "-"
    # Escape pipe characters in string values
    s = str(v)
    s = s.replace("|", "\\|")
    return s


def _flatten_dict(d: dict, prefix: str = "") -> list[tuple[str, object]]:
    """Recursively flatten nested dict into (dotted.key, value) pairs."""
    items: list[tuple[str, object]] = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, prefix=full_key))
        else:
            items.append((full_key, v))
    return items


class VigesimalV1Encoder(Encoder):
    name = "vigesimal_v1"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        if isinstance(data, list):
            return self._encode_tabular(data)
        return self._encode_config(data)

    # ------------------------------------------------------------------
    # tabular
    # ------------------------------------------------------------------

    def _encode_tabular(self, records: list) -> str:
        if not records:
            return "SCHEMA: S1()\n"

        fields = list(records[0].keys())
        schema_line = "SCHEMA: S1(" + "|".join(fields) + ")"
        lines = [schema_line]
        for rec in records:
            vals = "|".join(_v1_scalar(rec.get(f)) for f in fields)
            lines.append(f"S1({vals})")
        return "\n".join(lines) + "\n"

    # ------------------------------------------------------------------
    # config
    # ------------------------------------------------------------------

    def _encode_config(self, cfg: dict) -> str:
        flat = _flatten_dict(cfg)
        keys = [k for k, _ in flat]
        schema_line = "SCHEMA: S1(key|value)"
        lines = [schema_line]
        for key, val in flat:
            lines.append(f"S1({key}|{_v1_scalar(val)})")
        return "\n".join(lines) + "\n"
