"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function CatalogueActions() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    
    // Read the CSV
    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      // Basic CSV parsing
      const lines = text.split('\n').filter(line => line.trim())
      const products = lines.slice(1).map(line => {
        const values = line.split(',')
        return {
          name: values[0],
          genericName: values[1],
          mrp: parseFloat(values[2]),
          ptr: parseFloat(values[3]),
          pts: parseFloat(values[4]),
        }
      })

      // Send to API
      await fetch('/api/manufacturer/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      })
      
      setUploading(false)
      router.refresh()
    }
    
    reader.readAsText(file)
  }

  return (
    <div className="flex gap-2">
      <div className="relative">
        <Input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Button disabled={uploading}>
          {uploading ? "Uploading..." : "Upload CSV"}
        </Button>
      </div>
      <Button variant="outline">Download Template</Button>
    </div>
  )
}
