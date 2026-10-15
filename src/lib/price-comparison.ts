import { bestScheme, type SchemeInput } from "@/lib/orders"

export type ComparableProduct = {
  id: string
  name: string
  genericName: string
  strength: string
  dosageForm: string
  ptr: number
  gstPercent: number
  minOrderQty: number
  leadTimeDays: number
  manufacturer: { name: string }
  batches: { quantity: number }[]
  schemes: (SchemeInput & { name: string })[]
}

export function buildPriceComparison(products: ComparableProduct[], quantity: number) {
  return products
    .map((product) => {
      const stock = product.batches.reduce((total, batch) => total + batch.quantity, 0)
      const scheme = bestScheme(quantity, product.schemes)
      const discountPercent = scheme?.discountPercent ?? 0
      const ptrAfterScheme = Math.round(product.ptr * (1 - discountPercent / 100) * 100) / 100
      const estimatedUnitIncludingGst = Math.round(ptrAfterScheme * (1 + product.gstPercent / 100) * 100) / 100

      return {
        id: product.id,
        name: product.name,
        manufacturer: product.manufacturer.name,
        ptr: product.ptr,
        ptrAfterScheme,
        gstPercent: product.gstPercent,
        estimatedUnitIncludingGst,
        discountPercent,
        schemeName: scheme?.name ?? null,
        quantity,
        meetsMoq: quantity >= product.minOrderQty,
        minOrderQty: product.minOrderQty,
        leadTimeDays: product.leadTimeDays,
        stock,
        availability: stock === 0 ? "Out" : stock < product.minOrderQty * 10 ? "Low" : "In stock",
      }
    })
    .sort((a, b) => a.estimatedUnitIncludingGst - b.estimatedUnitIncludingGst)
}