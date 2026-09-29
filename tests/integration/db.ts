/**
 * Direct database reads for assertions the HTTP API does not expose.
 *
 * Allocations are the point of the FEFO check and the order route does not
 * return them, so the tests read what was actually persisted. Going through
 * Prisma rather than shelling out to the sqlite3 binary keeps the suite
 * runnable on any machine with the project's dependencies installed.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export async function allocationsFor(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { id: true },
  })
  const itemIds = items.map((item) => item.id)
  if (itemIds.length === 0) return []

  return prisma.orderItemAllocation.findMany({
    where: { orderItemId: { in: itemIds } },
    include: { batch: { select: { id: true, expiryDate: true, batchNumber: true } } },
    orderBy: { batch: { expiryDate: "asc" } },
  })
}

/** The manufacturer's saleable stock for a product, keyed by batch id. */
export async function manufacturerPool(productId: string) {
  const batches = await prisma.batch.findMany({
    where: { productId },
    select: { id: true, quantity: true, expiryDate: true, batchNumber: true },
  })
  return new Map(batches.map((batch) => [batch.id, batch]))
}

/**
 * Registers a stockist in a fresh organization so that cross-tenant access can
 * be tested. Uses the public registration route rather than writing to the
 * database, so the rival account is created the same way a real one would be.
 */
export async function registerRivalStockist(base: string) {
  const email = `rival+${Date.now().toString(36)}@integration.test`
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password@123",
      organizationName: `Rival Pharmacy ${Date.now().toString(36)}`,
      type: "STOCKIST",
      drugLicense: `RIVAL-${Date.now().toString(36)}`,
      gstNumber: `GST-RIVAL-${Date.now().toString(36)}`,
    }),
  })
  if (!res.ok) {
    throw new Error(`Could not register the rival stockist: HTTP ${res.status}`)
  }
  return email
}

export async function disconnect() {
  await prisma.$disconnect()
}

/**
 * Verifies a stockist's access to a manufacturer directly.
 *
 * The catalogue only lists products from manufacturers a stockist holds a
 * VERIFIED grant for, so an organization registered a moment ago sees nothing
 * and cannot place an order. That is correct behaviour, but it means an
 * isolation test that compares a brand new organization against a seeded one
 * has no rows on the new side to watch. Walking the request-and-approve flow is
 * not what such a test is about, so the grant is written here instead.
 */
export async function grantAccess(email: string, manufacturerName: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { organizationId: true },
  })
  const manufacturer = await prisma.organization.findFirstOrThrow({
    where: { name: manufacturerName, type: "MANUFACTURER" },
    select: { id: true },
  })
  const stockistId = user.organizationId
  if (!stockistId) {
    throw new Error(`${email} belongs to no organization, so it cannot be granted access`)
  }
  await prisma.accessGrant.create({
    data: {
      stockistId,
      manufacturerId: manufacturer.id,
      status: "VERIFIED",
      decidedAt: new Date(),
    },
  })
}
