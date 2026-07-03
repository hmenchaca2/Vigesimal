"""
Question generator for the vigesimal compression benchmark.

Produces ~35 questions per dataset (210 total) distributed across 5 categories:
  field_retrieval  33%  ~12 per dataset
  aggregation      30%  ~10 per dataset
  filtering        23%   ~8 per dataset
  structure_aware  12%   ~4 per dataset
  constraint_check  2%   ~1 per dataset
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from typing import Any


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Question:
    id: str
    category: str          # field_retrieval | aggregation | filtering | structure_aware | constraint_check
    dataset: str
    question_text: str
    expected_answer: str   # always stored as string
    answer_type: str       # exact | numeric | list | boolean


# ---------------------------------------------------------------------------
# Dataset-specific metadata
# ---------------------------------------------------------------------------

# Maps dataset name -> primary key field (used to identify records in questions)
PRIMARY_KEYS: dict[str, str | None] = {
    "employee_records": "id",
    "ecommerce_orders": "order_id",
    "time_series": "date",
    "github_repos": "id",
    "event_logs": "event_id",
    "config": None,
}

# Maps dataset name -> human-readable singular/plural labels
LABELS: dict[str, tuple[str, str]] = {
    "employee_records": ("employee", "employees"),
    "ecommerce_orders": ("order", "orders"),
    "time_series": ("day", "days"),
    "github_repos": ("repo", "repos"),
    "event_logs": ("event", "events"),
    "config": ("config entry", "config entries"),
}

# Short prefix for question IDs
ID_PREFIXES: dict[str, str] = {
    "employee_records": "emp",
    "ecommerce_orders": "ord",
    "time_series": "ts",
    "github_repos": "repo",
    "event_logs": "evt",
    "config": "cfg",
}

# Category short codes
CAT_CODES: dict[str, str] = {
    "field_retrieval": "fr",
    "aggregation": "ag",
    "filtering": "fi",
    "structure_aware": "sa",
    "constraint_check": "cc",
}

# Numeric fields per dataset (used for sum/average aggregations)
NUMERIC_FIELDS: dict[str, list[str]] = {
    "employee_records": ["salary", "seniority_years"],
    "ecommerce_orders": ["quantity", "unit_price", "total_price"],
    "time_series": ["page_views", "clicks", "conversions", "revenue", "bounce_rate"],
    "github_repos": ["stars", "forks", "open_issues"],
    "event_logs": ["duration_ms"],
    "config": [],
}

# Categorical fields that are good for grouping/counting
CATEGORICAL_FIELDS: dict[str, list[str]] = {
    "employee_records": ["department", "role", "location", "active"],
    "ecommerce_orders": ["category", "status"],
    "time_series": [],
    "github_repos": ["language", "has_wiki", "archived"],
    "event_logs": ["level", "service", "success"],
    "config": [],
}

# Field used as "display name" when listing results
NAME_FIELDS: dict[str, str | None] = {
    "employee_records": "name",
    "ecommerce_orders": "order_id",
    "time_series": "date",
    "github_repos": "name",
    "event_logs": "event_id",
    "config": None,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _to_str(value: Any) -> str:
    """Convert any answer value to its canonical string form."""
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def _field_answer(value: Any) -> tuple[str, str]:
    """Return (answer_str, answer_type) for a scalar field value."""
    if isinstance(value, bool):
        return ("yes" if value else "no"), "boolean"
    if isinstance(value, float):
        return f"{value:.2f}", "numeric"
    if value is None:
        return "null", "exact"
    return str(value), "exact"


def _sorted_list_str(values: list[Any]) -> str:
    str_vals = sorted(str(v) for v in values)
    return ", ".join(str_vals)


# ---------------------------------------------------------------------------
# Generator
# ---------------------------------------------------------------------------

class QuestionGenerator:
    """Generates benchmark questions for a single dataset."""

    def __init__(self, dataset_name: str, data: Any, seed: int = 42):
        self.dataset_name = dataset_name
        self.data = data
        self.rng = random.Random(seed)

        # Normalise: config is a dict, everything else is a list of dicts
        if isinstance(data, dict):
            self.records: list[dict] = [data]
            self.is_nested = True
        elif isinstance(data, list):
            self.records = data
            self.is_nested = False
        else:
            self.records = []
            self.is_nested = False

        self.pk = PRIMARY_KEYS.get(dataset_name)
        self.singular, self.plural = LABELS.get(dataset_name, ("record", "records"))
        self.prefix = ID_PREFIXES.get(dataset_name, "q")
        self.name_field = NAME_FIELDS.get(dataset_name)
        self.numeric_fields = NUMERIC_FIELDS.get(dataset_name, [])
        self.categorical_fields = CATEGORICAL_FIELDS.get(dataset_name, [])

        # Derive scalar field names from the first record
        if self.records:
            self.field_names: list[str] = [
                k for k, v in self.records[0].items()
                if not isinstance(v, (dict, list))
            ]
        else:
            self.field_names = []

        self._counters: dict[str, int] = {c: 0 for c in CAT_CODES}

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def generate(self) -> list[Question]:
        if self.dataset_name == "config":
            return self._generate_config_questions()

        questions: list[Question] = []
        questions.extend(self._gen_field_retrieval(n=12))
        questions.extend(self._gen_aggregation(n=10))
        questions.extend(self._gen_filtering(n=8))
        questions.extend(self._gen_structure_aware(n=4))
        questions.extend(self._gen_constraint_check(n=1))
        return questions

    # ------------------------------------------------------------------
    # ID helpers
    # ------------------------------------------------------------------

    def _next_id(self, category: str) -> str:
        code = CAT_CODES[category]
        self._counters[category] = self._counters.get(category, 0) + 1
        n = self._counters[category]
        return f"{self.prefix}_{code}_{n:03d}"

    def _make(
        self,
        category: str,
        question_text: str,
        expected_answer: Any,
        answer_type: str,
    ) -> Question:
        return Question(
            id=self._next_id(category),
            category=category,
            dataset=self.dataset_name,
            question_text=question_text,
            expected_answer=_to_str(expected_answer),
            answer_type=answer_type,
        )

    # ------------------------------------------------------------------
    # field_retrieval  (~12 per dataset)
    # ------------------------------------------------------------------

    def _gen_field_retrieval(self, n: int) -> list[Question]:
        questions: list[Question] = []
        if not self.records or not self.field_names:
            return questions

        # Fields to ask about — exclude the PK itself
        askable = [f for f in self.field_names if f != self.pk]
        if not askable:
            return questions

        sampled = self.rng.choices(self.records, k=n)
        for record in sampled:
            field_name = self.rng.choice(askable)
            pk_val = str(record.get(self.pk)) if self.pk else "(root)"
            ans_str, ans_type = _field_answer(record.get(field_name))

            q_text = (
                f"What is the {field_name} of the {self.singular} "
                f"with {self.pk} {pk_val}?"
            )
            questions.append(Question(
                id=self._next_id("field_retrieval"),
                category="field_retrieval",
                dataset=self.dataset_name,
                question_text=q_text,
                expected_answer=ans_str,
                answer_type=ans_type,
            ))

        return questions

    # ------------------------------------------------------------------
    # aggregation  (~10 per dataset)
    # ------------------------------------------------------------------

    def _gen_aggregation(self, n: int) -> list[Question]:
        questions: list[Question] = []

        # Slot split: up to 6 count-based, remaining numeric
        count_budget = min(n - 2, 6)
        numeric_budget = n - count_budget

        # ---- Count-based (categorical) ----
        if self.categorical_fields and self.records:
            for _ in range(count_budget):
                cat_field = self.rng.choice(self.categorical_fields)
                all_vals = [r.get(cat_field) for r in self.records if r.get(cat_field) is not None]
                if not all_vals:
                    continue
                value = self.rng.choice(all_vals)
                count = sum(1 for r in self.records if r.get(cat_field) == value)
                val_str = ("yes" if value else "no") if isinstance(value, bool) else str(value)
                q_text = f"How many {self.plural} have {cat_field} equal to '{val_str}'?"
                questions.append(self._make("aggregation", q_text, count, "numeric"))

        # ---- Numeric (sum / average) ----
        if self.numeric_fields and self.records:
            ops = (["total", "average"] * (numeric_budget // 2 + 2))[:numeric_budget]
            self.rng.shuffle(ops)
            for op in ops:
                if len(questions) >= n:
                    break
                num_field = self.rng.choice(self.numeric_fields)

                # 50% chance: filter by a categorical field
                used_filter = False
                if self.categorical_fields and self.rng.random() < 0.5:
                    cat_field = self.rng.choice(self.categorical_fields)
                    all_vals = [
                        r.get(cat_field) for r in self.records
                        if r.get(cat_field) is not None and not isinstance(r.get(cat_field), bool)
                    ]
                    if all_vals:
                        filter_val = self.rng.choice(all_vals)
                        subset = [r for r in self.records if r.get(cat_field) == filter_val]
                        nums = [_safe_float(r.get(num_field, 0)) for r in subset]
                        if op == "total":
                            result = round(sum(nums), 2)
                            q_text = (
                                f"What is the total {num_field} for {self.plural} "
                                f"where {cat_field} is '{filter_val}'?"
                            )
                        else:
                            result = round(sum(nums) / len(nums), 2) if nums else 0.0
                            q_text = (
                                f"What is the average {num_field} for {self.plural} "
                                f"where {cat_field} is '{filter_val}'?"
                            )
                        questions.append(self._make("aggregation", q_text, result, "numeric"))
                        used_filter = True

                if not used_filter:
                    nums = [_safe_float(r.get(num_field, 0)) for r in self.records]
                    if op == "total":
                        result = round(sum(nums), 2)
                        q_text = f"What is the total {num_field} across all {self.plural}?"
                    else:
                        result = round(sum(nums) / len(nums), 2) if nums else 0.0
                        q_text = f"What is the average {num_field} across all {self.plural}?"
                    questions.append(self._make("aggregation", q_text, result, "numeric"))

        # Fallback if no questions generated
        if not questions:
            q_text = f"How many {self.plural} are in the dataset?"
            questions.append(self._make("aggregation", q_text, len(self.records), "numeric"))

        return questions[:n]

    # ------------------------------------------------------------------
    # filtering  (~8 per dataset)
    # ------------------------------------------------------------------

    def _gen_filtering(self, n: int) -> list[Question]:
        questions: list[Question] = []
        if not self.categorical_fields or not self.records:
            return questions

        list_field = self.name_field if self.name_field else self.pk
        if not list_field:
            return questions

        seen_conditions: set[tuple[str, str]] = set()
        attempts = 0

        while len(questions) < n and attempts < n * 10:
            attempts += 1
            cat_field = self.rng.choice(self.categorical_fields)
            all_vals = [r.get(cat_field) for r in self.records if r.get(cat_field) is not None]
            if not all_vals:
                continue
            value = self.rng.choice(all_vals)
            val_str = ("yes" if value else "no") if isinstance(value, bool) else str(value)

            condition_key = (cat_field, val_str)
            if condition_key in seen_conditions:
                continue
            seen_conditions.add(condition_key)

            matching = [r for r in self.records if r.get(cat_field) == value]
            if not matching:
                continue

            ids = [str(r[list_field]) for r in matching if r.get(list_field) is not None]
            if not ids:
                continue

            answer_str = ", ".join(sorted(ids, key=lambda x: x.lower()))
            q_text = (
                f"List the {list_field} of all {self.plural} "
                f"where {cat_field} is '{val_str}'."
            )
            questions.append(self._make("filtering", q_text, answer_str, "list"))

        return questions[:n]

    # ------------------------------------------------------------------
    # structure_aware  (~4 per dataset)
    # ------------------------------------------------------------------

    def _gen_structure_aware(self, n: int) -> list[Question]:
        questions: list[Question] = []

        # Q1: field count
        if self.field_names:
            q_text = f"How many fields does each {self.singular} record have?"
            questions.append(self._make("structure_aware", q_text, len(self.field_names), "numeric"))

        # Q2: field names (sorted, comma-separated)
        if self.field_names:
            sorted_fields = ", ".join(sorted(self.field_names))
            q_text = f"What are the field names in the {self.dataset_name} dataset?"
            questions.append(self._make("structure_aware", q_text, sorted_fields, "list"))

        # Q3: record count
        q_text = f"How many records are in the {self.dataset_name} dataset?"
        questions.append(self._make("structure_aware", q_text, len(self.records), "numeric"))

        # Q4: dataset name
        q_text = "What is the name of this dataset?"
        questions.append(self._make("structure_aware", q_text, self.dataset_name, "exact"))

        return questions[:n]

    # ------------------------------------------------------------------
    # constraint_check  (~1 per dataset)
    # ------------------------------------------------------------------

    def _gen_constraint_check(self, n: int) -> list[Question]:
        """Present a malformed record and ask whether it is valid."""
        MALFORMED: dict[str, str] = {
            "employee_records": (
                "id=999, name='Test User', department='Quantum', role='Chief Everything Officer', "
                "seniority_years=-5, location='Narnia', salary='unknown', active='maybe'"
            ),
            "ecommerce_orders": (
                "order_id=9999, customer_name='Ghost', product_name='Invisible Item', "
                "category='Misc', quantity=-1, unit_price='free', total_price=-5.00, "
                "status='in_transit_maybe', created_at='tomorrow'"
            ),
            "time_series": (
                "date='not-a-date', page_views=-100, clicks='many', conversions=null, "
                "revenue='a lot', bounce_rate=150.0"
            ),
            "github_repos": (
                "id=99999, name='', full_name=null, description=42, stars=-1, "
                "forks='lots', language=true, open_issues=-3, has_wiki='yep', archived='nope'"
            ),
            "event_logs": (
                "event_id='', timestamp='yesterday', level='CRITICAL_ALERT', "
                "service=null, message=42, duration_ms=-500, success='perhaps'"
            ),
            "config": (
                "database.host=null, database.port='not-a-port', cache.ttl=-1, "
                "api.timeout='infinite', features.enabled='maybe'"
            ),
        }

        desc = MALFORMED.get(self.dataset_name, "id=0, all fields missing or invalid")
        q_text = (
            f"Is the following record valid according to the {self.dataset_name} schema? "
            f"{desc}"
        )
        return [self._make("constraint_check", q_text, "no", "boolean")][:n]

    # ------------------------------------------------------------------
    # Special: config dataset (nested dict)
    # ------------------------------------------------------------------

    def _generate_config_questions(self) -> list[Question]:
        questions: list[Question] = []
        data = self.data

        if not isinstance(data, dict):
            return questions

        top_keys = list(data.keys())

        # structure_aware: top-level key count
        q_text = "How many top-level keys does the config have?"
        questions.append(self._make("structure_aware", q_text, len(top_keys), "numeric"))

        # structure_aware: top-level key names
        sorted_keys = ", ".join(sorted(top_keys))
        q_text = "What are the top-level keys in the config?"
        questions.append(self._make("structure_aware", q_text, sorted_keys, "list"))

        # structure_aware: dataset name
        q_text = "What is the name of this dataset?"
        questions.append(self._make("structure_aware", q_text, self.dataset_name, "exact"))

        # structure_aware: record count
        q_text = "How many records are in the config dataset?"
        questions.append(self._make("structure_aware", q_text, 1, "numeric"))

        # field_retrieval: walk sub-objects
        fr_count = 0
        for sub_key, sub_val in data.items():
            if not isinstance(sub_val, dict):
                continue
            for field_key, field_val in sub_val.items():
                if isinstance(field_val, (dict, list)):
                    continue
                ans_str, ans_type = _field_answer(field_val)
                q_text = f"What is the value of {sub_key}.{field_key} in the config?"
                questions.append(Question(
                    id=self._next_id("field_retrieval"),
                    category="field_retrieval",
                    dataset=self.dataset_name,
                    question_text=q_text,
                    expected_answer=ans_str,
                    answer_type=ans_type,
                ))
                fr_count += 1
                if fr_count >= 12:
                    break
            if fr_count >= 12:
                break

        # aggregation: count sub-keys in a section
        for sub_key, sub_val in data.items():
            if isinstance(sub_val, dict):
                q_text = f"How many keys does the {sub_key} section of the config have?"
                questions.append(self._make("aggregation", q_text, len(sub_val), "numeric"))
                break

        # constraint_check
        questions.extend(self._gen_constraint_check(1))

        return questions


# ---------------------------------------------------------------------------
# __main__ — sample run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Synthetic 20-employee dataset for demonstration
    sample_data = [
        {
            "id": i + 1,
            "name": f"Employee {i + 1}",
            "department": ["Engineering", "Marketing", "HR", "Finance"][i % 4],
            "role": ["Engineer", "Manager", "Analyst", "Director"][i % 4],
            "seniority_years": (i % 10) + 1,
            "location": ["NYC", "SF", "Austin", "Remote"][i % 4],
            "salary": 60000 + (i * 1000),
            "active": i % 5 != 0,
        }
        for i in range(20)
    ]

    gen = QuestionGenerator("employee_records", sample_data, seed=7)
    questions = gen.generate()

    print(f"Generated {len(questions)} questions for 'employee_records' (20-record sample)\n")
    print(f"{'ID':<18} {'Category':<20} {'Type':<10} Question / Answer")
    print("-" * 110)

    seen_cats: set[str] = set()
    shown = 0
    for q in questions:
        if q.category not in seen_cats:
            seen_cats.add(q.category)
            print(f"{q.id:<18} {q.category:<20} {q.answer_type:<10} {q.question_text}")
            print(f"{'':18} {'Expected:':<20} {'':10} {q.expected_answer}")
            print()
            shown += 1
        if shown >= 5:
            break

    print("\nCategory distribution:")
    cats = Counter(q.category for q in questions)
    total = sum(cats.values())
    for cat in ["field_retrieval", "aggregation", "filtering", "structure_aware", "constraint_check"]:
        count = cats.get(cat, 0)
        pct = count / total * 100 if total else 0
        print(f"  {cat:<22} {count:>3}  ({pct:.0f}%)")
