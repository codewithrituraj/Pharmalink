"use client"

import { useCallback, useEffect, useState } from "react"

type ApiResource<T> = {
  data: T | null
  error: string | null
  loading: boolean
  refresh: () => void
}

type LoadState<T> = { url: string | null; data: T | null; error: string | null }

/**
 * Fetches a JSON resource from an internal API route with loading and error
 * state, so pages stay declarative and never leave a card in a limbo state.
 */
export function useApiResource<T>(url: string | null): ApiResource<T> {
  const [state, setState] = useState<LoadState<T>>({ url, data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!url) return

    const controller = new AbortController()
    const requestUrl = url

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then((response) =>
        response
          .json()
          .catch(() => null)
          .then((payload) => {
            if (!response.ok) {
              throw new Error(payload?.error ?? `Request failed (${response.status})`)
            }
            return payload as T
          }),
      )
      .then((data) => {
        if (controller.signal.aborted) return
        setState({ url: requestUrl, data, error: null })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        const message = cause instanceof Error ? cause.message : "Something went wrong"
        setState({ url: requestUrl, data: null, error: message })
      })

    return () => controller.abort()
  }, [url, nonce])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  // Derived rather than assigned, so a new request never triggers a cascading
  // render: a request is "loading" until a result for this exact url lands.
  const settled = state.url === url
  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading: Boolean(url) && !settled,
    refresh,
  }
}

export function getErrorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message
  return "Something went wrong"
}
