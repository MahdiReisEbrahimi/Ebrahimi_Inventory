import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

type DiscountDocument = {
  id: number;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
};
// Preserve existing discounts. Distribute only the change, using integer rials.
export function splitAccountDiscount(
  documents: DiscountDocument[],
  desired: Prisma.Decimal,
) {
  const sum = (values: Prisma.Decimal[]) =>
    values.reduce((a, b) => a.add(b), new Prisma.Decimal(0));
  const subtotal = sum(documents.map((doc) => doc.subtotal));
  const previous = sum(documents.map((doc) => doc.discount));
  if (!desired.isInteger() || desired.lt(0) || desired.gt(subtotal))
    throw new BadRequestException(
      'تخفیف باید بین صفر و جمع اقلام باز صورت‌حساب باشد.',
    );
  const result = new Map(documents.map((doc) => [doc.id, doc.discount]));
  const delta = desired.sub(previous);
  if (delta.isZero()) return result;
  const increasing = delta.gt(0);
  const weights = documents.map((doc) =>
    increasing ? doc.subtotal.sub(doc.discount) : doc.discount,
  );
  const weightSum = sum(weights);
  let remaining = delta.abs();
  documents.forEach((doc, index) => {
    const part = delta.abs().mul(weights[index]!).div(weightSum).floor();
    result.set(
      doc.id,
      increasing ? doc.discount.add(part) : doc.discount.sub(part),
    );
    remaining = remaining.sub(part);
  });
  for (let i = 0; remaining.gt(0) && i < documents.length; i++) {
    if (weights[i]!.isZero()) continue;
    const doc = documents[i]!,
      current = result.get(doc.id)!;
    result.set(doc.id, increasing ? current.add(1) : current.sub(1));
    remaining = remaining.sub(1);
  }
  return result;
}
