from __future__ import annotations
"""Vigesimal v4 encoder — CSV rows + payoff-gated dictionary codes.

Header:
    ## VIG4 <dataset>: <N> rows
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
    fields: list[str], records: list[dict]
) -> dict[str, dict[str, str]]:
    """Per-field value->code maps. A value is coded only when it pays for itself:
    occurrences * (est(value) - 1) > est(value) + 2   (declaration cost)
    """
    # First pass: find qualifying values per field
    qualifying: dict[str, list[tuple[str, int]]] = {}
    for field in fields:
        counts = Counter(
            v for r in records
            if isinstance(v := r.get(field), str)
        )
        payers = [
            (value, occ) for value, occ in counts.items()
            if occ * (_est_tokens(value) - 1) > _est_tokens(value) + 2
        ]
        if payers:
            # Highest payoff first; cap at 19 codes
            payers.sort(key=lambda p: p[1] * (_est_tokens(p[0]) - 1), reverse=True)
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
