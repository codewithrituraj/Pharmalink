import * as z from "zod"
import { getSupabaseUser, supabaseRequest } from "@/lib/supabase"

export const profileRegistrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  account_type: z.enum(["manufacturer", "stockist", "retailer"]),
  full_name: z.string().trim().min(2).max(160),
  business_name: z.string().trim().min(2).max(160),
  phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/, "Phone must be in E.164 format"),
  gst_no: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/),
  drug_license_no: z.string().trim().min(1).max(120),
  drug_license_no_secondary: z.string().trim().max(120).optional().nullable(),
  drug_license_type: z.string().trim().max(80).optional().nullable(),
  drug_license_expiry: z.string().date(),
  pan_no: z.string().trim().max(20).optional().nullable(),
  fssai_no: z.string().trim().max(40).optional().nullable(),
  address_line1: z.string().trim().max(240).optional().nullable(),
  address_line2: z.string().trim().max(240).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  pincode: z.string().regex(/^[0-9]{6}$/).optional().nullable(),
  country: z.string().trim().max(80).default("India"),
  manufacturer: z.object({
    manufacturing_license_no: z.string().trim().min(1).max(120),
    who_gmp_certified: z.boolean().default(false),
    plant_address: z.string().trim().max(500).optional().nullable(),
    product_categories: z.array(z.string().trim().min(1).max(80)).default([]),
    annual_capacity: z.string().trim().max(120).optional().nullable(),
  }).optional(),
  stockist: z.object({
    warehouse_address: z.string().trim().max(500).optional().nullable(),
    storage_capacity: z.string().trim().max(120).optional().nullable(),
    cold_chain_available: z.boolean().default(false),
    serviceable_pincodes: z.array(z.string().regex(/^[0-9]{6}$/)).default([]),
    authorized_manufacturers: z.array(z.string().uuid()).default([]),
  }).optional(),
  retailer: z.object({
    store_name: z.string().trim().min(2).max(160),
    pharmacist_name: z.string().trim().min(2).max(160),
    pharmacist_registration_no: z.string().trim().min(1).max(120),
    store_type: z.enum(["pharmacy", "hospital", "clinic"]),
    preferred_stockist_ids: z.array(z.string().uuid()).default([]),
  }).optional(),
})

export const profileUpdateSchema = profileRegistrationSchema.partial().omit({ email: true, password: true, account_type: true, gst_no: true, drug_license_no: true })

export async function currentUser(request: Request) {
  return getSupabaseUser(request)
}

export async function readProfile(userId: string, accessToken?: string) {
  const query = "select=*,business_details(*),manufacturer_details(*),stockist_details(*),retailer_details(*)"
  const { response, body } = await supabaseRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&${query}`, { accessToken }, "public")
  if (!response.ok) throw new Error(body?.message ?? "Could not read profile")
  return Array.isArray(body) ? body[0] ?? null : null
}

export function isAdminEmail(email?: string) {
  if (!email) return false
  return (process.env.SUPABASE_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())
}

export function duplicateMessage(body: unknown) {
  const message = typeof body === "object" && body !== null && "message" in body ? String(body.message) : ""
  if (message.includes("business_details_gst_no_key")) return "GST number already registered"
  if (message.includes("business_details_drug_license_no_key")) return "Drug licence number already registered"
  if (message.toLowerCase().includes("already registered") || message.includes("profiles_email_key")) return "Email already registered"
  return null
}
