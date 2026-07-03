# Vigesimal Compression Benchmark Report

**Model:** claude-haiku-4-5-20251001  
**Total calls:** 895  
**Estimated cost:** $0.7604  
**Winner (efficiency):** `toon`

## 1. Summary

| Encoder | Accuracy | Avg Encoded Tokens | Avg Total Tokens | Efficiency | Rank |
| --- | --- | --- | --- | --- | --- |
| `toon` | 63.1% | 1901.1 | 2200.6 | 0.29 | 1 |
| `vigesimal_v3` | 59.2% | 1978.0 | 2274.7 | 0.26 | 2 |
| `vigesimal_v1` | 58.7% | 2073.9 | 2385.7 | 0.25 | 3 |
| `json_compact` | 56.4% | 3252.7 | 3640.1 | 0.16 | 4 |
| `json_pretty` | 54.2% | 5005.1 | 5945.5 | 0.09 | 5 |

## 2. Per-Category Accuracy

| Category | `toon` | `vigesimal_v3` | `vigesimal_v1` | `json_compact` | `json_pretty` |
| --- | --- | --- | --- | --- | --- |
| aggregation | 11.1% | 11.1% | 8.9% | 8.9% | 4.4% |
| constraint_check | 100.0% | 83.3% | 100.0% | 100.0% | 66.7% |
| field_retrieval | 90.3% | 90.3% | 90.3% | 90.3% | 88.9% |
| filtering | 46.9% | 43.8% | 43.8% | 43.8% | 46.9% |
| structure_aware | 91.7% | 70.8% | 66.7% | 50.0% | 50.0% |

## 3. Per-Dataset Accuracy

| Dataset | `toon` | `vigesimal_v3` | `vigesimal_v1` | `json_compact` | `json_pretty` |
| --- | --- | --- | --- | --- | --- |
| config | 88.9% | 83.3% | 77.8% | 83.3% | 83.3% |
| ecommerce_orders | 74.3% | 71.4% | 65.7% | 65.7% | 62.9% |
| employee_records | 51.4% | 48.6% | 48.6% | 45.7% | 45.7% |
| event_logs | 62.9% | 54.3% | 60.0% | 54.3% | 48.6% |
| github_repos | 40.0% | 40.0% | 42.9% | 37.1% | 37.1% |
| time_series | 81.0% | 76.2% | 71.4% | 71.4% | 66.7% |

## 4. Top 5 Questions Where Formats Diverged

**1. Question `emp_ag_005`** (dataset: employee_records, category: aggregation)

- Correct on: `json_pretty`, `vigesimal_v1`, `vigesimal_v3`
- Wrong on: `json_compact`, `toon`

**2. Question `ord_ag_002`** (dataset: ecommerce_orders, category: aggregation)

- Correct on: `json_compact`, `toon`, `vigesimal_v3`
- Wrong on: `json_pretty`, `vigesimal_v1`

**3. Question `ord_ag_004`** (dataset: ecommerce_orders, category: aggregation)

- Correct on: `json_compact`, `toon`
- Wrong on: `json_pretty`, `vigesimal_v1`, `vigesimal_v3`

**4. Question `ord_fi_006`** (dataset: ecommerce_orders, category: filtering)

- Correct on: `json_pretty`, `vigesimal_v3`
- Wrong on: `json_compact`, `toon`, `vigesimal_v1`

**5. Question `ord_sa_001`** (dataset: ecommerce_orders, category: structure_aware)

- Correct on: `toon`, `vigesimal_v1`, `vigesimal_v3`
- Wrong on: `json_pretty`, `json_compact`

## 5. Token Savings Examples

_Token counts for the encoded data payload (first question per dataset). Percentage is relative to the leftmost encoder._

| Dataset | `json_compact` | `json_pretty` | `toon` | `vigesimal_v1` | `vigesimal_v3` |
| --- | --- | --- | --- | --- | --- |
| config | 106 | 174 (+64%) | 138 (+30%) | 157 (+48%) | 296 (+179%) |
| ecommerce_orders | 2924 | 4473 (+53%) | 1777 (-39%) | 1900 (-35%) | 1883 (-36%) |
| employee_records | 3750 | 6450 (+72%) | 1946 (-48%) | 2164 (-42%) | 2040 (-46%) |
| event_logs | 3051 | 4851 (+59%) | 1795 (-41%) | 2005 (-34%) | 1864 (-39%) |
| github_repos | 5952 | 9152 (+54%) | 3165 (-47%) | 3451 (-42%) | 3173 (-47%) |
| time_series | 2496 | 3816 (+53%) | 1615 (-35%) | 1676 (-33%) | 1673 (-33%) |
