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


from encoders.vigesimal_v4 import _build_codes


class TestBuildCodes:
    def test_frequent_long_value_gets_code(self):
        records = [{"department": "Engineering"} for _ in range(10)]
        codes = _build_codes(["department"], records)
        assert codes == {"department": {"Engineering": "D1"}}

    def test_short_value_never_coded(self):
        # "HR" estimates to 1 token; coding saves nothing
        records = [{"department": "HR"} for _ in range(50)]
        codes = _build_codes(["department"], records)
        assert codes == {}

    def test_rare_value_not_coded(self):
        # 2 occurrences of an 11-char value: 2*(3-1)=4 saved < 3+2=5 declared
        records = [{"department": "Engineering"}] * 2 + [{"department": "A"}] * 8
        codes = _build_codes(["department"], records)
        assert codes == {}

    def test_codes_use_base20_digits(self):
        # 12 distinct qualifying values -> codes D1..D9, DA, DB, DC
        records = []
        for i in range(12):
            records.extend([{"department": f"LongDeptName{i:02d}"}] * 5)
        codes = _build_codes(["department"], records)
        assigned = sorted(codes["department"].values())
        assert assigned == sorted(
            ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "DA", "DB", "DC"]
        )

    def test_max_19_codes_highest_payoff_first(self):
        # 25 distinct qualifying values; only 19 coded, most frequent first
        records = []
        for i in range(25):
            records.extend([{"department": f"VeryLongDepartment{i:02d}"}] * (25 - i))
        codes = _build_codes(["department"], records)
        assert len(codes["department"]) == 19
        assert "VeryLongDepartment00" in codes["department"]   # most frequent
        assert "VeryLongDepartment24" not in codes["department"]  # least frequent

    def test_field_letter_collision_uses_next_letter(self):
        records = [
            {"location": "SanFranciscoBay", "language": "TypeScriptLang"}
            for _ in range(10)
        ]
        codes = _build_codes(["location", "language"], records)
        assert codes["location"]["SanFranciscoBay"] == "L1"
        # 'l' taken -> next distinct letter of "language" is 'a'
        assert codes["language"]["TypeScriptLang"] == "A1"

    def test_non_string_values_never_coded(self):
        records = [{"salary": 95000} for _ in range(50)]
        codes = _build_codes(["salary"], records)
        assert codes == {}
