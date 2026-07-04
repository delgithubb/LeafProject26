import { useEffect, useRef, useState } from 'react'
import Whiteboard from './components/Whiteboard/Whiteboard'
import QuestionPanel from './components/QuestionPanel/QuestionPanel'
import HistorySidebar from './components/HistorySidebar/HistorySidebar'
import SettingsPanel from './components/SettingsPanel/SettingsPanel'
import './App.css'

// Path to the bundled question set. May move once question sets are selectable.
const QUESTION_SET_PATH = '/questions.json'
const DEFAULT_MODEL = 'gemini-2.5-flash-lite'

function App() {
  const [questionSet, setQuestionSet] = useState(null)
  const [index, setIndex] = useState(0)
  // Session-only: intentionally not persisted, so questions never show as
  // "saved" just because a previous session left files on disk.
  const [savedIds, setSavedIds] = useState(new Set())
  const whiteboardRef = useRef(null)

  // null = no explicit choice yet, follow the OS/browser preference (see index.css)
  const [theme, setTheme] = useState(() => localStorage.getItem('maths-tutor-theme') || null)
  const [model, setModel] = useState(() => localStorage.getItem('maths-tutor-model') || DEFAULT_MODEL)

  useEffect(() => {
    if (theme) {
      document.documentElement.dataset.theme = theme
      localStorage.setItem('maths-tutor-theme', theme)
    } else {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  useEffect(() => {
    localStorage.setItem('maths-tutor-model', model)
  }, [model])

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
      <SettingsPanel theme={theme} onThemeChange={setTheme} model={model} onModelChange={setModel} />

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
          model={model}
          onSaved={handleSaved}
        />
      </div>
    </main>
  )
}

export default App
