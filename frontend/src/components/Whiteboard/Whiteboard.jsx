import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import GridBackground from './GridBackground'
import FeedbackOverlay from '../FeedbackOverlay/FeedbackOverlay'
import FeedbackSidePanel from '../FeedbackOverlay/FeedbackSidePanel'
import { useWhiteboard } from '../../hooks/useWhiteboard'
import './Whiteboard.css'

const COLORS = ['#000000', '#1d4ed8', '#dc2626', '#16a34a']
const WIDTH = 800
const HEIGHT = 520

const Whiteboard = forwardRef(function Whiteboard({ questionId, questionText, questionMarks, onSaved }, ref) {
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
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (!questionId) return
    fetch(`/whiteboards/${questionId}.json?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((loaded) => {
        load(loaded)
        dirtyRef.current = false
      })
      .catch(() => load([]))
  }, [questionId, load])

  const handlePointerDown = (e) => {
    if (isReadOnly || tool !== 'pen') return
    const pos = e.target.getStage().getPointerPosition()
    isDrawing.current = true
    currentPoints.current = [pos.x, pos.y]
    setLivePoints([...currentPoints.current])
  }

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return
    const pos = e.target.getStage().getPointerPosition()
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
  }

  useImperativeHandle(ref, () => ({
    save: async () => {
      if (!stageRef.current || !dirtyRef.current) return
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
      await fetch('/api/whiteboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: questionId ?? 'whiteboard',
          dataUrl,
          strokes: strokesRef.current,
        }),
      })
      dirtyRef.current = false
      onSaved?.(questionId)
    },
  }))

  const submitForMarking = async () => {
    if (!stageRef.current) return

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
        model: 'gemini-3.1-flash-lite',
      }
      
      console.log("Sending image to backend",payload)
      console.log(data)
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setMarkError(data?.detail ?? 'Marking failed — try again.')
        return
      }

      setMarkingResult(data)
      dirtyRef.current = false
      onSaved?.(questionId)
    } catch {
      setMarkError('Could not reach the marking service.')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="whiteboard">
      <div className="whiteboard-toolbar">
        <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')} disabled={isReadOnly}>
          Pen
        </button>
        <button
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
        <button onClick={handleUndo} disabled={isReadOnly}>
          Undo
        </button>
        <button onClick={handleClear} disabled={isReadOnly}>
          Clear
        </button>
        {isReadOnly ? (
          <button onClick={handleTryAgain}>Try again</button>
        ) : (
          <button onClick={submitForMarking} disabled={marking}>
            {marking ? 'Checking…' : 'Mark my answer'}
          </button>
        )}
        {markError && <span className="whiteboard-error">{markError}</span>}
      </div>

      <div className="whiteboard-row">
        <Stage
          ref={stageRef}
          width={WIDTH}
          height={HEIGHT}
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
            {strokes.map((stroke, i) => (
              <Line
                key={i}
                points={stroke.points}
                stroke={stroke.color}
                strokeWidth={3}
                hitStrokeWidth={20}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                onClick={() => handleStrokeClick(i)}
                onTap={() => handleStrokeClick(i)}
                onMouseEnter={(e) => {
                  if (tool === 'eraser') e.target.getStage().container().style.cursor = 'pointer'
                }}
                onMouseLeave={(e) => {
                  e.target.getStage().container().style.cursor = 'default'
                }}
              />
            ))}
            {livePoints && (
              <Line points={livePoints} stroke={color} strokeWidth={3} tension={0.4} lineCap="round" lineJoin="round" />
            )}
          </Layer>
          <FeedbackOverlay
            markingResult={markingResult}
            width={WIDTH}
            height={HEIGHT}
            hoveredIndex={hoveredIndex}
            onHoverError={setHoveredIndex}
          />
        </Stage>

        <FeedbackSidePanel markingResult={markingResult} hoveredIndex={hoveredIndex} />
      </div>
    </div>
  )
})

export default Whiteboard
