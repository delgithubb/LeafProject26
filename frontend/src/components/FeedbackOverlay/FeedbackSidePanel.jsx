import './FeedbackSidePanel.css'

function FeedbackSidePanel({ markingResult, hoveredIndex }) {
  if (!markingResult) return null

  const hoveredError = hoveredIndex != null ? markingResult.errors[hoveredIndex] : null

  return (
    <div className="feedback-panel">
      <h3>Feedback</h3>
      <p className="feedback-summary">{markingResult.summary}</p>
      <div className="feedback-explanation">
        {hoveredError ? (
          <p>{hoveredError.explanation}</p>
        ) : (
          <p className="feedback-hint">Hover a red highlight to see why.</p>
        )}
      </div>
    </div>
  )
}

export default FeedbackSidePanel
