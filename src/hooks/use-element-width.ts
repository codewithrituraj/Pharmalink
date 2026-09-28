"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Measures an element so charts can render SVG at real pixel size. Text and
 * strokes stay crisp at any viewport width instead of being scaled by a
 * viewBox, which matters from 390px up to 1440px.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => setWidth(element.clientWidth)
    update()

    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
