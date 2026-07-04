import { useEffect, useRef, useState } from 'react'
import Whiteboard from './components/Whiteboard/Whiteboard'
import QuestionPanel from './components/QuestionPanel/QuestionPanel'
import HistorySidebar from './components/HistorySidebar/HistorySidebar'
import './App.css'

// Path to the bundled question set. May move once question sets are selectable.
const QUESTION_SET_PATH = '/questions.json'

function App() {
  const [questionSet, setQuestionSet] = useState(null)
  const [index, setIndex] = useState(0)
  // Session-only: intentionally not persisted, so questions never show as
  // "saved" just because a previous session left files on disk.
  const [savedIds, setSavedIds] = useState(new Set())
  const whiteboardRef = useRef(null)

  useEffect(() => {
    fetch(QUESTION_SET_PATH)
      .then((res) => res.json())
      .then(setQuestionSet)
  }, [])

  const question = questionSet?.questions[index]

  const handleSaved = (questionId) => {
    if (!questionId) return
    setSavedIds((prev) => new Set(prev).add(questionId))
  }

  const goToIndex = async (nextIndex) => {
    await whiteboardRef.current?.save()
    setIndex(nextIndex)
  }

  return (
    <main className="app">
      {questionSet && (
        <HistorySidebar
          questions={questionSet.questions}
          activeIndex={index}
          savedIds={savedIds}
          onSelect={goToIndex}
        />
      )}

      <div className="app-column">
        <QuestionPanel
          question={question}
          questionNumber={index + 1}
          totalQuestions={questionSet?.questions.length ?? 0}
          onPrev={() => goToIndex(Math.max(0, index - 1))}
          onNext={() => goToIndex(Math.min((questionSet?.questions.length ?? 1) - 1, index + 1))}
        />
        <Whiteboard
          key={question?.id}
          ref={whiteboardRef}
          questionId={question?.id}
          questionText={question?.text ?? ''}
          questionMarks={question?.marks ?? 3}
          onSaved={handleSaved}
        />
      </div>
    </main>
  )
}

export default App
