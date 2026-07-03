from __future__ import annotations
"""TOON format encoder.

Tabular (list of dicts):
    arrayName[N]{field1,field2,...}:
      val1,val2,...
      val1,val2,...

Nested config (dict):
    key:value pairs with section headers for nested dicts.
    section.key: value

Values are rendered as plain scalars; booleans as true/false.
"""

from .base import Encoder


def _toon_value(v) -> str:
    """Render a scalar value for TOON output."""
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return "null"
    return str(v)


def _flatten_dict(d: dict, prefix: str = "") -> list[tuple[str, object]]:
    """Recursively flatten a nested dict into (dotted.key, value) pairs."""
    items: list[tuple[str, object]] = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, prefix=full_key))
        else:
            items.append((full_key, v))
    return items


class ToonEncoder(Encoder):
    name = "toon"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        if isinstance(data, list):
            return self._encode_tabular(dataset_name, data)
        return self._encode_config(dataset_name, data)

    # ------------------------------------------------------------------
    # tabular  (list of dicts)
    # ------------------------------------------------------------------

    def _encode_tabular(self, name: str, records: list) -> str:
        if not records:
            return f"{name}[0]{{}}\n"

        fields = list(records[0].keys())
        header = f"{name}[{len(records)}]{{{','.join(fields)}}}:"
        lines = [header]
        for rec in records:
            row_vals = [_toon_value(rec.get(f)) for f in fields]
            lines.append("  " + ",".join(row_vals))
        return "\n".join(lines) + "\n"

    # ------------------------------------------------------------------
    # config  (nested dict)
    # ------------------------------------------------------------------

    def _encode_config(self, name: str, cfg: dict) -> str:
        lines = [f"# {name}"]
        # Group by top-level section
        for section, value in cfg.items():
            if isinstance(value, dict):
                lines.append(f"\n[{section}]")
                for k, v in value.items():
                    lines.append(f"  {k}: {_toon_value(v)}")
            else:
                lines.append(f"{section}: {_toon_value(value)}")
        return "\n".join(lines) + "\n"
