from __future__ import annotations
"""Vigesimal v4 encoder — CSV rows + payoff-gated dictionary codes.

Header:
    ## <dataset>: <N> rows
    fields: f1,f2,f3
    codes: D1=Engineering D2=Marketing L1=NYC        (omitted when empty)
    bool: 1=yes 0=no  null: _

Rows: plain CSV, coded values substituted.
Config (nested dict): flat dotted-key lines, no code table.
"""

from collections import Counter

from .base import Encoder


def _v4_scalar(v) -> str:
    """Render a scalar: bool -> 1/0, None -> _, else literal with CSV quoting."""
    if isinstance(v, bool):
        return "1" if v else "0"
    if v is None:
        return "_"
    s = str(v)
    if "," in s or '"' in s or "\n" in s:
        s = '"' + s.replace('"', '""') + '"'
    return s


# Base-20 code digits: 1-9 then A-J (19 codes max per field)
_DIGITS = "123456789ABCDEFGHIJ"


def _est_tokens(s: str) -> int:
    """Rough token estimate (chars/4, min 1). Used only for the payoff rule."""
    return max(1, -(-len(s) // 4))  # ceil division


def _field_letters(fields: list[str]) -> dict[str, str]:
    """Assign each field a distinct uppercase letter from its own name."""
    taken: set[str] = set()
    letters: dict[str, str] = {}
    for field in fields:
        letter = None
        for ch in field:
            up = ch.upper()
            if up.isalpha() and up not in taken:
                letter = up
                break
        if letter is None:  # every letter of the name taken; grab any free one
            for up in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                if up not in taken:
                    letter = up
                    break
        if letter is None:
            continue  # >26 fields with codes — leave field uncoded
        taken.add(letter)
        letters[field] = letter
    return letters


def _build_codes(
    fields: list[str], records: list[dict], est=_est_tokens
) -> dict[str, dict[str, str]]:
    """Per-field value->code maps. A value is coded only when it pays for itself:
    occurrences * (est(value) - est(code)) > est(declaration)

    `est` maps a string to its token count; defaults to the chars/4 estimate.
    Code and declaration costs are approximated with the fixed placeholder
    "X1" — the real field letter is assigned after payoff decisions, so
    per-letter tokenization differences are deliberately ignored.
    """
    code_cost = est("X1")  # placeholder; assumes letter choice doesn't change cost
    # First pass: find qualifying values per field
    qualifying: dict[str, list[tuple[str, int]]] = {}
    for field in fields:
        counts = Counter(
            v for r in records
            if isinstance(v := r.get(field), str)
        )
        payers = [
            (value, occ) for value, occ in counts.items()
            if occ * (est(value) - code_cost) > est(f" X1={_codes_value(value)}")
        ]
        if payers:
            # Highest payoff first; cap at 19 codes
            payers.sort(key=lambda p: p[1] * (est(p[0]) - code_cost), reverse=True)
            qualifying[field] = payers[:19]

    letters = _field_letters(list(qualifying.keys()))
    codes: dict[str, dict[str, str]] = {}
    for field, payers in qualifying.items():
        letter = letters.get(field)
        if letter is None:
            continue
        codes[field] = {
            value: f"{letter}{_DIGITS[i]}" for i, (value, _) in enumerate(payers)
        }
    return codes


_LEGEND = "bool: 1=yes 0=no  null: _"


def _quote(s: str) -> str:
    """CSV-style quote: wrap in double quotes, double internal quotes."""
    return '"' + s.replace('"', '""') + '"'


def _codes_value(s: str) -> str:
    """Render a value for the codes: line — quoted if ambiguous."""
    if any(c in s for c in ' =,"'):
        return _quote(s)
    return s


def _flatten_dict(d: dict, prefix: str = "") -> list[tuple[str, object]]:
    items: list[tuple[str, object]] = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, prefix=full_key))
        else:
            items.append((full_key, v))
    return items


class VigesimalV4Encoder(Encoder):
    name = "vigesimal_v4"

    def __init__(self, token_counter=None) -> None:
        """token_counter: optional TokenCounter-like object with count_batch().
        When provided, code payoff decisions use real token counts instead of
        the chars/4 estimate."""
        self._token_counter = token_counter

    def encode(self, dataset_name: str, data: list | dict) -> str:
        if isinstance(data, list):
            return self._encode_tabular(dataset_name, data)
        return self._encode_config(dataset_name, data)

    def _make_est(self, fields: list[str], records: list):
        """Payoff estimator: real token counts (one batch call) when a counter
        is configured, else the chars/4 estimate."""
        if self._token_counter is None:
            return _est_tokens
        texts = {"X1"}
        for field in fields:
            for r in records:
                v = r.get(field)
                if isinstance(v, str):
                    texts.add(v)
                    texts.add(f" X1={_codes_value(v)}")
        ordered = list(texts)
        counts = self._token_counter.count_batch(ordered)
        table = dict(zip(ordered, counts))

        def lookup(s: str) -> int:
            # A miss means this enumeration is out of sync with what
            # _build_codes queries — fail loudly rather than silently
            # blending real counts with the chars/4 estimate.
            if s not in table:
                raise KeyError(
                    f"token count missing for {s!r}: _make_est texts are out "
                    "of sync with _build_codes queries"
                )
            return table[s]

        return lookup

    def _encode_tabular(self, name: str, records: list) -> str:
        if not records:
            return f"## {name}: 0 rows\n"

        # Field union across all records, first-seen order
        fields: list[str] = []
        for rec in records:
            for k in rec:
                if k not in fields:
                    fields.append(k)

        codes = _build_codes(fields, records, est=self._make_est(fields, records))

        lines = [
            f"## {name}: {len(records)} rows",
            f"fields: {','.join(fields)}",
        ]
        if codes:
            pairs = [
                f"{code}={_codes_value(value)}"
                for field in fields if field in codes
                for value, code in codes[field].items()
            ]
            lines.append("codes: " + " ".join(pairs))
        lines.append(_LEGEND)
        lines.append("")

        for rec in records:
            row = []
            for f in fields:
                v = rec.get(f)
                field_codes = codes.get(f)
                if field_codes and isinstance(v, str) and v in field_codes:
                    row.append(field_codes[v])
                elif (
                    field_codes
                    and isinstance(v, str)
                    and v in field_codes.values()
                ):
                    # Literal value collides with an assigned code — quote it
                    row.append(_quote(v))
                else:
                    row.append(_v4_scalar(v))
            lines.append(",".join(row))
        return "\n".join(lines) + "\n"

    def _encode_config(self, name: str, cfg: dict) -> str:
        lines = [f"## {name}", _LEGEND, ""]
        for key, val in _flatten_dict(cfg):
            lines.append(f"{key}: {_v4_scalar(val)}")
        return "\n".join(lines) + "\n"
