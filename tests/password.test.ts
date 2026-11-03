import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  hashPassword,
  isLegacyPlainText,
  needsRehash,
  verifyPassword,
} from "../src/lib/password"

describe("hashPassword", () => {
  it("never stores the plain text", async () => {
    const stored = await hashPassword("password123")
    assert.ok(!stored.includes("password123"), `hash leaked the password: ${stored}`)
    assert.match(stored, /^scrypt\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/)
  })

  it("gives the same password a different hash each time", async () => {
    const [a, b] = await Promise.all([hashPassword("password123"), hashPassword("password123")])
    assert.notEqual(a, b, "identical passwords must not produce identical hashes")
  })
})

describe("verifyPassword", () => {
  it("accepts the right password", async () => {
    const stored = await hashPassword("correct horse battery staple")
    assert.equal(await verifyPassword("correct horse battery staple", stored), true)
  })

  it("rejects the wrong password", async () => {
    const stored = await hashPassword("password123")
    assert.equal(await verifyPassword("password124", stored), false)
    assert.equal(await verifyPassword("", stored), false)
    assert.equal(await verifyPassword("Password123", stored), false)
  })

  it("rejects a password differing only by trailing space", async () => {
    const stored = await hashPassword("password123")
    assert.equal(await verifyPassword("password123 ", stored), false)
  })

  it("handles a password at the edge of the form's length limits", async () => {
    const stored = await hashPassword("a".repeat(6))
    assert.equal(await verifyPassword("a".repeat(6), stored), true)
    assert.equal(await verifyPassword("a".repeat(7), stored), false)
  })

  it("accepts a credential that predates hashing", async () => {
    assert.equal(await verifyPassword("password123", "password123"), true)
    assert.equal(await verifyPassword("wrong", "password123"), false)
  })

  it("refuses an empty stored value rather than treating it as a match", async () => {
    assert.equal(await verifyPassword("anything", ""), false)
    assert.equal(await verifyPassword("", ""), false)
  })

  it("refuses a tampered hash rather than crashing on it", async () => {
    const stored = await hashPassword("password123")
    const [, cost, keyLength, salt] = stored.split("$")
    const truncated = `scrypt$${cost}$${keyLength}$${salt}`
    assert.equal(await verifyPassword("password123", truncated), false)
    assert.equal(await verifyPassword("password123", "not-a-hash-at-all"), false)
    assert.equal(await verifyPassword("password123", "bcrypt$12$abcdefghijklmnop"), false)
  })

  it("does not accept a hash whose key length contradicts the header", async () => {
    const stored = await hashPassword("password123")
    const [, cost, , salt, key] = stored.split("$")
    const lying = `scrypt$${cost}$8$${salt}$${key}`
    assert.equal(await verifyPassword("password123", lying), false)
  })
})

describe("upgrade detection", () => {
  it("treats a plain text credential as needing a hash", () => {
    assert.equal(isLegacyPlainText("password123"), true)
    assert.equal(needsRehash("password123"), true)
  })

  it("leaves a current hash alone", async () => {
    const stored = await hashPassword("password123")
    assert.equal(isLegacyPlainText(stored), false)
    assert.equal(needsRehash(stored), false)
  })

  it("flags a hash written with a weaker work factor", async () => {
    const stored = await hashPassword("password123")
    const [, , keyLength, salt, key] = stored.split("$")
    const weaker = `scrypt$1024$${keyLength}$${salt}$${key}`
    assert.equal(needsRehash(weaker), true, "a cheap hash should be upgraded while we can")
  })

  it("still verifies a hash written with weaker settings", async () => {
    // A weaker stored hash is a reason to re-hash on sign in, never a reason to
    // lock the owner out of their account.
    const { scryptSync } = await import("node:crypto")
    const salt = Buffer.from("00112233445566778899aabbccddeeff", "hex")
    const key = scryptSync("password123", salt, 64, { N: 1024, r: 8, p: 1 })
    const weaker = `scrypt$1024$64$${salt.toString("hex")}$${key.toString("hex")}`
    assert.equal(needsRehash(weaker), true)
    assert.equal(await verifyPassword("password123", weaker), true)
  })
})
