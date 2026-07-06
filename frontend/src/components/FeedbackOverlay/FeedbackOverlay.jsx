import { Layer, Text } from 'react-konva'

const MIN_FONT = 18
const MAX_FONT = 26

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Shared with Whiteboard.jsx so stroke-matching uses the same tolerance as
// whatever padding this box gets for display purposes.
export function normalizeBox(box) {
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

// Error regions are shown by recoloring the matching student strokes red
// (see Whiteboard.jsx) rather than drawing boxes over them here.
function FeedbackOverlay({ markingResult, width, height }) {
  if (!markingResult) return null
  return (
    <Layer>
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
