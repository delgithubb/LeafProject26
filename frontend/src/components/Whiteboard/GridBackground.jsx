import { Line } from 'react-konva'

const GRID_SIZE = 24
const GRID_COLOR = '#e0e0e0'

function GridBackground({ width, height }) {
  const lines = []

  for (let x = 0; x <= width; x += GRID_SIZE) {
    lines.push(
      <Line key={`v-${x}`} points={[x, 0, x, height]} stroke={GRID_COLOR} strokeWidth={1} listening={false} />
    )
  }
  for (let y = 0; y <= height; y += GRID_SIZE) {
    lines.push(
      <Line key={`h-${y}`} points={[0, y, width, y]} stroke={GRID_COLOR} strokeWidth={1} listening={false} />
    )
  }

  return lines
}

export default GridBackground
