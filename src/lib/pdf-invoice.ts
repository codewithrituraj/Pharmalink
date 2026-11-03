import PDFDocument from "pdfkit"

export type PdfOrderData = {
  id: string
  poNumber: string | null
  invoiceNumber: string | null
  createdAt: Date | string
  invoiceCreatedAt?: Date | string | null
  status: string
  isPaid?: boolean
  transporter?: string | null
  trackingNumber?: string | null
  expectedDelivery?: Date | string | null
  subtotal: number
  discount: number
  gst: number
  total: number
  notes?: string | null
  seller: {
    name: string
    address?: string | null
    drugLicense?: string | null
    gstNumber?: string | null
    region?: string | null
  }
  buyer: {
    name: string
    address?: string | null
    drugLicense?: string | null
    gstNumber?: string | null
    region?: string | null
  }
  items: {
    quantity: number
    freeQuantity?: number
    price: number
    product: {
      name: string
      genericName: string
      packSize: string
      gstPercent: number
      hsnCode?: string
      mrp?: number
    }
    allocations?: {
      quantity: number
      batch: {
        batchNumber: string
        expiryDate: Date | string
      }
    }[]
  }[]
}

function formatDate(date?: Date | string | null): string {
  if (!date) return "N/A"
  const d = new Date(date)
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(amount: number): string {
  return "INR " + amount.toFixed(2)
}

export function generateInvoiceOrPoPdf(data: PdfOrderData, isInvoice: boolean): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 })
      const chunks: Buffer[] = []

      doc.on("data", (chunk: Buffer) => chunks.push(chunk))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", (err) => reject(err))

      const primaryColor = "#0f766e" // Teal 700
      const darkColor = "#1e293b" // Slate 800
      const mutedColor = "#64748b" // Slate 500
      const borderColor = "#cbd5e1" // Slate 300
      const lightBg = "#f8fafc" // Slate 50

      // Header Banner
      doc.rect(40, 40, 515, 60).fill(lightBg)
      doc.rect(40, 40, 515, 60).stroke(borderColor)

      doc.fillColor(primaryColor).fontSize(18).font("Helvetica-Bold").text("PharmaLink", 55, 52)
      doc.fontSize(8).font("Helvetica").fillColor(mutedColor).text("B2B Pharmaceutical Procurement & Supply Network", 55, 74)

      const docTitle = isInvoice ? "GST TAX INVOICE" : "PURCHASE ORDER"
      doc.fillColor(darkColor).fontSize(14).font("Helvetica-Bold").text(docTitle, 350, 52, { align: "right", width: 190 })
      doc.fontSize(9).font("Helvetica").fillColor(mutedColor).text(`Status: ${data.status}`, 350, 70, { align: "right", width: 190 })
      if (isInvoice && data.isPaid) {
        doc.fillColor("#15803d").fontSize(9).font("Helvetica-Bold").text("[ PAID ]", 350, 84, { align: "right", width: 190 })
      } else if (isInvoice) {
        doc.fillColor("#b91c1c").fontSize(9).font("Helvetica-Bold").text("[ OUTSTANDING ]", 350, 84, { align: "right", width: 190 })
      }

      // Meta Box (Seller vs Buyer)
      const topY = 110
      doc.rect(40, topY, 250, 110).stroke(borderColor)
      doc.rect(295, topY, 260, 110).stroke(borderColor)

      // Seller Info
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(isInvoice ? "SUPPLIER (Manufacturer):" : "VENDOR (Manufacturer):", 48, topY + 8)
      doc.fillColor(darkColor).fontSize(10).font("Helvetica-Bold").text(data.seller.name, 48, topY + 22)
      doc.fontSize(8).font("Helvetica").fillColor(darkColor)
      doc.text(`Address: ${data.seller.address || "Industrial Area, Registered Hub"}`, 48, topY + 36, { width: 235 })
      doc.text(`GSTIN: ${data.seller.gstNumber || "Not Registered"}`, 48, topY + 68)
      doc.text(`Drug License No: ${data.seller.drugLicense || "N/A"}`, 48, topY + 82)
      doc.text(`State / Region: ${data.seller.region || "Domestic"}`, 48, topY + 96)

      // Buyer Info & Document Meta
      doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold").text(isInvoice ? "BILLED TO (Stockist):" : "BUYER (Stockist):", 305, topY + 8)
      doc.fillColor(darkColor).fontSize(10).font("Helvetica-Bold").text(data.buyer.name, 305, topY + 22)
      doc.fontSize(8).font("Helvetica").fillColor(darkColor)
      doc.text(`Address: ${data.buyer.address || "Wholesale Market, Distribution Centre"}`, 305, topY + 36, { width: 240 })
      doc.text(`GSTIN: ${data.buyer.gstNumber || "Not Registered"}`, 305, topY + 68)
      doc.text(`Drug License No: ${data.buyer.drugLicense || "N/A"}`, 305, topY + 82)

      // Order Reference strip
      const stripY = 228
      doc.rect(40, stripY, 515, 38).fill(lightBg).stroke(borderColor)
      doc.fillColor(darkColor).fontSize(8).font("Helvetica-Bold")
      doc.text(`PO No: ${data.poNumber || `PO-${data.id.slice(-8).toUpperCase()}`}`, 50, stripY + 6)
      doc.font("Helvetica").text(`PO Date: ${formatDate(data.createdAt)}`, 50, stripY + 20)

      if (isInvoice) {
        doc.font("Helvetica-Bold").text(`Invoice No: ${data.invoiceNumber || `INV-${data.id.slice(-8).toUpperCase()}`}`, 180, stripY + 6)
        doc.font("Helvetica").text(`Invoice Date: ${formatDate(data.invoiceCreatedAt || data.createdAt)}`, 180, stripY + 20)
      } else {
        doc.font("Helvetica-Bold").text(`Order Ref: ${data.id.slice(-8).toUpperCase()}`, 180, stripY + 6)
        doc.font("Helvetica").text(`Payment Terms: Credit / Ledger`, 180, stripY + 20)
      }

      doc.font("Helvetica-Bold").text(`Carrier: ${data.transporter || "Standard Cargo"}`, 360, stripY + 6)
      doc.font("Helvetica").text(`Tracking: ${data.trackingNumber || "Pending"} | ETA: ${formatDate(data.expectedDelivery)}`, 360, stripY + 20)

      // Table Header
      let currentY = 275
      const tableHeight = 22
      doc.rect(40, currentY, 515, tableHeight).fill(primaryColor)
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold")
      doc.text("#", 45, currentY + 7, { width: 15 })
      doc.text("Description of Goods", 65, currentY + 7, { width: 140 })
      doc.text("HSN", 210, currentY + 7, { width: 35 })
      doc.text("Batch & Exp", 250, currentY + 7, { width: 75 })
      doc.text("Qty", 330, currentY + 7, { width: 30, align: "right" })
      doc.text("Free", 365, currentY + 7, { width: 25, align: "right" })
      doc.text("Rate", 395, currentY + 7, { width: 40, align: "right" })
      doc.text("GST%", 440, currentY + 7, { width: 30, align: "right" })
      doc.text("Total", 475, currentY + 7, { width: 70, align: "right" })

      currentY += tableHeight

      // Table Rows
      doc.font("Helvetica").fontSize(8)
      data.items.forEach((item, idx) => {
        const rowHeight = 26
        if (currentY + rowHeight > 700) {
          doc.addPage()
          currentY = 40
        }

        const isEven = idx % 2 === 0
        if (isEven) {
          doc.rect(40, currentY, 515, rowHeight).fill("#fafafa").stroke(borderColor)
        } else {
          doc.rect(40, currentY, 515, rowHeight).stroke(borderColor)
        }

        doc.fillColor(darkColor)
        doc.text(String(idx + 1), 45, currentY + 5, { width: 15 })
        doc.font("Helvetica-Bold").text(item.product.name, 65, currentY + 5, { width: 140, ellipsis: true })
        doc.font("Helvetica").fontSize(7).fillColor(mutedColor).text(`${item.product.genericName} (${item.product.packSize})`, 65, currentY + 14, { width: 140, ellipsis: true })

        doc.fontSize(8).fillColor(darkColor)
        doc.text(item.product.hsnCode || "N/A", 210, currentY + 8, { width: 35 })

        // Batch & Expiry
        const batchInfo = item.allocations && item.allocations.length > 0
          ? `${item.allocations[0].batch.batchNumber} (${formatDate(item.allocations[0].batch.expiryDate).slice(-7)})`
          : "FEFO Allocated"
        doc.fontSize(7).text(batchInfo, 250, currentY + 8, { width: 75, ellipsis: true })

        doc.fontSize(8)
        doc.text(String(item.quantity), 330, currentY + 8, { width: 30, align: "right" })
        doc.text(String(item.freeQuantity || 0), 365, currentY + 8, { width: 25, align: "right" })
        doc.text(item.price.toFixed(2), 395, currentY + 8, { width: 40, align: "right" })
        doc.text(`${item.product.gstPercent || 12}%`, 440, currentY + 8, { width: 30, align: "right" })
        doc.font("Helvetica-Bold").text((item.price * item.quantity).toFixed(2), 475, currentY + 8, { width: 70, align: "right" })

        currentY += rowHeight
      })

      // Summary Box
      currentY += 15
      if (currentY + 120 > 750) {
        doc.addPage()
        currentY = 40
      }

      const summaryY = currentY
      const summaryWidth = 220
      const summaryX = 555 - summaryWidth

      // Notes / Declaration on Left
      doc.rect(40, summaryY, 280, 100).stroke(borderColor)
      doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold").text("Terms & Statutory Declaration:", 50, summaryY + 8)
      doc.fillColor(mutedColor).fontSize(7).font("Helvetica")
      doc.text("1. All medicines sold under this invoice are warranted compliant with the Drugs & Cosmetics Act 1940.", 50, summaryY + 22, { width: 260 })
      doc.text("2. Certified that particulars given above are true and correct, and amount indicated represents the price actually charged.", 50, summaryY + 42, { width: 260 })
      doc.text("3. Subject to jurisdiction of supplier's registered office.", 50, summaryY + 64, { width: 260 })
      if (data.notes) {
        doc.fillColor(darkColor).text(`Order Notes: ${data.notes}`, 50, summaryY + 78, { width: 260, ellipsis: true })
      }

      // Calculations Box on Right
      doc.rect(summaryX, summaryY, summaryWidth, 100).stroke(borderColor)
      let calcRowY = summaryY + 8

      function addCalcRow(label: string, value: string, bold = false) {
        doc.fillColor(darkColor).fontSize(8).font(bold ? "Helvetica-Bold" : "Helvetica")
        doc.text(label, summaryX + 10, calcRowY)
        doc.text(value, summaryX + 10, calcRowY, { align: "right", width: summaryWidth - 20 })
        calcRowY += 15
      }

      addCalcRow("Gross Subtotal:", formatCurrency(data.subtotal))
      addCalcRow("Trade Scheme Discount:", `- ${formatCurrency(data.discount)}`)
      const taxable = Math.max(0, data.subtotal - data.discount)
      addCalcRow("Taxable Value:", formatCurrency(taxable))

      const isSameState = (data.seller.region && data.buyer.region && data.seller.region === data.buyer.region) || false
      if (isSameState) {
        addCalcRow("CGST (6%):", formatCurrency(data.gst / 2))
        addCalcRow("SGST (6%):", formatCurrency(data.gst / 2))
      } else {
        addCalcRow("IGST (12%):", formatCurrency(data.gst))
      }

      doc.rect(summaryX, calcRowY - 2, summaryWidth, 22).fill(primaryColor)
      doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold")
      doc.text("Grand Total:", summaryX + 10, calcRowY + 4)
      doc.text(formatCurrency(data.total), summaryX + 10, calcRowY + 4, { align: "right", width: summaryWidth - 20 })

      // Footer sign off
      currentY = summaryY + 115
      doc.fillColor(mutedColor).fontSize(7).font("Helvetica").text("This is a system-generated electronic document issued by PharmaLink. No physical signature required.", 40, currentY, { align: "center", width: 515 })

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
