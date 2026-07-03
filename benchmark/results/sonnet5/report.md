# Vigesimal Compression Benchmark Report

**Model:** claude-sonnet-5  
**Total calls:** 358  
**Estimated cost:** $2.1916  
**Winner (efficiency):** `vigesimal_v4`

## 1. Summary

| Encoder | Accuracy | Avg Encoded Tokens | Avg Total Tokens | Efficiency | Rank |
| --- | --- | --- | --- | --- | --- |
| `vigesimal_v4` | 59.2% | 1869.7 | 2827.5 | 0.21 | 1 |
| `toon` | 57.0% | 1883.5 | 2867.1 | 0.20 | 2 |

## 2. Per-Category Accuracy

| Category | `vigesimal_v4` | `toon` |
| --- | --- | --- |
| aggregation | 13.3% | 13.3% |
| constraint_check | 66.7% | 33.3% |
| field_retrieval | 90.3% | 88.9% |
| filtering | 37.5% | 37.5% |
| structure_aware | 79.2% | 75.0% |

## 3. Per-Dataset Accuracy

| Dataset | `vigesimal_v4` | `toon` |
| --- | --- | --- |
| config | 72.2% | 83.3% |
| ecommerce_orders | 77.1% | 71.4% |
| employee_records | 51.4% | 45.7% |
| event_logs | 51.4% | 54.3% |
| github_repos | 42.9% | 37.1% |
| time_series | 71.4% | 66.7% |

## 4. Top 5 Questions Where Formats Diverged

**1. Question `emp_fr_004`** (dataset: employee_records, category: field_retrieval)

- Correct on: `vigesimal_v4`
- Wrong on: `toon`

**2. Question `emp_ag_005`** (dataset: employee_records, category: aggregation)

- Correct on: `vigesimal_v4`
- Wrong on: `toon`

**3. Question `ord_ag_001`** (dataset: ecommerce_orders, category: aggregation)

- Correct on: `vigesimal_v4`
- Wrong on: `toon`

**4. Question `ord_ag_003`** (dataset: ecommerce_orders, category: aggregation)

- Correct on: `vigesimal_v4`
- Wrong on: `toon`

**5. Question `ord_fi_001`** (dataset: ecommerce_orders, category: filtering)

- Correct on: `toon`
- Wrong on: `vigesimal_v4`

## 5. Token Savings Examples

_Token counts for the encoded data payload (first question per dataset). Percentage is relative to the leftmost encoder._

| Dataset | `toon` | `vigesimal_v4` |
| --- | --- | --- |
| config | 138 | 144 (+4%) |
| ecommerce_orders | 1777 | 1740 (-2%) |
| employee_records | 1946 | 1863 (-4%) |
| event_logs | 1795 | 1887 (+5%) |
| github_repos | 3165 | 3182 (+1%) |
| time_series | 1615 | 1512 (-6%) |
