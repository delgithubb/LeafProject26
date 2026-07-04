import { useEffect, useRef, useState } from 'react'
import Whiteboard from './components/Whiteboard/Whiteboard'
import QuestionPanel from './components/QuestionPanel/QuestionPanel'
import HistorySidebar from './components/HistorySidebar/HistorySidebar'
import './App.css'

// Path to the bundled question set. May move once question sets are selectable.
const QUESTION_SET_PATH = '/questions.json'

function savedIdsKey(setId) {
  return `maths-tutor-saved:${setId}`
}

function App() {
  const [questionSet, setQuestionSet] = useState(null)
  const [index, setIndex] = useState(0)
  const [savedIds, setSavedIds] = useState(new Set())
  const whiteboardRef = useRef(null)

  useEffect(() => {
    fetch(QUESTION_SET_PATH)
      .then((res) => res.json())
      .then((data) => {
        setQuestionSet(data)
        const stored = localStorage.getItem(savedIdsKey(data.id))
        setSavedIds(new Set(stored ? JSON.parse(stored) : []))
      })
  }, [])

  const question = questionSet?.questions[index]

  const handleSaved = (questionId) => {
    if (!questionId || !questionSet) return
    setSavedIds((prev) => {
      const next = new Set(prev).add(questionId)
      localStorage.setItem(savedIdsKey(questionSet.id), JSON.stringify([...next]))
      return next
    })
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
          onSaved={handleSaved}
        />
      </div>
    </main>
  )
}

export default App
