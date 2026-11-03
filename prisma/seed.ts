import { PrismaClient } from "@prisma/client"

import { hashPassword } from "../src/lib/password"

const prisma = new PrismaClient()

const DEMO_PASSWORD = "password@123"

const manufacturers = [
  { name: "Apex Pharma", prefix: "apex", drugLicense: "MH-TZ4-184920", gstNumber: "27AAPCA1234F1Z5", address: "Plot 42, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra 400093" },
  { name: "BioCure Labs", prefix: "biocure", drugLicense: "KA-BLR-294811", gstNumber: "29AABCB5678G1Z2", address: "Phase II, Peenya Industrial Area, Bengaluru, Karnataka 560058" },
  { name: "MediLife Sciences", prefix: "medilife", drugLicense: "DL-DEL-392810", gstNumber: "07AABCM9012H1Z9", address: "Okhla Industrial Area Phase III, New Delhi 110020" },
  { name: "Zenith Health", prefix: "zenith", drugLicense: "WB-KOL-482019", gstNumber: "19AABCZ3456J1Z4", address: "Sector V, Salt Lake City, Kolkata, West Bengal 700091" },
]

const stockists = [
  { name: "City Medicos", prefix: "city", drugLicense: "MH-MUM-592811", gstNumber: "27AABFC7890K1Z1", address: "Shop 12-14, Medical Complex, Dadar West, Mumbai 400028" },
  { name: "Global Pharma Distributors", prefix: "global", drugLicense: "KA-BLR-683920", gstNumber: "29AABFG2345L1Z8", address: "Brigade Road, Ashok Nagar, Bengaluru 560025" },
  { name: "Prime Healthcare", prefix: "prime", drugLicense: "DL-ND-782910", gstNumber: "07AABFP6789M1Z6", address: "Connaught Place, New Delhi 110001" },
]

const catalogue = [
  ["Pain relief", "Paracetamol 500mg", "Paramax", 10],
  ["Pain relief", "Ibuprofen 400mg", "Ibufast", 18],
  ["Antibiotics", "Amoxicillin 250mg", "Amoxicure", 45],
  ["Antibiotics", "Azithromycin 500mg", "Azicore", 72],
  ["Antidiabetics", "Metformin 500mg", "DiabeControl", 30],
  ["Cardiac", "Atorvastatin 10mg", "Statinor", 55],
  ["Vitamins", "Methylcobalamin 1500mcg", "Neurovita", 95],
  ["Vitamins", "Calcium + Vitamin D3", "CalciSure", 120],
  ["Respiratory", "Montelukast 10mg", "Montairis", 68],
  ["Gastro", "Pantoprazole 40mg", "GastroCalm", 42],
] as const

function futureDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function pastDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/** Deterministic pseudo-random so repeated seeds produce the same demo data. */
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/** Currency is stored to paise, so no float noise reaches the interface. */
function rupees(value: number) {
  return Math.round(value * 100) / 100
}

