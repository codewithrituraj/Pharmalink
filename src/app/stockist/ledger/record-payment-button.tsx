"use client"

import { useState } from "react"
import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function RecordPaymentButton({ invoiceId, onRecorded }: { invoiceId: string; onRecorded: () => void }) {
  const [open, setOpen] = useState(false)
  const [paymentRef, setPaymentRef] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/stockist/ledger/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRef }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Payment could not be recorded")
      setOpen(false)
      setPaymentRef("")
      onRecorded()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Payment could not be recorded")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Record payment</Button>
      {open ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
          <form role="dialog" aria-modal="true" aria-labelledby="record-payment-title" onSubmit={submit} className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Settlement record</p>
                <h2 id="record-payment-title" className="mt-1 text-xl font-semibold">Record payment</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label="Close payment form"><X className="size-5" /></button>
            </div>
            <label className="mt-5 block text-sm font-medium">
              Payment reference
              <Input className="mt-1 h-11" value={paymentRef} onChange={(event) => setPaymentRef(event.target.value)} maxLength={100} required placeholder="UPI, bank, or transaction reference" />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">This submits the outstanding amount for manufacturer confirmation. It does not initiate or independently verify a bank transfer.</p>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !paymentRef.trim()}>
                <Check className="mr-2 size-4" /> {saving ? "Submitting..." : "Submit payment"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  )
}
