import { useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import './QuestionPanel.css'

function renderText(text) {
  const parts = text.split(/\\\((.*?)\\\)/g)
  return parts.map((part, i) => {
    if (i % 2 !== 1) return <span key={i}>{part}</span>
    const html = katex.renderToString(part, { throwOnError: false })
    return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
  })
}

function QuestionPanel({ question, questionNumber, totalQuestions, onPrev, onNext }) {
  const [showHint, setShowHint] = useState(false)

  if (!question) return null

  return (
    <div className="question-panel">
      <div className="question-panel-header">
        <span className="question-topic">{question.topic}</span>
        <span className="question-marks">{question.marks} marks</span>
      </div>

      <p className="question-text">{renderText(question.text)}</p>

      {question.hint && (
        <div className="question-hint">
          <button onClick={() => setShowHint((v) => !v)}>
            {showHint ? 'Hide hint' : 'Show hint'}
          </button>
          {showHint && <p>{question.hint}</p>}
        </div>
      )}

      <div className="question-nav">
        <button onClick={onPrev} disabled={questionNumber <= 1}>
          Previous
        </button>
        <span>
          Question {questionNumber} of {totalQuestions}
        </span>
        <button onClick={onNext} disabled={questionNumber >= totalQuestions}>
          Next question
        </button>
      </div>
    </div>
  )
}

export default QuestionPanel
