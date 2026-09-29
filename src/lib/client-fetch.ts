/**
 * Reading JSON from the app's own API in a browser component.
 *
 * A page that fetches its own route and trusts the result has two bad endings.
 * If the request is refused or fails, the body is an error object like
 * { error: "Unauthorized" } rather than the list the page expects, and rendering
 * it throws on the first .map. If the request never completes, a catch handler
 * that forgets to clear the loading flag leaves a skeleton on screen forever.
 *
 * Both are fixed by not deciding anything from a response that did not succeed.
 * The caller gets null and picks the empty state it already has, which keeps the
 * page rendering, and keeps it a 200.
 */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // A dropped connection is not a reason to take the page down with it.
    return null
  }
}
