# Vigesimal Compression Benchmark Report

**Model:** claude-haiku-4-5-20251001  
**Total calls:** 179  
**Estimated cost:** $0.1015  
**Winner (efficiency):** `vigesimal_v4`

## 1. Summary

| Encoder | Accuracy | Avg Encoded Tokens | Avg Total Tokens | Efficiency | Rank |
| --- | --- | --- | --- | --- | --- |
| `vigesimal_v4` | 59.8% | 1890.5 | 2153.3 | 0.28 | 1 |

## 2. Per-Category Accuracy

| Category | `vigesimal_v4` |
| --- | --- |
| aggregation | 8.9% |
| constraint_check | 100.0% |
| field_retrieval | 90.3% |
| filtering | 43.8% |
| structure_aware | 75.0% |

## 3. Per-Dataset Accuracy

| Dataset | `vigesimal_v4` |
| --- | --- |
| config | 77.8% |
| ecommerce_orders | 74.3% |
| employee_records | 48.6% |
| event_logs | 57.1% |
| github_repos | 40.0% |
| time_series | 76.2% |

## 4. Top 5 Questions Where Formats Diverged

_No divergent questions found._

## 5. Token Savings Examples

_Token counts for the encoded data payload (first question per dataset). Percentage is relative to the leftmost encoder._

| Dataset | `vigesimal_v4` |
| --- | --- |
| config | 147 |
| ecommerce_orders | 1743 |
| employee_records | 1866 |
| event_logs | 1890 |
| github_repos | 3185 |
| time_series | 1515 |
