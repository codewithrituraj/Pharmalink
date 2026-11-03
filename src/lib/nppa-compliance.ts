import type { Prisma } from "@prisma/client"

type NppaProductInput = {
  id: string
  manufacturerId: string
  composition: string
  packSize: string
  mrp: number
}

export function exceedsNppaCeiling(mrp: number, ceilingPrice: number) {
  return Math.round(mrp * 100) > Math.round(ceilingPrice * 100)
}

export async function persistNppaCompliance(
  tx: Prisma.TransactionClient,
  product: NppaProductInput,
) {
  const now = new Date()
  const reference = await tx.nppaCeilingPrice.findFirst({
    where: {
      composition: product.composition,
      packSize: product.packSize,
      effectiveDate: { lte: now },
    },
    orderBy: { effectiveDate: "desc" },
  })

  if (!reference) {
    await tx.productPriceViolation.updateMany({
      where: { productId: product.id, active: true },
      data: { active: false, resolvedAt: now },
    })
    return { reference: null, violation: null }
  }

  if (exceedsNppaCeiling(product.mrp, reference.ceilingPrice)) {
    const violation = await tx.productPriceViolation.upsert({
      where: { productId_referenceId: { productId: product.id, referenceId: reference.id } },
      update: {
        manufacturerId: product.manufacturerId,
        submittedMrp: product.mrp,
        ceilingPrice: reference.ceilingPrice,
        active: true,
        resolvedAt: null,
      },
      create: {
        productId: product.id,
        manufacturerId: product.manufacturerId,
        referenceId: reference.id,
        submittedMrp: product.mrp,
        ceilingPrice: reference.ceilingPrice,
      },
    })
    await tx.productPriceViolation.updateMany({
      where: { productId: product.id, active: true, referenceId: { not: reference.id } },
      data: { active: false, resolvedAt: now },
    })
    return { reference, violation }
  }

  await tx.productPriceViolation.updateMany({
    where: { productId: product.id, active: true },
    data: { active: false, resolvedAt: now },
  })
  return { reference, violation: null }
}