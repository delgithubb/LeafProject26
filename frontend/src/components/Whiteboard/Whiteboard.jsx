import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import GridBackground from './GridBackground'
import FeedbackOverlay, { normalizeBox } from '../FeedbackOverlay/FeedbackOverlay'
import FeedbackSidePanel from '../FeedbackOverlay/FeedbackSidePanel'
import { useWhiteboard } from '../../hooks/useWhiteboard'
import './Whiteboard.css'

const COLORS = ['#000000', '#1d4ed8', '#dc2626', '#16a34a']
const ERROR_COLOR = '#dc2626'
const WIDTH = 800
const HEIGHT = 520

function strokeInBox(stroke, box) {
  const points = stroke.points
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] / WIDTH
    const y = points[i + 1] / HEIGHT
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
      return true
    }
  }
  return false
}

function findErrorIndexForStroke(stroke, errors) {
  if (!errors) return -1
  return errors.findIndex((error) => strokeInBox(stroke, normalizeBox(error.image_relative_bbox)))
}

// Translates raw backend/Gemini error text into plain-language messages a
// student can act on, instead of surfacing technical API detail.
function friendlyMarkError(status, detail) {
  const text = (detail || '').toLowerCase()

  if (text.includes('unavailable') || text.includes('high demand') || text.includes('503')) {
    return "The marking service is busy right now. Please wait a moment and try again."
  }
  if (text.includes('gemini_api_key') || text.includes('missing') ) {
    return "The marking service isn't set up correctly. Please let your teacher know."
  }
  if (text.includes('image payload cannot be empty') || text.includes('invalid base64')) {
    return "We couldn't read your whiteboard. Try drawing something before marking."
  }
  if (text.includes('question text cannot be empty')) {
    return "This question is missing its text — try reloading the page."
  }
  if (status >= 500) {
    return "Something went wrong while marking your work. Please try again in a moment."
  }
  return "We couldn't submit your work for marking. Please try again."
}

