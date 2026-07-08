import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from encoders.llmlingua2 import LLMLingua2Encoder, TARGET_TOKENS


class _FakeCompressor:
    def __init__(self):
        self.calls: list[dict] = []

    def compress_prompt(self, context, rate, target_token):
        self.calls.append({"context": context, "rate": rate, "target_token": target_token})
        return {"compressed_prompt": f"COMPRESSED[{target_token}]:{context[0][:10]}"}


class TestCaching:
    def test_encode_caches_per_dataset(self):
        enc = LLMLingua2Encoder()
        fake = _FakeCompressor()
        enc._compressor = fake  # bypass lazy real-model load

        data = [{"id": 1, "department": "Engineering"}]
        out1 = enc.encode("employee_records", data)
        out2 = enc.encode("employee_records", data)

        assert out1 == out2
        assert len(fake.calls) == 1  # second encode() call must hit the cache

    def test_different_datasets_both_compress(self):
        enc = LLMLingua2Encoder()
        fake = _FakeCompressor()
        enc._compressor = fake

        enc.encode("employee_records", [{"id": 1, "department": "Engineering"}])
        enc.encode("config", {"a": 1})

        assert len(fake.calls) == 2

    def test_unknown_dataset_raises(self):
        enc = LLMLingua2Encoder()
        enc._compressor = _FakeCompressor()
        try:
            enc.encode("no_such_dataset", [{"a": 1}])
            assert False, "expected ValueError"
        except ValueError:
            pass


class TestCalibrationTargets:
    def test_all_six_datasets_have_targets(self):
        expected = {
            "config", "ecommerce_orders", "employee_records",
            "event_logs", "github_repos", "time_series",
        }
        assert set(TARGET_TOKENS.keys()) == expected


import os
import pytest


@pytest.mark.skipif(
    not os.environ.get("RUN_LLMLINGUA_TESTS"),
    reason="requires the downloaded LLMLingua-2 checkpoint (~2GB); "
           "set RUN_LLMLINGUA_TESTS=1 and run inside benchmark/.venv-llmlingua",
)
class TestRealCompression:
    def test_compresses_shorter_than_source(self):
        import json
        from pathlib import Path

        enc = LLMLingua2Encoder()
        with open(Path(__file__).parent.parent / "datasets" / "employee_records.json") as f:
            data = json.load(f)

        compressed = enc.encode("employee_records", data)
        source = enc._json_encoder.encode("employee_records", data)

        assert isinstance(compressed, str)
        assert len(compressed) > 0
        assert len(compressed) < len(source)
