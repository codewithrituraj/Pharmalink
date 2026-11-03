import "server-only"

type SupabaseClient = {
  from: (table: string) => {
    select: (columns?: string) => {
      limit: (count: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>
    }
  }
}

type SupabaseRequestInit = RequestInit & { accessToken?: string }

function supabaseHeaders(keyName: "SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY", accessToken?: string) {
  const key = process.env[keyName]
  if (!key) throw new Error(`Missing ${keyName} configuration`)
  return {
    apikey: key,
    Authorization: `Bearer ${accessToken ?? key}`,
    "Content-Type": "application/json",
  }
}

export async function supabaseRequest(
  path: string,
  init: SupabaseRequestInit = {},
  mode: "public" | "admin" = "public",
) {
  const url = process.env.SUPABASE_URL
  if (!url) throw new Error("Missing SUPABASE_URL configuration")
  const keyName = mode === "admin" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY"
  const { accessToken, ...requestInit } = init
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    ...requestInit,
    headers: { ...supabaseHeaders(keyName, accessToken), ...(requestInit.headers ?? {}) },
    cache: "no-store",
  })
  const body = await response.json().catch(() => null)
  return { response, body }
}

export async function getSupabaseUser(request: Request) {
  const authorization = request.headers.get("authorization")
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return null
  const { response, body } = await supabaseRequest("/auth/v1/user", { accessToken }, "public")
  if (!response.ok || !body?.id) return null
  return body as { id: string; email?: string; user_metadata?: Record<string, unknown> }
}

function createClient(keyName: "SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_ROLE_KEY"): SupabaseClient {
  return {
    from(table) {
      const url = process.env.SUPABASE_URL
      const key = process.env[keyName]

      if (!url || !key) {
        throw new Error(`Missing ${keyName === "SUPABASE_ANON_KEY" ? "Supabase public" : "Supabase admin"} configuration`)
      }

      const baseUrl = `${url.replace(/\/$/, "")}/rest/v1`
      const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      }

      return {
        select(columns = "*") {
          return {
            async limit(count) {
              const response = await fetch(`${baseUrl}/${encodeURIComponent(table)}?select=${encodeURIComponent(columns)}&limit=${count}`, {
                headers,
                cache: "no-store",
              })
              const body = await response.json().catch(() => null)
              return {
                data: response.ok && Array.isArray(body) ? body : null,
                error: response.ok ? null : { message: body?.message ?? body?.error ?? `Supabase returned ${response.status}` },
              }
            },
          }
        },
      }
    },
  }
}

/** Public-key client. Use only for operations protected by Supabase RLS. */
export const supabasePublic = createClient("SUPABASE_ANON_KEY")

/** Service-role client. Server-side only; never import this from a client component. */
export const supabaseAdmin = createClient("SUPABASE_SERVICE_ROLE_KEY")
