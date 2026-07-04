import { useCallback, useState } from 'react'

export function useWhiteboard() {
  const [strokes, setStrokes] = useState([])

  const addStroke = useCallback((stroke) => {
    setStrokes((prev) => [...prev, stroke])
  }, [])

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1))
  }, [])

  const removeStroke = useCallback((index) => {
    setStrokes((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clear = useCallback(() => {
    setStrokes([])
  }, [])

  return { strokes, addStroke, undo, removeStroke, clear }
}
