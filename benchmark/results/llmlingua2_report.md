# Vigesimal Compression Benchmark Report

**Model:** claude-haiku-4-5-20251001  
**Total calls:** 179  
**Estimated cost:** $0.5089  
**Winner (efficiency):** `llmlingua2`

## 1. Summary

| Encoder | Accuracy | Avg Encoded Tokens | Avg Total Tokens | Efficiency | Rank |
| --- | --- | --- | --- | --- | --- |
| `llmlingua2` | 39.1% | 2388.3 | 2738.9 | 0.14 | 1 |

## 2. Per-Category Accuracy

| Category | `llmlingua2` |
| --- | --- |
| aggregation | 2.2% |
| constraint_check | 100.0% |
| field_retrieval | 63.9% |
| filtering | 28.1% |
| structure_aware | 33.3% |

## 3. Per-Dataset Accuracy

| Dataset | `llmlingua2` |
| --- | --- |
| config | 83.3% |
| ecommerce_orders | 48.6% |
| employee_records | 28.6% |
| event_logs | 31.4% |
| github_repos | 25.7% |
| time_series | 38.1% |

## 4. Top 5 Questions Where Formats Diverged

_No divergent questions found._

## 5. Token Savings Examples

_Token counts for the encoded data payload (first question per dataset). Percentage is relative to the leftmost encoder._

| Dataset | `llmlingua2` |
| --- | --- |
| config | 106 |
| ecommerce_orders | 2372 |
| employee_records | 2588 |
| event_logs | 2388 |
| github_repos | 3687 |
| time_series | 1875 |
