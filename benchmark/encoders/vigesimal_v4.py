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