async function main() {
  console.log("Resetting and seeding PharmaLink demo data...")

  await prisma.paymentSubmission.deleteMany()
  await prisma.swapOrder.deleteMany()
  await prisma.marketplaceListing.deleteMany()
  await prisma.traceVerificationLog.deleteMany()
  await prisma.h1RegisterEntry.deleteMany()
  await prisma.productPriceViolation.deleteMany()
  await prisma.nppaCeilingPrice.deleteMany()
  await prisma.returnItem.deleteMany()
  await prisma.returnRequest.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.verificationDocument.deleteMany()
  await prisma.scheme.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.favourite.deleteMany()
  await prisma.cartDraftItem.deleteMany()
  await prisma.cartDraft.deleteMany()
  await prisma.inventoryBatch.deleteMany()
  await prisma.demandSample.deleteMany()
  await prisma.orderAudit.deleteMany()
  await prisma.orderItemAllocation.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.jobRun.deleteMany()
  await prisma.order.deleteMany()
  await prisma.batch.deleteMany()
  await prisma.product.deleteMany()
  await prisma.accessGrant.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@pharmalink.com",
      password: await hashPassword(DEMO_PASSWORD),
      role: "ADMIN",
    },
  })

  const manufacturerRecords = await Promise.all(
    manufacturers.map(async (manufacturer, index) => prisma.organization.create({
      data: {
        name: manufacturer.name,
        type: "MANUFACTURER",
        drugLicense: manufacturer.drugLicense,
        gstNumber: manufacturer.gstNumber,
        address: manufacturer.address,
        region: ["West", "South", "North", "East"][index],
        status: "VERIFIED",
        users: {
          create: {
            email: `mfr@${manufacturer.prefix}.com`,
            password: await hashPassword(DEMO_PASSWORD),
            role: "MANUFACTURER",
          },
        },
      },
    }))
  )

  const stockistRecords = await Promise.all(
    stockists.map(async (stockist, index) => prisma.organization.create({
      data: {
        name: stockist.name,
        type: "STOCKIST",
        drugLicense: stockist.drugLicense,
        gstNumber: stockist.gstNumber,
        address: stockist.address,
        region: ["West", "South", "North"][index],
        status: "VERIFIED",
        users: {
          create: {
            email: `stockist@${stockist.prefix}.com`,
            password: await hashPassword(DEMO_PASSWORD),
            role: "STOCKIST",
          },
        },
      },
    }))
  )

  await prisma.organization.create({
    data: {
      name: "Nova Therapeutics",
      type: "MANUFACTURER",
      drugLicense: "GJ-AHD-APP-2041",
      gstNumber: "24AABCN2041R1Z7",
      address: "Science City Road, Ahmedabad, Gujarat 380060",
      region: "West",
      status: "PENDING",
      verificationRemark: "Drug-license document awaiting manual review",
      users: {
        create: {
          email: "review@nova.example",
          password: await hashPassword(DEMO_PASSWORD),
          role: "MANUFACTURER",
        },
      },
      documents: {
        create: {
          name: "drug-license.pdf",
          mimeType: "application/pdf",
          size: 184320,
          path: "seed/documents/nova-drug-license.pdf",
        },
      },
    },
  })

  for (const [manufacturerIndex, manufacturer] of manufacturerRecords.entries()) {
    for (const [stockistIndex, stockist] of stockistRecords.entries()) {
      const status = stockistIndex === 0 ? "VERIFIED" : manufacturerIndex === stockistIndex ? "PENDING" : "REJECTED"
      await prisma.accessGrant.create({ data: { manufacturerId: manufacturer.id, stockistId: stockist.id, status, message: status === "PENDING" ? "We would like access to your regional catalogue." : null } })
    }
  }

  let productCount = 0
  let schemeCount = 0
  const seededProducts: { id: string; basePrice: number; index: number }[] = []
  for (const [manufacturerIndex, manufacturer] of manufacturerRecords.entries()) {
    for (const [category, generic, brand, basePrice] of catalogue) {
      for (let variant = 1; variant <= 2; variant += 1) {
        const product = await prisma.product.create({
          data: {
            manufacturerId: manufacturer.id,
            name: `${brand} ${manufacturer.name.split(" ")[0]} ${variant}`,
            genericName: generic,
            composition: generic,
            category,
            dosageForm: category === "Vitamins" ? "Capsule" : category === "Respiratory" ? "Inhaler" : "Tablet",
            strength: generic.split(" ").slice(1).join(" "),
            packSize: variant === 1 ? "10 x 10 tablets" : "20 x 10 tablets",
            gstPercent: category === "Vitamins" ? 5 : 12,
            isPrescription: category === "Antibiotics" || category === "Cardiac",
            isScheduleH1: category === "Antibiotics" && variant === 2,
            storage: category === "Vitamins" ? "Store in a cool, dry place" : "Store below 25 C",
            minOrderQty: variant === 1 ? 5 : 10,
            leadTimeDays: [5, 7, 10, 14][(productCount + variant) % 4],
            mrp: rupees(basePrice * 1.5),
            ptr: rupees(basePrice * 1.1),
            pts: rupees(basePrice),
            availability: 5000 - manufacturerIndex * 350 + (variant === 1 ? 850 : 180),
            batches: {
              create: [
                { batchNumber: `B-${manufacturerIndex + 1}-${productCount + 1}-A`, quantity: 5000 - manufacturerIndex * 350, mfgDate: new Date(), expiryDate: futureDate(365 + manufacturerIndex * 90) },
                { batchNumber: `B-${manufacturerIndex + 1}-${productCount + 1}-B`, quantity: variant === 1 ? 850 : 180, mfgDate: new Date(Date.now() - 300 * 86400000), expiryDate: futureDate(35 + manufacturerIndex * 25) },
              ],
            },
          },
        })
        seededProducts.push({ id: product.id, basePrice, index: productCount })

        if (variant === 1) {
          await prisma.scheme.create({
            data: {
              productId: product.id,
              name: "Trade saver: 5% off on 10+",
              type: "SLAB_DISCOUNT",
              minQuantity: 10,
              discountPercent: 5,
              validFrom: new Date(),
              validUntil: futureDate(120),
            },
          })
          schemeCount += 1
          if (productCount % 3 === 0) {
            await prisma.scheme.create({
              data: {
                productId: product.id,
                name: "Mega slab: 10% off on 50+",
                type: "SLAB_DISCOUNT",
                minQuantity: 50,
                discountPercent: 10,
                validFrom: new Date(),
                validUntil: futureDate(120),
              },
            })
            schemeCount += 1
          }
        } else {
          await prisma.scheme.create({
            data: {
              productId: product.id,
              name: "Bonus pack: Buy 10 Get 1 Free",
              type: "FREE_GOODS",
              minQuantity: 10,
              freeQuantity: 1,
              discountPercent: 0,
              validFrom: new Date(),
              validUntil: futureDate(120),
            },
          })
          schemeCount += 1
        }
        productCount += 1
      }
    }
  }

  const productsByManufacturer = new Map<string, typeof seededProducts>()
  for (const seeded of seededProducts) {
    const record = await prisma.product.findUniqueOrThrow({
      where: { id: seeded.id },
      select: { manufacturerId: true },
    })
    const list = productsByManufacturer.get(record.manufacturerId) ?? []
    list.push(seeded)
    productsByManufacturer.set(record.manufacturerId, list)
  }

  // Granted pairs decide which orders are legitimate for the demo account.
  const grants = await prisma.accessGrant.findMany({ where: { status: "VERIFIED" } })
  const demandByProduct = new Map<string, number>()
  let orderCount = 0
  let deliveredCount = 0

  for (const grant of grants) {
    const manufacturerProducts = productsByManufacturer.get(grant.manufacturerId) ?? []
    const catalogueForGrant = manufacturerProducts.filter((product) => product.index % 3 !== 1).slice(0, 10)
    if (catalogueForGrant.length === 0) continue

    // Twelve months of monthly replenishment, so forecasts, spend analytics and
    // reorder timing all have real history to work from.
    for (let monthAgo = 12; monthAgo >= 1; monthAgo -= 1) {
      // Each product appears in roughly half the months, which is what a real
      // replenishment history looks like and is enough to model a trend.
      const chosen = catalogueForGrant.filter((_, index) => (index + monthAgo) % 2 === 0)
      if (chosen.length === 0) continue

      let subtotal = 0
      let discount = 0
      let gst = 0
      const lines: {
        productId: string
        quantity: number
        price: number
        allocations: { batchId: string; quantity: number }[]
      }[] = []

      for (const [lineIndex, product] of chosen.entries()) {
        const base = 110 + (product.index % 4) * 35
        const seasonal = 1 + Math.sin(((new Date().getMonth() - monthAgo) / 12) * Math.PI * 2) * 0.2
        const quantity = Math.max(
          5,
          Math.round((base * seasonal + noise(product.index * 7 + monthAgo + lineIndex) * 40) / 5) * 5,
        )
        const price = Number((product.basePrice * 1.1).toFixed(2))
        const lineTotal = price * quantity
        const scheme = quantity >= 20 ? 0.05 : quantity >= 10 ? 0.03 : 0
        const lineDiscount = lineTotal * scheme
        subtotal += lineTotal
        discount += lineDiscount
        gst += (lineTotal - lineDiscount) * 0.12

        // FEFO allocation against the manufacturer stock, so the delivered
        // inventory rows carry real batch numbers and expiry dates.
        const available = await prisma.batch.findMany({
          where: { productId: product.id, quantity: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        })
        let remaining = quantity
        const allocations: { batchId: string; quantity: number }[] = []
        for (const batch of available) {
          if (remaining <= 0) break
          const take = Math.min(batch.quantity, remaining)
          allocations.push({ batchId: batch.id, quantity: take })
          remaining -= take
        }

        lines.push({ productId: product.id, quantity, price, allocations })
        demandByProduct.set(product.id, (demandByProduct.get(product.id) ?? 0) + quantity)
      }

      const placedAt = pastDate(monthAgo * 30 + Math.round(noise(orderCount) * 8))
      const periodStart = new Date(placedAt.getFullYear(), placedAt.getMonth(), 1)
      const total = subtotal - discount + gst
      const order = await prisma.order.create({
        data: {
          buyerId: grant.stockistId,
          sellerId: grant.manufacturerId,
          status: "DELIVERED",
          subtotal,
          discount,
          gst,
          total,
          poNumber: `PO-${placedAt.getFullYear()}${String(placedAt.getMonth() + 1).padStart(2, "0")}-${String(orderCount + 1).padStart(4, "0")}`,
          invoiceNumber: `INV-${String(orderCount + 1).padStart(4, "0")}`,
          invoiceCreatedAt: placedAt,
          isPaid: monthAgo > 2,
          paidAt: monthAgo > 2 ? new Date(placedAt.getTime() + 15 * 86_400_000) : null,
          paymentRef: monthAgo > 2 ? `NEFT-${String(orderCount + 1).padStart(6, "0")}` : null,
          transporter: "PharmaLink Express",
          trackingNumber: `TRK${String(orderCount + 1).padStart(8, "0")}`,
          expectedDelivery: new Date(placedAt.getTime() + 4 * 86_400_000),
          createdAt: placedAt,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              price: line.price,
            })),
          },
          audits: {
            create: [
              { status: "PLACED", note: "Purchase order submitted by stockist", createdAt: placedAt },
              { status: "DELIVERED", note: "Received into stock, allocated first-expiry-first-out", createdAt: new Date(placedAt.getTime() + 6 * 86_400_000) },
            ],
          },
        },
      })
      orderCount += 1
      deliveredCount += 1

      // Delivered quantities are the demand history the forecast learns from,
      // the same rows the delivery endpoint records when it receives stock.
      for (const line of lines) {
        await prisma.demandSample.upsert({
          where: {
            stockistId_productId_periodStart: {
              stockistId: grant.stockistId,
              productId: line.productId,
              periodStart,
            },
          },
          update: { quantity: { increment: line.quantity } },
          create: {
            stockistId: grant.stockistId,
            productId: line.productId,
            periodStart,
            quantity: line.quantity,
            source: "DELIVERED_ORDER",
          },
        })
      }

      // Attach the FEFO allocations to the created order lines.
      const createdItems = await prisma.orderItem.findMany({ where: { orderId: order.id } })
      for (const line of lines) {
        if (line.allocations.length === 0) continue
        const item = createdItems.find((candidate) => candidate.productId === line.productId)
        if (!item) continue
        await prisma.orderItemAllocation.createMany({
          data: line.allocations.map((allocation) => ({
            orderItemId: item.id,
            batchId: allocation.batchId,
            quantity: allocation.quantity,
          })),
        })
      }

      // Historical deliveries are the demand signal for forecasting, not shelf
      // stock: a real warehouse consumes what it receives. The batches those
      // deliveries came from are recorded in OrderItemAllocation, while current
      // on-hand stock is defined once, below, against today's demand.
    }
  }

  // Current on-hand stock: several batches per product with a spread of expiry
  // windows, so first-expiry-first-out ranking and the alert bands are visible.
  // Quantities are sized against the demand history seeded above, otherwise the
  // reorder radar and stock-out watch have nothing real to report.
  let inventoryBatchCount = 0
  let stockedIndex = 0
  for (const seeded of seededProducts) {
    // Only the products this stockist actually buys carry stock. Everything else
    // is a newly listed product with no history, which is a real state to show.
    if (!demandByProduct.has(seeded.id)) continue
    const index = stockedIndex
    stockedIndex += 1
    const stockist = stockistRecords[0]
    const sourceLine = await prisma.orderItem.findFirst({
      where: {
        productId: seeded.id,
        order: { buyerId: stockist.id, status: "DELIVERED" },
      },
      select: { orderId: true },
      orderBy: { order: { createdAt: "desc" } },
    })
    const monthlyDemand = Math.max(12, Math.round((demandByProduct.get(seeded.id) ?? 0) / 12))
    // Every seventh product is deliberately thin, to trigger low-stock alerts and
    // stock-out watch entries.
    const thin = index % 7 === 6
    const scale = thin ? 0.08 : 1
    // Long-dated stock for everyone, then near-expiry batches on a subset so the
    // expiry manager has a realistic mix rather than a wall of red rows.
    const recipe: { quantity: number; expiryInDays: number }[] = [
      { quantity: Math.round(monthlyDemand * 1.4 * scale), expiryInDays: 300 },
      { quantity: Math.round(monthlyDemand * 0.9 * scale), expiryInDays: 520 },
    ]
    if (index % 2 === 0) {
      recipe.push({ quantity: Math.round(monthlyDemand * 0.35 * scale), expiryInDays: 26 })
      recipe.push({ quantity: Math.round(monthlyDemand * 0.5 * scale), expiryInDays: 48 })
    }
    if (index % 5 === 0) {
      recipe.push({ quantity: Math.round(monthlyDemand * 0.2 * scale), expiryInDays: 12 })
    }
    // One batch has already lapsed, so the write-off path is demonstrable.
    if (index === 3) {
      recipe.push({ quantity: Math.round(monthlyDemand * 0.3), expiryInDays: -6 })
    }

    for (const [recipeIndex, item] of recipe.entries()) {
      if (item.quantity <= 0) continue
      await prisma.inventoryBatch.create({
        data: {
          stockistId: stockist.id,
          productId: seeded.id,
          batchNumber: `ST${seeded.id.slice(-4).toUpperCase()}-${recipeIndex + 1}`,
          quantity: item.quantity,
          mfgDate: pastDate(item.expiryInDays > 200 ? 60 + recipeIndex * 30 : 300 - recipeIndex * 20),
          expiryDate: futureDate(item.expiryInDays),
          receivedAt: pastDate(recipeIndex * 24 + 10),
          sourceOrderId: sourceLine?.orderId,
        },
      })
      inventoryBatchCount += 1
    }
  }

  // A couple of live orders so the orders screens are not empty.
  for (const [index, status] of ["PLACED", "APPROVED", "DISPATCHED"].entries()) {
    const grant = grants[index]
    if (!grant) continue
    const manufacturerProducts = productsByManufacturer.get(grant.manufacturerId) ?? []
    const product = manufacturerProducts[index]
    if (!product) continue
    const quantity = product.index % 3 === 0 ? 60 : 20
    const price = Number((product.basePrice * 1.1).toFixed(2))
    const subtotal = price * quantity
    const gst = subtotal * 0.12
    const createdAt = pastDate(index * 2 + 1)
    await prisma.order.create({
      data: {
        buyerId: grant.stockistId,
        sellerId: grant.manufacturerId,
        status,
        subtotal,
        discount: 0,
        gst,
        total: subtotal + gst,
        poNumber: `PO-LIVE-${index + 1}`,
        invoiceNumber: status !== "PLACED" ? `INV-LIVE-${index + 1}` : null,
        invoiceCreatedAt: status !== "PLACED" ? createdAt : null,
        transporter: status === "DISPATCHED" ? "BlueDart Express" : status === "APPROVED" ? "Delhivery Surface" : null,
        trackingNumber: status === "DISPATCHED" ? `BD982341${index + 1}IN` : null,
        expectedDelivery: futureDate(index + 3),
        createdAt,
        items: { create: [{ productId: product.id, quantity, price }] },
        audits: {
          create: [
            { status: "PLACED", note: "Purchase order submitted by stockist", createdAt },
            ...(status !== "PLACED" ? [{ status, note: `Manufacturer marked order ${status.toLowerCase()}`, createdAt: new Date(createdAt.getTime() + 86_400_000) }] : []),
          ],
        },
      },
    })
    orderCount += 1
  }

  // Reorder drafts so the catalogue and "add to cart" flow have something to load.
  const firstGrant = grants[0]
  if (firstGrant) {
    const manufacturerProducts = productsByManufacturer.get(firstGrant.manufacturerId) ?? []
    const draftProducts = manufacturerProducts.slice(0, 2)
    if (draftProducts.length > 0) {
      await prisma.cartDraft.create({
        data: {
          stockistId: firstGrant.stockistId,
          manufacturerId: firstGrant.manufacturerId,
          notes: "Monthly replenishment",
          items: {
            create: draftProducts.map((product, index) => ({
              productId: product.id,
              quantity: (index + 1) * 30,
            })),
          },
        },
      })
    }
  }

  // Persisted examples for every Phase 4/5 screen. These are deliberately
  // created through the same relational shapes the APIs read, so a fresh seed
  // demonstrates real returns, H1 compliance, payment review, notifications,
  // audit history, and scheduled-job history without a manual warm-up step.
  const demoStockist = stockistRecords[0]
  const demoManufacturer = manufacturerRecords[0]
  const deliveredOrder = await prisma.order.findFirst({
    where: { buyerId: demoStockist.id, status: "DELIVERED" },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  })
  const returnBatch = await prisma.inventoryBatch.findFirst({
    where: {
      stockistId: demoStockist.id,
      quantity: { gt: 5 },
      sourceOrderId: { not: null },
      expiryDate: { gt: new Date(), lte: futureDate(90) },
    },
    include: { product: true },
    orderBy: { expiryDate: "asc" },
  })
  if (returnBatch) {
    await prisma.returnRequest.create({
      data: {
        orderId: returnBatch.sourceOrderId,
        buyerId: demoStockist.id,
        sellerId: returnBatch.product.manufacturerId,
        reason: "EXPIRING",
        status: "REQUESTED",
        remark: "Batch is within the agreed near-expiry return window.",
        total: rupees(returnBatch.product.ptr * 5),
        items: { create: [{ inventoryBatchId: returnBatch.id, productId: returnBatch.productId, quantity: 5 }] },
      },
    })
  }

  const h1Item = await prisma.orderItem.findFirst({
    where: { order: { buyerId: demoStockist.id }, product: { isScheduleH1: true } },
    include: { order: true, product: true },
    orderBy: { order: { createdAt: "desc" } },
  })
  if (h1Item) {
    await prisma.h1RegisterEntry.create({
      data: {
        orderId: h1Item.orderId,
        orderItemId: h1Item.id,
        productId: h1Item.productId,
        buyerId: demoStockist.id,
        buyerName: demoStockist.name,
        patientName: "Aarav Sharma",
        prescriberName: "Dr. Meera Kulkarni",
        prescriberRegistrationNumber: "MMC-2014-08231",
        quantity: h1Item.quantity,
        createdAt: h1Item.order.createdAt,
      },
    })
  }

  const complianceProduct = await prisma.product.findFirst({ where: { manufacturerId: demoManufacturer.id }, orderBy: { name: "asc" } })
  if (complianceProduct) {
    const ceiling = await prisma.nppaCeilingPrice.create({
      data: {
        drugName: complianceProduct.genericName,
        composition: complianceProduct.composition,
        packSize: complianceProduct.packSize,
        ceilingPrice: rupees(complianceProduct.mrp - 5),
        effectiveDate: pastDate(45),
      },
    })
    await prisma.productPriceViolation.create({
      data: {
        productId: complianceProduct.id,
        manufacturerId: demoManufacturer.id,
        referenceId: ceiling.id,
        submittedMrp: complianceProduct.mrp,
        ceilingPrice: ceiling.ceilingPrice,
      },
    })
  }

  if (deliveredOrder) {
    const pendingAmount = rupees(Math.min(deliveredOrder.total, deliveredOrder.total * 0.4))
    await prisma.paymentSubmission.create({
      data: {
        orderId: deliveredOrder.id,
        stockistId: deliveredOrder.buyerId,
        manufacturerId: deliveredOrder.sellerId,
        amount: pendingAmount,
        reference: "UTR-SEED-PENDING-001",
        status: "SUBMITTED",
      },
    })
    await prisma.order.update({
      where: { id: deliveredOrder.id },
      data: { paymentStatus: "SUBMITTED", paidAmount: 0, paymentRef: "UTR-SEED-PENDING-001" },
    })
  }

  await prisma.notification.createMany({
    data: [
      { organizationId: demoStockist.id, type: "LOW_STOCK", title: "Low stock needs attention", message: "A fast-moving batch has fallen below its reorder point.", severity: "WARNING", link: "/stockist/insights", dedupeKey: "seed-low-stock" },
      { organizationId: demoStockist.id, type: "EXPIRY", title: "Batch expires soon", message: "A near-expiry batch is ready for return review.", severity: "CRITICAL", link: "/stockist/expiry", dedupeKey: "seed-expiry" },
      { organizationId: demoManufacturer.id, type: "ACCESS_REQUEST", title: "New stockist access request", message: "A verified stockist is waiting for a catalogue decision.", link: "/manufacturer/access-requests", dedupeKey: "seed-access" },
    ],
  })
  await prisma.jobRun.create({
    data: { job: "inventory-alerts", status: "SUCCESS", trigger: "SEED", notificationsCreated: 3, summary: "Seeded low-stock, expiry, and access examples", finishedAt: new Date() },
  })
  await prisma.auditLog.createMany({
    data: [
      { actorId: adminUser.id, organizationId: demoManufacturer.id, action: "ORGANIZATION_VERIFIED", entityType: "Organization", entityId: demoManufacturer.id, detail: "Seeded approval history" },
      { actorId: adminUser.id, organizationId: demoStockist.id, action: "COMPLIANCE_REVIEWED", entityType: "Organization", entityId: demoStockist.id, detail: "Seeded compliance review" },
    ],
  })

  console.log(`Created ${productCount} products, ${schemeCount} schemes, ${manufacturerRecords.length} manufacturers, and ${stockistRecords.length} stockists.`)
  console.log(`Created ${orderCount} orders (${deliveredCount} delivered) and ${inventoryBatchCount} current inventory batches.`)
  console.log(`Demo credentials: admin@pharmalink.com, mfr@apex.com, stockist@city.com / ${DEMO_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
