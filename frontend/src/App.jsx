import { useEffect, useState } from 'react'
import Whiteboard from './components/Whiteboard/Whiteboard'
import QuestionPanel from './components/QuestionPanel/QuestionPanel'
import './App.css'

// Path to the bundled question set. May move once question sets are selectable.
const QUESTION_SET_PATH = '/questions.json'

function App() {
  const [questionSet, setQuestionSet] = useState(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    fetch(QUESTION_SET_PATH)
      .then((res) => res.json())
      .then(setQuestionSet)
  }, [])

  const question = questionSet?.questions[index]

  return (
    <main className="app">
      <div className="app-column">
        <QuestionPanel
          question={question}
          questionNumber={index + 1}
          totalQuestions={questionSet?.questions.length ?? 0}
          onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setIndex((i) => Math.min((questionSet?.questions.length ?? 1) - 1, i + 1))
          }
        />
        <Whiteboard
          key={question?.id}
          questionId={question?.id}
          questionText={question?.text ?? ''}
          questionMarks={question?.marks ?? 3}
        />
      </div>
    </main>
  )
}

export default App
