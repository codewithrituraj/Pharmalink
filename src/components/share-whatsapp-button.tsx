"use client"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
export function ShareWhatsAppButton({message,path,label="Share via WhatsApp"}:{message:string;path?:string;label?:string}){function share(){const link=path?`${window.location.origin}${path}`:window.location.href;window.open(`https://wa.me/?text=${encodeURIComponent(`${message}\n${link}`)}`,"_blank","noopener,noreferrer")}return <Button type="button" variant="outline" className="min-h-11" onClick={share}><MessageCircle className="size-4"/>{label}</Button>}
