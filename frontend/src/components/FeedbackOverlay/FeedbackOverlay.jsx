import { Layer, Rect, Text } from 'react-konva'

const MIN_FONT = 14
const MAX_FONT = 36

function scaledFontSize(fontSizePx, height) {
  const estimated = fontSizePx || height * 0.03
  return Math.min(MAX_FONT, Math.max(MIN_FONT, estimated))
}

function FeedbackOverlay({ markingResult, width, height, hoveredIndex, onHoverError }) {
  if (!markingResult) return null

  return (
    <Layer>
      {markingResult.errors.map((error, i) => {
        const [x, y, w, h] = error.image_relative_bbox
        const isHovered = hoveredIndex === i
        return (
          <Rect
            key={i}
            x={x * width}
            y={y * height}
            width={w * width}
            height={h * height}
            fill={isHovered ? 'rgba(220, 38, 38, 0.35)' : 'rgba(220, 38, 38, 0.2)'}
            stroke="#dc2626"
            strokeWidth={isHovered ? 2 : 1}
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
        const [lx, ly] = completion.image_relative_line_position
        return (
          <Text
            key={i}
            x={lx * width}
            y={ly * height}
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
