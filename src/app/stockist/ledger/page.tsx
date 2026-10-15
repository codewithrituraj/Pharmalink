"use client"

import { useEffect, useState } from "react"
import { CreditCard, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchJson } from "@/lib/client-fetch"
import { RecordPaymentButton } from "./record-payment-button"
import { PaymentReminderButton } from "@/components/stockist/payment-reminder-button"
import { ShareWhatsAppButton } from "@/components/share-whatsapp-button"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

type Ledger = {
  asOf: string
  totalOutstanding: number
  invoiceCount: number
  aging: {
    days0To30: number
    days31To60: number
    days61To90: number
    over90Days: number
  }
  invoices: {
    id: string
    poNumber: string | null
    invoiceNumber: string
    invoiceDate: string
    daysOutstanding: number
    manufacturer: string
    total: number
  }[]
}

const currency = (amount: number) => `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function StockistLedgerPage() {
  const [ledger, setLedger] = useState<Ledger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  function refreshLedger() {
    fetchJson<Ledger>("/api/stockist/ledger")
      .then(setLedger)
      .catch(() => setError("The outstanding ledger could not be refreshed."))
  }

  useEffect(() => {
    let active = true

    fetchJson<Ledger>("/api/stockist/ledger")
      .then((data) => {
        if (!active) return
        setLedger(data)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError("The outstanding ledger could not be loaded.")
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Invoices & billing</p>
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="mt-2 text-3xl font-semibold tracking-tight">Dues & payments</h2><Link href="/api/stockist/accounting-export" className={buttonVariants({variant:"outline"})}>Export for accounting</Link></div>
        <p className="mt-2 text-muted-foreground">Unpaid issued invoices for your organization, grouped by invoice age.</p>
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      ) : error ? (
        <Card className="surface-card border-0"><CardContent className="py-12 text-center text-sm text-destructive">{error}</CardContent></Card>
      ) : ledger ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <LedgerMetric label="Outstanding" amount={ledger.totalOutstanding} prominent />
            <LedgerMetric label="0–30 days" amount={ledger.aging.days0To30} />
            <LedgerMetric label="31–60 days" amount={ledger.aging.days31To60} />
            <LedgerMetric label="61–90 days" amount={ledger.aging.days61To90} />
            <LedgerMetric label="Over 90 days" amount={ledger.aging.over90Days} />
          </div>

          <Card className="surface-card border-0">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Unpaid invoices</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ledger.invoiceCount} invoice{ledger.invoiceCount === 1 ? "" : "s"} · Updated {new Date(ledger.asOf).toLocaleString("en-IN")}
                </p>
              </div>
              <CreditCard className="size-5 text-primary" />
            </CardHeader>
            <CardContent>
              {ledger.invoices.length ? (
                <div className="divide-y divide-border">
                  {ledger.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold">{invoice.invoiceNumber}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {invoice.poNumber ?? "PO pending"} · {invoice.manufacturer} · {new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{invoice.daysOutstanding} days outstanding</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                        <p className="number font-semibold">{currency(invoice.total)}</p>
                        <RecordPaymentButton invoiceId={invoice.id} onRecorded={refreshLedger} />
                        <PaymentReminderButton invoiceId={invoice.id} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/api/stockist/invoices/${invoice.id}/pdf`, "_blank", "noopener,noreferrer")}
                        >
                          <FileText className="mr-2 size-4" /> PDF
                        </Button>
                        <ShareWhatsAppButton label="WhatsApp" message={`Tax invoice ${invoice.invoiceNumber} from ${invoice.manufacturer} · ${currency(invoice.total)}`} path={`/api/stockist/invoices/${invoice.id}/pdf`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <CreditCard className="mx-auto size-9 text-primary" />
                  <p className="mt-3 font-semibold">No outstanding invoices</p>
                  <p className="mt-1 text-sm text-muted-foreground">Issued invoices marked paid will no longer appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function LedgerMetric({ label, amount, prominent = false }: { label: string; amount: number; prominent?: boolean }) {
  return (
    <Card className={`surface-card border-0 ${prominent ? "bg-primary text-primary-foreground" : ""}`}>
      <CardContent className="p-4">
        <p className={`text-xs font-semibold uppercase tracking-wide ${prominent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
        <p className={`number mt-2 font-semibold ${prominent ? "text-2xl" : "text-lg"}`}>{currency(amount)}</p>
      </CardContent>
    </Card>
  )
}
