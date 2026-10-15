/**
 * The shapes the sign-up and sign-in forms share with the API routes.
 *
 * The rules live here rather than in each form and route so that the browser
 * and the server cannot drift apart. A client-side check is a convenience for
 * the person filling the form; the copy in the route handler is the one that
 * decides, and a client-only rule is no rule at all.
 */
import * as z from "zod"

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/**
 * A password someone is choosing now, so it is held to a length worth having.
 * The upper bound is not about strength, it stops an arbitrarily long string
 * from turning a sign-in attempt into arbitrarily much work.
 */
export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)

/**
 * Sign in deliberately sets no minimum. Accounts exist that were created under
 * older rules, and a stricter check here would lock their owners out rather
 * than protect them. The length cap is still applied.
 */
export const existingPassword = z
  .string()
  .min(1, "Enter your password")
  .max(PASSWORD_MAX_LENGTH, "Password is too long")

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: newPassword,
  organizationName: z.string().min(2, "Company name is required"),
  type: z.enum(["MANUFACTURER", "STOCKIST"]),
  drugLicense: z.string().min(1, "Drug License is required"),
  gstNumber: z.string().min(1, "GST Number is required"),
  // Existing Phase 1 registrations did not collect an address. New registrations
  // can provide it for verification without invalidating that established payload.
  address: z.string().trim().max(500).optional(),
})

export const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  genericName: z.string().trim().min(2).max(160),
  composition: z.string().trim().min(2).max(240).optional(),
  category: z.string().trim().min(2).max(80),
  dosageForm: z.string().trim().min(2).max(80).optional(),
  strength: z.string().trim().max(80).optional(),
  packSize: z.string().trim().min(1).max(80),
  mrp: z.number().nonnegative(), ptr: z.number().nonnegative(), pts: z.number().nonnegative(),
  gstPercent: z.number().min(0).max(28), minOrderQty: z.number().int().positive(),
  availability: z.number().int().nonnegative(), imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
  isScheduleH1: z.boolean().optional(),
  requiresColdChain: z.boolean().optional(),
})

export const schemeSchema = z.object({
  productId: z.string().min(1), name: z.string().trim().min(2).max(120),
  type: z.enum(["SLAB_DISCOUNT", "FREE_GOODS"]), minQuantity: z.number().int().positive(),
  discountPercent: z.number().min(0).max(100).default(0), freeQuantity: z.number().int().nonnegative().default(0),
  stockistId: z.string().optional().nullable(), validFrom: z.string().datetime(), validUntil: z.string().datetime(),
}).refine((value) => new Date(value.validUntil) > new Date(value.validFrom), { message: "End date must be after start date", path: ["validUntil"] })

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: existingPassword,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type SignInInput = z.infer<typeof signInSchema>
