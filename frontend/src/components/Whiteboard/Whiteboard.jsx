import { useRef, useState } from 'react'
import { Stage, Layer, Line } from 'react-konva'
import GridBackground from './GridBackground'
import { useWhiteboard } from '../../hooks/useWhiteboard'
import './Whiteboard.css'

const COLORS = ['#000000', '#1d4ed8', '#dc2626', '#16a34a']
const WIDTH = 800
const HEIGHT = 520

function Whiteboard({ questionId, questionText, questionMarks }) {
  const { strokes, addStroke, undo, removeStroke, clear } = useWhiteboard()
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const isDrawing = useRef(false)
  const currentPoints = useRef([])
  const [livePoints, setLivePoints] = useState(null)
  const [marking, setMarking] = useState(false)
  const stageRef = useRef(null)

  const handlePointerDown = (e) => {
    if (tool !== 'pen') return
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
    }
    currentPoints.current = []
    setLivePoints(null)
  }

  const handleStrokeClick = (index) => {
    if (tool !== 'eraser') return
    removeStroke(index)
  }

  const handleMark = async () => {
    if (!stageRef.current) return

    setMarking(true)
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 })
      const payload = {
        session_id: 'demo-session',
        question_id: questionId ?? 'demo-question',
        question_text: questionText,
        image_base64: dataUrl,
        marks: questionMarks,
        model: 'gemini-2.5-flash',
      }

      console.log('Sending whiteboard image to backend...', payload)

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('Gemini response:', data)

      if (!response.ok) {
        console.error('Backend error:', data)
      }
    } catch (error) {
      console.error('Failed to call backend:', error)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="whiteboard">
      <div className="whiteboard-toolbar">
        <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>
          Pen
        </button>
        <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>
          Eraser
        </button>
        <div className="whiteboard-colors">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch ${color === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setColor(c)
                setTool('pen')
              }}
            />
          ))}
        </div>
        <button onClick={undo}>Undo</button>
        <button onClick={clear}>Clear</button>
        <button onClick={handleMark} disabled={marking}>
          {marking ? 'Checking…' : 'Mark my work'}
        </button>
      </div>

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
      </Stage>
    </div>
  )
}

export default Whiteboard
