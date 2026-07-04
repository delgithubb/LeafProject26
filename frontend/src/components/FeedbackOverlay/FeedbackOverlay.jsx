import { Layer, Rect, Text } from 'react-konva'

const MIN_FONT = 14
const MAX_FONT = 36

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeBox(box) {
  if (!box || box.length !== 4) return { x: 0, y: 0, width: 0.05, height: 0.05 }

  const [x, y, w, h] = box.map(Number)
  const padX = Math.max(0.01, w * 0.08)
  const padY = Math.max(0.01, h * 0.08)

  return {
    x: clamp(x - padX / 2, 0, 1),
    y: clamp(y - padY / 2, 0, 1),
    width: clamp(w + padX, 0.03, 1),
    height: clamp(h + padY, 0.03, 1),
  }
}

function scaledFontSize(fontSizePx, height) {
  const estimated = fontSizePx || height * 0.04
  return Math.min(MAX_FONT, Math.max(MIN_FONT, estimated))
}

function FeedbackOverlay({ markingResult, width, height, hoveredIndex, onHoverError }) {
  if (!markingResult) return null
  return (
    <Layer>
      {markingResult.errors.map((error, i) => {
        const normalizedBox = normalizeBox(error.image_relative_bbox)
        const isHovered = hoveredIndex === i
        return (
          <Rect
            key={i}
            x={normalizedBox.x * width}
            y={normalizedBox.y * height}
            width={normalizedBox.width * width}
            height={normalizedBox.height * height}
            fill={isHovered ? 'rgba(220, 38, 38, 0.35)' : 'rgba(220, 38, 38, 0.2)'}
            // stroke="#dc2626"
            // strokeWidth={isHovered ? 2 : 1}
            onMouseEnter={(e) => {
              onHoverError(i)
              e.target.getStage().container().style.cursor = 'pointer'
            }}
            onMouseLeave={(e) => {
              onHoverError(null)
              e.target.getStage().container().style.cursor = 'default'
            }}
          />
        )
      })}

      {markingResult.completions.map((completion, i) => {
        const position = completion.image_relative_line_position
        return (
          <Text
            key={i}
            x={(position[0]) * width}
            y={(position[1]+0.1) * height}
            text={completion.text}
            fontFamily="Caveat, cursive"
            fontSize={scaledFontSize(completion.font_size_px, height)}
            fill="#dc2626"
            listening={false}
          />
        )
      })}
    </Layer>
  )
}

export default FeedbackOverlay
