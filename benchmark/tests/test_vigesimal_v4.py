import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from encoders.vigesimal_v4 import _v4_scalar


class TestScalar:
    def test_true_is_1(self):
        assert _v4_scalar(True) == "1"

    def test_false_is_0(self):
        assert _v4_scalar(False) == "0"

    def test_none_is_underscore(self):
        assert _v4_scalar(None) == "_"

    def test_int_literal(self):
        assert _v4_scalar(42) == "42"

    def test_zero_stays_zero(self):
        assert _v4_scalar(0) == "0"

    def test_float_literal(self):
        assert _v4_scalar(3.5) == "3.5"

    def test_plain_string_literal(self):
        assert _v4_scalar("hello") == "hello"

    def test_string_with_comma_is_quoted(self):
        assert _v4_scalar("a,b") == '"a,b"'

    def test_string_with_quote_is_quoted_and_doubled(self):
        assert _v4_scalar('say "hi"') == '"say ""hi"""'

    def test_string_with_newline_is_quoted(self):
        assert _v4_scalar("a\nb") == '"a\nb"'

    def test_empty_string_literal(self):
        assert _v4_scalar("") == ""

    def test_lone_quote_char_is_quoted_and_doubled(self):
        assert _v4_scalar('"') == '""""'
