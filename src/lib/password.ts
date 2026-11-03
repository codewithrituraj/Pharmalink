/**
 * Password hashing.
 *
 * scrypt is used because it is in the Node standard library, which keeps the
 * project free of a native build step and of a dependency that would have to be
 * trusted with every credential. It is memory-hard, so a stolen database is
 * expensive to attack in bulk, which is the failure mode that matters for a
 * stored credential.
 *
 * A stored value looks like:
 *
 *   scrypt$16384$64$<salt hex>$<derived key hex>
 *
 * The parameters are recorded in the value so that raising the work factor
 * later does not invalidate existing hashes: a value written with weaker
 * settings still verifies, and `needsRehash` reports that it should be
 * upgraded on the next successful sign in.
 *
 * Credentials that predate this module were stored as plain text. They are
 * still accepted, because a hash of an unknown password cannot be computed, and
 * they are rewritten as a hash the moment their owner signs in successfully. See
 * `verifyPassword` and `needsRehash`.
 */
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto"

const SCHEME = "scrypt"
const COST = 16384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const SALT_BYTES = 16
const KEY_BYTES = 64

/**
 * `promisify(scrypt)` is not used because it collapses scrypt's overloads to a
 * three argument signature, and the work factor is passed as a fourth argument.
 */
function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

export function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  return deriveKey(plain, salt, KEY_BYTES, { N: COST, r: BLOCK_SIZE, p: PARALLELISM }).then(
    (derived) => [SCHEME, COST, KEY_BYTES, salt.toString("hex"), derived.toString("hex")].join("$"),
  )
}

function timingSafeStringEquals(a: string, b: string): boolean {
  // Hashing first gives two fixed-length buffers, so the comparison is
  // length-safe and still does not leak where two strings differ.
  const left = createHash("sha256").update(a, "utf8").digest()
  const right = createHash("sha256").update(b, "utf8").digest()
  return timingSafeEqual(left, right)
}

function parseStored(stored: string) {
  const parts = stored.split("$")
  if (parts.length !== 5) return null
  const [scheme, cost, keyLength, saltHex, keyHex] = parts
  if (scheme !== SCHEME) return null
  if (!/^\d+$/.test(cost) || !/^\d+$/.test(keyLength)) return null
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(keyHex)) return null
  return {
    cost: Number(cost),
    keyLength: Number(keyLength),
    salt: Buffer.from(saltHex, "hex"),
    key: Buffer.from(keyHex, "hex"),
  }
}

/** True when the stored value is plain text rather than a hash. */
export function isLegacyPlainText(stored: string): boolean {
  return parseStored(stored) === null
}

/**
 * True when a stored hash was produced with weaker parameters than this module
 * now uses, so it should be replaced after a successful sign in.
 */
export function needsRehash(stored: string): boolean {
  const parsed = parseStored(stored)
  if (parsed === null) return true
  return parsed.cost < COST || parsed.keyLength < KEY_BYTES
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false

  const parsed = parseStored(stored)
  if (parsed === null) {
    // A credential from before hashing existed. Comparing it is unavoidable, so
    // the caller is expected to replace it with a hash once it matches.
    return timingSafeStringEquals(plain, stored)
  }

  if (parsed.key.length !== parsed.keyLength) return false

  const derived = await deriveKey(plain, parsed.salt, parsed.keyLength, {
    N: parsed.cost,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  })

  return derived.length === parsed.key.length && timingSafeEqual(derived, parsed.key)
}
