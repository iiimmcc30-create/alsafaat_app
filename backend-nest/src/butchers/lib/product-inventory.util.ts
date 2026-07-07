export function resolveProductAvailableQuantity(input: {
  availableQuantity?: number | null;
  weightMax?: number | null;
  weightMin?: number | null;
}): number {
  if (
    input.availableQuantity != null &&
    Number.isFinite(input.availableQuantity) &&
    input.availableQuantity >= 0
  ) {
    return input.availableQuantity;
  }
  const fromMax =
    input.weightMax != null && input.weightMax > 0 ? input.weightMax : null;
  const fromMin =
    input.weightMin != null && input.weightMin > 0 ? input.weightMin : null;
  return fromMax ?? fromMin ?? 0;
}
