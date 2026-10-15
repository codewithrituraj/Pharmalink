"use client"
import { useState } from "react"
import { BellRing, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
export function PaymentReminderButton({ invoiceId }: { invoiceId: string }) { const [sending,setSending]=useState(false); const [sent,setSent]=useState(false); const {toast}=useToast(); async function send(){setSending(true);const response=await fetch(`/api/stockist/ledger/${invoiceId}/reminder`,{method:"POST"});const body=await response.json().catch(()=>({}));setSending(false);if(!response.ok){toast({variant:"destructive",title:body.error??"Could not send reminder"});return}setSent(true);toast({title:body.created?"Payment reminder sent":"A reminder was already sent today"})}return <Button type="button" variant="outline" className="min-h-11" onClick={send} disabled={sending||sent}>{sent?<Check className="size-4"/>:<BellRing className="size-4"/>}{sent?"Reminder sent":sending?"Sending…":"Send payment reminder"}</Button> }
