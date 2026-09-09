import { useEffect, useState } from "react";

function Question({ item, index, answer, locked, onChoose }) {
  function optionClass(optionIndex) {
    if (!locked) return optionIndex === answer ? "option is-selected" : "option";
    if (optionIndex === item.correct_index) return "option is-correct";
    if (optionIndex === answer) return "option is-wrong";
    return "option is-muted";
  }

  return (
    <li className="question">
      <p className="question-text">
        <span className="question-number">{index + 1}</span>
        {item.question}
      </p>

      <div className="options" role="radiogroup" aria-label={`Question ${index + 1} options`}>
        {item.options.map((option, optionIndex) => (
          <button
            key={optionIndex}
            type="button"
            className={optionClass(optionIndex)}
            onClick={() => onChoose(index, optionIndex)}
            disabled={locked}
            role="radio"
            aria-checked={optionIndex === answer}
          >
            <span className="option-marker" aria-hidden="true" />
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>

      {locked && <p className="explanation">{item.explanation || item.explaination || "Review the highlighted answer."}</p>}
    </li>
  );
}

export default function QuizCard({ set, onSubmit, onRegenerate }) {
  const completed = set.score !== null && set.score !== undefined;
  const emptyAnswers = Array(set.questions.length).fill(null);
  const [answers, setAnswers] = useState(completed ? set.answers || emptyAnswers : emptyAnswers);
  const [saved, setSaved] = useState(completed);
  const [started, setStarted] = useState(completed);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const isCompleted = set.score !== null && set.score !== undefined;
    setAnswers(isCompleted ? set.answers || Array(set.questions.length).fill(null) : Array(set.questions.length).fill(null));
    setSaved(isCompleted);
    setStarted(isCompleted);
    // Keyed on id + created_at (not the whole `set` object) so a re-fetched
    // history list or a sort change doesn't wipe answers being filled in for
    // the same test. created_at only changes when the quiz is regenerated,
    // which is when the questions actually differ and progress must reset.
  }, [set.id, set.created_at]);

  function choose(index, answer) {
    if (saved || !started) return;
    setAnswers((current) => current.map((value, i) => (i === index ? answer : value)));
  }

  async function submit() {
    setSaving(true);
    try {
      const result = await onSubmit(set.id, answers);
      setAnswers(result.answers);
      setSaved(true);
      setStarted(true);
    } finally {
      setSaving(false);
    }
  }

  const answeredCount = answers.filter((answer) => answer !== null).length;
  const complete = answeredCount === answers.length;
  const locked = saved || !started;

  return (
    <article className="card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">{set.source_type || "text"} source</p>
          <h2 className="test-name">{set.name || "Untitled test"}</h2>
        </div>
        <div className={saved ? "score-block" : "score-block is-pending"}>
          <strong className="score">{saved ? `${set.score}/${set.questions.length}` : `—/${set.questions.length}`}</strong>
          <span>{saved ? "Total marks" : "Not taken"}</span>
        </div>
      </div>
      <p className="summary">{set.summary}</p>

      <div className="questions-heading">
        <h2>Questions</h2>
        {started && !saved && (
          <span className="progress-pill">{answeredCount} / {answers.length} answered</span>
        )}
      </div>
      <ol className="questions">
        {set.questions.map((item, i) => (
          <Question key={i} item={item} index={i} answer={answers[i]} locked={locked} onChoose={choose} />
        ))}
      </ol>
      <div className="card-actions">
        {!started && <button type="button" className="primary" onClick={() => setStarted(true)}>Take test</button>}
        {started && !saved && (
          <button type="button" className="primary" onClick={submit} disabled={!complete || saving}>
            {saving ? "Saving results…" : "Submit test"}
          </button>
        )}
        {saved && onRegenerate && <button type="button" className="secondary" onClick={() => onRegenerate(set)}>Regenerate quiz</button>}
        {started && !saved && !complete && (
          <span className="hint">{answers.length - answeredCount} question{answers.length - answeredCount === 1 ? "" : "s"} left to answer.</span>
        )}
      </div>
    </article>
  );
}
