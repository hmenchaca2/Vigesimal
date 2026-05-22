export function computeResetThreshold(
  totalDeltaFields: number,
  turnsObserved: number
): number {
  if (turnsObserved === 0 || totalDeltaFields === 0) return 18
  const avg = totalDeltaFields / turnsObserved
  return Math.floor(18 / avg)
}
