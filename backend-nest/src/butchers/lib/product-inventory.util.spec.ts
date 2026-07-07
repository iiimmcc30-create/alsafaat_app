import { resolveProductAvailableQuantity } from './product-inventory.util';

describe('resolveProductAvailableQuantity', () => {
  it('uses explicit availableQuantity when provided', () => {
    expect(resolveProductAvailableQuantity({ availableQuantity: 25 })).toBe(25);
  });

  it('falls back to weightMax then weightMin', () => {
    expect(resolveProductAvailableQuantity({ weightMax: 10, weightMin: 5 })).toBe(10);
    expect(resolveProductAvailableQuantity({ weightMin: 7 })).toBe(7);
  });

  it('defaults to zero when nothing is set', () => {
    expect(resolveProductAvailableQuantity({})).toBe(0);
  });
});
