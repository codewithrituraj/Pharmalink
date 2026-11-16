-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organizationId" TEXT,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "drugLicense" TEXT,
    "gstNumber" TEXT,
    "region" TEXT,
    "address" TEXT,
    "verificationRemark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccessGrant" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "customDiscount" DOUBLE PRECISION,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "composition" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'General',
    "dosageForm" TEXT NOT NULL DEFAULT 'Tablet',
    "strength" TEXT NOT NULL DEFAULT '',
    "packSize" TEXT NOT NULL DEFAULT '10 x 10',
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "isPrescription" BOOLEAN NOT NULL DEFAULT false,
    "isScheduleH1" BOOLEAN NOT NULL DEFAULT false,
    "requiresColdChain" BOOLEAN NOT NULL DEFAULT false,
    "storage" TEXT NOT NULL DEFAULT 'Store below 25 C',
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "mrp" DOUBLE PRECISION NOT NULL,
    "ptr" DOUBLE PRECISION NOT NULL,
    "pts" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availability" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "hsnCode" TEXT NOT NULL DEFAULT '3004',

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Scheme" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freeQuantity" INTEGER NOT NULL DEFAULT 0,
    "stockistId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Batch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mfgDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "qrCode" TEXT,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryBatch" (
    "id" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceOrderId" TEXT,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DemandSample" (
    "id" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ORDER',

    CONSTRAINT "DemandSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "transporter" TEXT,
    "trackingNumber" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "invoiceCreatedAt" TIMESTAMP(3),
    "poNumber" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderAudit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartDraft" (
    "id" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CartDraftItem" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "CartDraftItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "freeQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItemAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "OrderItemAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "notificationsSkipped" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "organizationId" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "remark" TEXT,
    "creditNote" TEXT,
    "creditNoteCreatedAt" TIMESTAMP(3),
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "inventoryBatchId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NppaCeilingPrice" (
    "id" TEXT NOT NULL,
    "drugName" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "ceilingPrice" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NppaCeilingPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductPriceViolation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "submittedMrp" DOUBLE PRECISION NOT NULL,
    "ceilingPrice" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductPriceViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."H1RegisterEntry" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "prescriberName" TEXT NOT NULL,
    "prescriberRegistrationNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "H1RegisterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TraceVerificationLog" (
    "id" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "batchId" TEXT,
    "submittedCode" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraceVerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "inventoryBatchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SwapOrder" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "SwapOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentSubmission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stockistId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "reviewNote" TEXT,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "public"."Notification"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_dedupeKey_key" ON "public"."Notification"("organizationId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_userId_productId_key" ON "public"."Favourite"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_qrCode_key" ON "public"."Batch"("qrCode");

-- CreateIndex
CREATE INDEX "InventoryBatch_stockistId_productId_idx" ON "public"."InventoryBatch"("stockistId", "productId");

-- CreateIndex
CREATE INDEX "InventoryBatch_stockistId_expiryDate_idx" ON "public"."InventoryBatch"("stockistId", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "DemandSample_stockistId_productId_periodStart_key" ON "public"."DemandSample"("stockistId", "productId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemAllocation_orderItemId_batchId_key" ON "public"."OrderItemAllocation"("orderItemId", "batchId");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "public"."JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "VerificationDocument_organizationId_idx" ON "public"."VerificationDocument"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "public"."AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_buyerId_createdAt_idx" ON "public"."ReturnRequest"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_sellerId_createdAt_idx" ON "public"."ReturnRequest"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "NppaCeilingPrice_composition_packSize_effectiveDate_idx" ON "public"."NppaCeilingPrice"("composition", "packSize", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "NppaCeilingPrice_composition_packSize_effectiveDate_key" ON "public"."NppaCeilingPrice"("composition", "packSize", "effectiveDate");

-- CreateIndex
CREATE INDEX "ProductPriceViolation_active_detectedAt_idx" ON "public"."ProductPriceViolation"("active", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPriceViolation_productId_referenceId_key" ON "public"."ProductPriceViolation"("productId", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "H1RegisterEntry_orderItemId_key" ON "public"."H1RegisterEntry"("orderItemId");

-- CreateIndex
CREATE INDEX "H1RegisterEntry_createdAt_productId_idx" ON "public"."H1RegisterEntry"("createdAt", "productId");

-- CreateIndex
CREATE INDEX "H1RegisterEntry_buyerId_createdAt_idx" ON "public"."H1RegisterEntry"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "TraceVerificationLog_orderId_createdAt_idx" ON "public"."TraceVerificationLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TraceVerificationLog_matched_createdAt_idx" ON "public"."TraceVerificationLog"("matched", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_expiresAt_idx" ON "public"."MarketplaceListing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_status_idx" ON "public"."MarketplaceListing"("sellerId", "status");

-- CreateIndex
CREATE INDEX "SwapOrder_buyerId_createdAt_idx" ON "public"."SwapOrder"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "SwapOrder_sellerId_createdAt_idx" ON "public"."SwapOrder"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_manufacturerId_status_submittedAt_idx" ON "public"."PaymentSubmission"("manufacturerId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_stockistId_submittedAt_idx" ON "public"."PaymentSubmission"("stockistId", "submittedAt");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessGrant" ADD CONSTRAINT "AccessGrant_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessGrant" ADD CONSTRAINT "AccessGrant_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favourite" ADD CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favourite" ADD CONSTRAINT "Favourite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Scheme" ADD CONSTRAINT "Scheme_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryBatch" ADD CONSTRAINT "InventoryBatch_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DemandSample" ADD CONSTRAINT "DemandSample_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DemandSample" ADD CONSTRAINT "DemandSample_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderAudit" ADD CONSTRAINT "OrderAudit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartDraft" ADD CONSTRAINT "CartDraft_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartDraft" ADD CONSTRAINT "CartDraft_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartDraftItem" ADD CONSTRAINT "CartDraftItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "public"."CartDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CartDraftItem" ADD CONSTRAINT "CartDraftItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItemAllocation" ADD CONSTRAINT "OrderItemAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobRun" ADD CONSTRAINT "JobRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VerificationDocument" ADD CONSTRAINT "VerificationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "public"."ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnItem" ADD CONSTRAINT "ReturnItem_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "public"."InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductPriceViolation" ADD CONSTRAINT "ProductPriceViolation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductPriceViolation" ADD CONSTRAINT "ProductPriceViolation_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductPriceViolation" ADD CONSTRAINT "ProductPriceViolation_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "public"."NppaCeilingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."H1RegisterEntry" ADD CONSTRAINT "H1RegisterEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."H1RegisterEntry" ADD CONSTRAINT "H1RegisterEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."H1RegisterEntry" ADD CONSTRAINT "H1RegisterEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."H1RegisterEntry" ADD CONSTRAINT "H1RegisterEntry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceVerificationLog" ADD CONSTRAINT "TraceVerificationLog_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceVerificationLog" ADD CONSTRAINT "TraceVerificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TraceVerificationLog" ADD CONSTRAINT "TraceVerificationLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "public"."InventoryBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SwapOrder" ADD CONSTRAINT "SwapOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketplaceListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SwapOrder" ADD CONSTRAINT "SwapOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SwapOrder" ADD CONSTRAINT "SwapOrder_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SwapOrder" ADD CONSTRAINT "SwapOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


