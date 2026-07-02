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


from encoders.vigesimal_v4 import VigesimalV4Encoder


class TestEncoderTabular:
    def setup_method(self):
        self.enc = VigesimalV4Encoder()

    def test_header_and_rows(self):
        records = [
            {"id": 1, "department": "Engineering", "active": True},
            {"id": 2, "department": "Engineering", "active": False},
            {"id": 3, "department": "Engineering", "active": True},
        ]
        out = self.enc.encode("employee_records", records)
        lines = out.splitlines()
        assert lines[0] == "## VIG4 employee_records: 3 rows"
        assert lines[1] == "fields: id,department,active"
        assert lines[2] == "codes: D1=Engineering"
        assert lines[3] == "bool: 1=yes 0=no  null: _"
        assert lines[4] == ""
        assert lines[5] == "1,D1,1"
        assert lines[6] == "2,D1,0"
        assert lines[7] == "3,D1,1"

    def test_codes_line_omitted_when_empty(self):
        records = [{"id": 1, "ok": True}, {"id": 2, "ok": False}]
        out = self.enc.encode("tiny", records)
        assert "codes:" not in out
        lines = out.splitlines()
        assert lines[0] == "## VIG4 tiny: 2 rows"
        assert lines[1] == "fields: id,ok"
        assert lines[2] == "bool: 1=yes 0=no  null: _"

    def test_field_union_and_absent_as_underscore(self):
        records = [{"a": 1}, {"a": 2, "b": "x"}]
        out = self.enc.encode("sparse", records)
        lines = out.splitlines()
        assert lines[1] == "fields: a,b"
        assert lines[-2] == "1,_"
        assert lines[-1] == "2,x"

    def test_empty_dataset(self):
        out = self.enc.encode("empty", [])
        assert out == "## VIG4 empty: 0 rows\n"

    def test_codes_line_quotes_multiword_values(self):
        records = [{"city": "New York City"} for _ in range(10)]
        out = self.enc.encode("cities", records)
        assert 'codes: C1="New York City"' in out

    def test_literal_value_matching_code_is_quoted(self):
        # "Engineering" earns code D1; a literal "D1" value in the same field
        # must be quoted to stay distinguishable from the code
        records = [{"department": "Engineering"} for _ in range(10)]
        records.append({"department": "D1"})
        out = self.enc.encode("collide", records)
        lines = out.splitlines()
        assert lines[-1] == '"D1"'

    def test_uncoded_value_stays_literal(self):
        records = [{"id": i, "name": f"Person {i}"} for i in range(5)]
        out = self.enc.encode("people", records)
        assert "Person 0" in out


class TestEncoderConfig:
    def setup_method(self):
        self.enc = VigesimalV4Encoder()

    def test_flat_dotted_keys(self):
        cfg = {
            "database": {"host": "db.example.com", "port": 5432},
            "features": {"dark_mode": True},
            "version": "2.1",
        }
        out = self.enc.encode("config", cfg)
        lines = out.splitlines()
        assert lines[0] == "## VIG4 config"
        assert lines[1] == "bool: 1=yes 0=no  null: _"
        assert lines[2] == ""
        assert "database.host: db.example.com" in lines
        assert "database.port: 5432" in lines
        assert "features.dark_mode: 1" in lines
        assert "version: 2.1" in lines