const Whiteboard = forwardRef(function Whiteboard(
  { questionId, questionText, questionMarks, model, onSaved },
  ref
) {
  const { strokes, addStroke, undo, removeStroke, clear, load } = useWhiteboard()
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [marking, setMarking] = useState(false)
  const [markingResult, setMarkingResult] = useState(null)
  const [markError, setMarkError] = useState(null)
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const isReadOnly = !!markingResult
  const isDrawing = useRef(false)
  const currentPoints = useRef([])
  const [livePoints, setLivePoints] = useState(null)
  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const dirtyRef = useRef(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScale = () => {
      const containerWidth = container.clientWidth
      if (containerWidth > 0) setScale(containerWidth / WIDTH)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!questionId) return
    fetch(`/whiteboards/${questionId}.json?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((loaded) => {
        load(loaded)
        dirtyRef.current = false
      })
      .catch(() => load([]))

    fetch(`/whiteboards/${questionId}.marking.json?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setMarkingResult)
      .catch(() => setMarkingResult(null))
  }, [questionId, load])

  const handlePointerDown = (e) => {
    if (isReadOnly || tool !== 'pen') return
    const pos = e.target.getStage().getRelativePointerPosition()
    isDrawing.current = true
    currentPoints.current = [pos.x, pos.y]
    setLivePoints([...currentPoints.current])
  }

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return
    const pos = e.target.getStage().getRelativePointerPosition()
    currentPoints.current = [...currentPoints.current, pos.x, pos.y]
    setLivePoints([...currentPoints.current])
  }

  const handlePointerUp = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (currentPoints.current.length >= 4) {
      addStroke({ points: currentPoints.current, color })
      dirtyRef.current = true
    }
    currentPoints.current = []
    setLivePoints(null)
  }

  const handleStrokeClick = (index) => {
    if (isReadOnly || tool !== 'eraser') return
    removeStroke(index)
    dirtyRef.current = true
  }

  const handleUndo = () => {
    if (isReadOnly) return
    undo()
    dirtyRef.current = true
  }

  const handleClear = () => {
    if (isReadOnly) return
    clear()
    dirtyRef.current = true
  }

  const handleTryAgain = () => {
    setMarkingResult(null)
    setMarkError(null)
    setHoveredIndex(null)
    dirtyRef.current = true
  }

  const persistWhiteboard = async (markingOverride) => {
    if (!stageRef.current) return
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
    await fetch('/api/whiteboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: questionId ?? 'whiteboard',
        dataUrl,
        strokes: strokesRef.current,
        marking: markingOverride !== undefined ? markingOverride : markingResult,
      }),
    })
    dirtyRef.current = false
    onSaved?.(questionId)
  }

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!dirtyRef.current) return
      await persistWhiteboard()
    },
  }))

  const submitForMarking = async () => {
    if (!stageRef.current || submittingRef.current) return
    submittingRef.current = true

    setMarking(true)
    setMarkError(null)
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
      const payload = {
        session_id: 'demo-session',
        question_id: questionId ?? 'demo-question',
        question_text: questionText ?? '',
        image_base64: dataUrl,
        marks: questionMarks ?? 3,
        model: model || 'gemini-2.5-flash-lite',
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Marking request failed:', data)
        setMarkError(friendlyMarkError(response.status, data?.detail))
        return
      }

      setMarkingResult(data)
      await persistWhiteboard(data)
    } catch (error) {
      console.error('Failed to reach marking service:', error)
      setMarkError('Could not reach the marking service. Check your connection and try again.')
    } finally {
      setMarking(false)
      submittingRef.current = false
    }
  }

  return (
    <div className="whiteboard">
      <div className="whiteboard-toolbar">
        <button type="button" className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')} disabled={isReadOnly}>
          Pen
        </button>
        <button
          type="button"
          className={tool === 'eraser' ? 'active' : ''}
          onClick={() => setTool('eraser')}
          disabled={isReadOnly}
        >
          Eraser
        </button>
        <div className="whiteboard-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              disabled={isReadOnly}
              onClick={() => {
                setColor(c)
                setTool('pen')
              }}
            />
          ))}
        </div>
        <button type="button" onClick={handleUndo} disabled={isReadOnly}>
          Undo
        </button>
        <button type="button" onClick={handleClear} disabled={isReadOnly}>
          Clear
        </button>
        {isReadOnly ? (
          <button type="button" onClick={handleTryAgain}>Try again</button>
        ) : (
          <button type="button" onClick={submitForMarking} disabled={marking}>
            {marking ? 'Checking…' : 'Mark my answer'}
          </button>
        )}
        {markError && <span className="whiteboard-error">{markError}</span>}
      </div>

      <div className="whiteboard-row">
        <div ref={containerRef} className="whiteboard-stage-wrapper">
        <Stage
          ref={stageRef}
          width={WIDTH * scale}
          height={HEIGHT * scale}
          scaleX={scale}
          scaleY={scale}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="whiteboard-stage"
        >
          <Layer>
            <GridBackground width={WIDTH} height={HEIGHT} />
          </Layer>
          <Layer>
            {strokes.map((stroke, i) => {
              const errorIndex = markingResult
                ? findErrorIndexForStroke(stroke, markingResult.errors)
                : -1
              const isError = errorIndex !== -1
              return (
                <Line
                  key={i}
                  points={stroke.points}
                  stroke={isError ? ERROR_COLOR : stroke.color}
                  strokeWidth={3}
                  hitStrokeWidth={20}
                  tension={0.4}
                  lineCap="round"
                  lineJoin="round"
                  onClick={() => handleStrokeClick(i)}
                  onTap={() => handleStrokeClick(i)}
                  onMouseEnter={(e) => {
                    if (tool === 'eraser') e.target.getStage().container().style.cursor = 'pointer'
                    if (isError) setHoveredIndex(errorIndex)
                  }}
                  onMouseLeave={(e) => {
                    e.target.getStage().container().style.cursor = 'default'
                    if (isError) setHoveredIndex(null)
                  }}
                />
              )
            })}
            {livePoints && (
              <Line points={livePoints} stroke={color} strokeWidth={3} tension={0.4} lineCap="round" lineJoin="round" />
            )}
          </Layer>
          <FeedbackOverlay markingResult={markingResult} width={WIDTH} height={HEIGHT} />
        </Stage>
        </div>

        <FeedbackSidePanel markingResult={markingResult} hoveredIndex={hoveredIndex} />
      </div>
    </div>
  )
})

export default Whiteboard
