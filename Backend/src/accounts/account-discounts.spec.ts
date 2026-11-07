import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { splitAccountDiscount } from './account-discounts.js';
const doc = (id: number, subtotal: number, discount: number) => ({
  id,
  subtotal: new Prisma.Decimal(subtotal),
  discount: new Prisma.Decimal(discount),
});
const values = (value: Map<number, Prisma.Decimal>) =>
  [...value.values()].map(Number);
describe('Account discount distribution in exact rials', () => {
  it('preserves each historical discount when the total is unchanged', () => {
    expect(
      values(
        splitAccountDiscount(
          [doc(1, 100, 7), doc(2, 200, 3)],
          new Prisma.Decimal(10),
        ),
      ),
    ).toEqual([7, 3]);
  });
  it('increases or reduces discounts without losing a single rial', () => {
    expect(
      values(
        splitAccountDiscount(
          [doc(1, 100, 0), doc(2, 200, 0)],
          new Prisma.Decimal(10),
        ),
      ),
    ).toEqual([4, 6]);
    expect(
      values(
        splitAccountDiscount(
          [doc(1, 100, 7), doc(2, 200, 3)],
          new Prisma.Decimal(4),
        ),
      ),
    ).toEqual([2, 2]);
    expect(
      values(
        splitAccountDiscount(
          [doc(1, 100, 100), doc(2, 200, 0)],
          new Prisma.Decimal(300),
        ),
      ),
    ).toEqual([100, 200]);
  });
  it('rejects fractional rials and discounts above the combined subtotal', () => {
    expect(() =>
      splitAccountDiscount([doc(1, 100, 0)], new Prisma.Decimal('0.5')),
    ).toThrow('تخفیف');
    expect(() =>
      splitAccountDiscount([doc(1, 100, 0)], new Prisma.Decimal(101)),
    ).toThrow('تخفیف');
  });
});
