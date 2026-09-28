"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

type ReorderButtonProps = {
  manufacturerId: string
  productId: string
  quantity: number
  variant?: "default" | "outline" | "ghost"
  label?: string
  className?: string
}

/**
 * Persists a suggested reorder into the real server-side purchase-order draft,
 * so the recommendation survives a page reload and lands in the stockist
 * catalogue cart instead of a throwaway sessionStorage key.
 */
export function ReorderButton({
  manufacturerId,
  productId,
  quantity,
  variant = "default",
  label = "Add to PO",
  className,
}: ReorderButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(false)

  async function addToDraft() {
    setSaving(true)
    try {
      const response = await fetch("/api/stockist/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturerId, productId, quantity }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? "Could not add to your PO")

      setAdded(true)
      toast({
        title: "Added to your purchase order",
        description: `${result.productName} · ${result.quantity} units`,
      })
      router.refresh()
      setTimeout(() => setAdded(false), 2000)
    } catch (cause) {
      toast({
        title: cause instanceof Error ? cause.message : "Could not add to your PO",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      variant={variant}
      onClick={addToDraft}
      disabled={saving || added}
      className={className}
      aria-label={`${label} for this product`}
    >
      {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
      {added ? "In your PO" : saving ? "Adding…" : label}
    </Button>
  )
}
