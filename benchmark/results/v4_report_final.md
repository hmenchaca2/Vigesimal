# Vigesimal Compression Benchmark Report

**Model:** claude-haiku-4-5-20251001  
**Total calls:** 179  
**Estimated cost:** $0.1012  
**Winner (efficiency):** `vigesimal_v4`

## 1. Summary

| Encoder | Accuracy | Avg Encoded Tokens | Avg Total Tokens | Efficiency | Rank |
| --- | --- | --- | --- | --- | --- |
| `vigesimal_v4` | 63.7% | 1887.5 | 2148.9 | 0.30 | 1 |

## 2. Per-Category Accuracy

| Category | `vigesimal_v4` |
| --- | --- |
| aggregation | 15.6% |
| constraint_check | 83.3% |
| field_retrieval | 90.3% |
| filtering | 46.9% |
| structure_aware | 91.7% |

## 3. Per-Dataset Accuracy

| Dataset | `vigesimal_v4` |
| --- | --- |
| config | 83.3% |
| ecommerce_orders | 77.1% |
| employee_records | 51.4% |
| event_logs | 65.7% |
| github_repos | 45.7% |
| time_series | 71.4% |

## 4. Top 5 Questions Where Formats Diverged

_No divergent questions found._

## 5. Token Savings Examples

_Token counts for the encoded data payload (first question per dataset). Percentage is relative to the leftmost encoder._

| Dataset | `vigesimal_v4` |
| --- | --- |
| config | 144 |
| ecommerce_orders | 1740 |
| employee_records | 1863 |
| event_logs | 1887 |
| github_repos | 3182 |
| time_series | 1512 |
