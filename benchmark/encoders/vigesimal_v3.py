from __future__ import annotations
"""Vigesimal v3 encoder — Panel-A codex + S1⟨·⟩ notation.

Header (Panel-A codex):
    ## GRAMMAR v3 [A:core]
    ⟨⟩·,+  +=present _=absent 0=zero -=err
    S1⟨field1·field2·field3⟩
      field1:val1|val2|val3  field2:val1|val2

Tabular (≥3 records, same schema) — Panel-B tabular form:
    S1×N{f1,f2,f3}:
      val1,val2,val3
      val1,val2,val3

Tabular (<3 records) — individual tuple lines:
    S1⟨val1·val2·val3⟩

Config (nested dict) — flat key=value pairs using ⟨·⟩:
    SCHEMA: S1⟨key·value⟩
    S1⟨section.key·value⟩

Booleans: + (true) / - (false)
Null/absent: _
Zero integers: 0
"""

from .base import Encoder

# Unicode delimiters used by v3
_L = "⟨"   # ⟨
_R = "⟩"   # ⟩
_SEP = "·"  # ·  (middle dot)


def _v3_scalar(v) -> str:
    """Render a scalar value in Vigesimal v3 style."""
    if v is None:
        return "_"
    if isinstance(v, bool):
        return "+" if v else "-"
    if isinstance(v, (int, float)) and v == 0:
        return "0"
    # Escape special chars in strings
    s = str(v)
    s = s.replace(_SEP, "\\·").replace(_L, "\\⟨").replace(_R, "\\⟩")
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


def _build_codex(fields: list[str], records: list[dict]) -> list[str]:
    """Build Panel-A codex lines: enumerate unique values per field (max 8 per field)."""
    lines = []
    for field in fields:
        unique_vals = list(dict.fromkeys(
            _v3_scalar(r.get(field)) for r in records
        ))
        if len(unique_vals) <= 8:
            val_str = "|".join(unique_vals)
            lines.append(f"  {field}:{val_str}")
    return lines


class VigesimalV3Encoder(Encoder):
    name = "vigesimal_v3"

    def encode(self, dataset_name: str, data: list | dict) -> str:
        if isinstance(data, list):
            return self._encode_tabular(dataset_name, data)
        return self._encode_config(dataset_name, data)

    # ------------------------------------------------------------------
    # tabular
    # ------------------------------------------------------------------

    def _encode_tabular(self, name: str, records: list) -> str:
        if not records:
            return "## GRAMMAR v3 [A:core]\n"

        fields = list(records[0].keys())

        # --- Panel-A header ---
        schema_decl = f"S1{_L}{_SEP.join(fields)}{_R}"
        codex_lines = _build_codex(fields, records)

        header_parts = [
            "## GRAMMAR v3 [A:core]",
            f"{_L}{_R}{_SEP},+  +=present _=absent 0=zero -=err",
            schema_decl,
        ]
        header_parts.extend(codex_lines)
        header_parts.append("")  # blank line before data

        # --- Panel-B tabular form (≥3 records) ---
        if len(records) >= 3:
            data_header = f"S1×{len(records)}{{{','.join(fields)}}}:"
            data_lines = []
            for rec in records:
                row = ",".join(_v3_scalar(rec.get(f)) for f in fields)
                data_lines.append("  " + row)
            return "\n".join(header_parts + [data_header] + data_lines) + "\n"

        # --- Individual tuples (<3 records) ---
        tuple_lines = []
        for rec in records:
            vals = _SEP.join(_v3_scalar(rec.get(f)) for f in fields)
            tuple_lines.append(f"S1{_L}{vals}{_R}")
        return "\n".join(header_parts + tuple_lines) + "\n"

    # ------------------------------------------------------------------
    # config
    # ------------------------------------------------------------------

    def _encode_config(self, name: str, cfg: dict) -> str:
        flat = _flatten_dict(cfg)

        header_parts = [
            "## GRAMMAR v3 [A:core]",
            f"{_L}{_R}{_SEP},+  +=present _=absent 0=zero -=err",
            f"S1{_L}key{_SEP}value{_R}",
            "",
        ]
        data_lines = []
        for key, val in flat:
            data_lines.append(f"S1{_L}{key}{_SEP}{_v3_scalar(val)}{_R}")

        return "\n".join(header_parts + data_lines) + "\n"
