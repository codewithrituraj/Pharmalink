import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  existingPassword,
  newPassword,
  registerSchema,
  signInSchema,
} from "../src/lib/validation"

const validRegistration = {
  email: "buyer@pharmacy.test",
  password: "a-long-enough-password",
  organizationName: "Test Pharmacy",
  type: "STOCKIST" as const,
  drugLicense: "DL-TEST",
  gstNumber: "GST-TEST",
}

describe("password policy", () => {
  it("sets a minimum worth having on a new password", () => {
    assert.ok(PASSWORD_MIN_LENGTH >= 8, `minimum is only ${PASSWORD_MIN_LENGTH}`)
  })

  it("keeps the documented demo password acceptable", () => {
    // The README tells people to use password@123, so a policy that rejects it
    // would contradict the documentation.
    assert.ok(
      newPassword.safeParse("password@123").success,
      "the documented demo password must still pass the policy",
    )
  })

  it("rejects a new password under the minimum", () => {
    const result = newPassword.safeParse("a".repeat(PASSWORD_MIN_LENGTH - 1))
    assert.equal(result.success, false)
    assert.match(result.error?.issues[0].message ?? "", new RegExp(`at least ${PASSWORD_MIN_LENGTH}`))
  })

  it("accepts a password at exactly the minimum", () => {
    assert.equal(newPassword.safeParse("a".repeat(PASSWORD_MIN_LENGTH)).success, true)
  })

  it("caps a new password so one input cannot cost unbounded work", () => {
    assert.equal(newPassword.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success, false)
    assert.equal(newPassword.safeParse("a".repeat(PASSWORD_MAX_LENGTH)).success, true)
  })

  it("does not require a minimum at sign in, so older accounts are not locked out", () => {
    // An account created under the previous six character rule must still be
    // able to sign in; a stricter check here would lock its owner out.
    assert.equal(existingPassword.safeParse("short").success, true)
    assert.equal(existingPassword.safeParse("").success, false)
  })

  it("still caps length at sign in", () => {
    assert.equal(existingPassword.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success, false)
  })

  it("does not demand a mix of character classes", () => {
    // Composition rules push people towards predictable substitutions. Length
    // is what the policy asks for.
    assert.equal(newPassword.safeParse("aaaaaaaaaaaa").success, true)
  })
})

describe("sign-up form", () => {
  it("accepts a complete registration", () => {
    assert.equal(registerSchema.safeParse(validRegistration).success, true)
  })

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: "not-an-email" })
    assert.equal(result.success, false)
  })

  it("rejects an organization type outside the two allowed values", () => {
    for (const type of ["ADMIN", "SUPPLIER", "stockist", ""]) {
      assert.equal(registerSchema.safeParse({ ...validRegistration, type }).success, false, type)
    }
  })

  it("requires the regulatory fields", () => {
    assert.equal(registerSchema.safeParse({ ...validRegistration, drugLicense: "" }).success, false)
    assert.equal(registerSchema.safeParse({ ...validRegistration, gstNumber: "" }).success, false)
  })
})

describe("sign-in form", () => {
  it("accepts an email and a short password from an older account", () => {
    assert.equal(
      signInSchema.safeParse({ email: "legacy@pharmacy.test", password: "old" }).success,
      true,
    )
  })

  it("rejects a malformed email", () => {
    assert.equal(signInSchema.safeParse({ email: "", password: "whatever" }).success, false)
  })
})
