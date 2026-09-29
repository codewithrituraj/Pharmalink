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
})

export const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: existingPassword,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type SignInInput = z.infer<typeof signInSchema>
