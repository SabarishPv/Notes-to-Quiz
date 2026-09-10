import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import LogoMark from "../components/LogoMark";
import Spinner from "../components/Spinner";
import { IconArrowRight } from "../components/Icons";
import { publicApi } from "../lib/api";
import { useTheme } from "../lib/theme";

function OptionButton({ label, state, disabled, onClick }) {
  return (
    <button type="button" className={`option ${state}`} onClick={onClick} disabled={disabled}>
      <span className="option-marker" aria-hidden="true" />
      <span className="option-text">{label}</span>
    </button>
  );
}

export default function SharedQuiz() {
  const { token } = useParams();
  const [theme, setTheme] = useTheme();

  const [quiz, setQuiz] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | taking | done
  const [guestName, setGuestName] = useState("");
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    publicApi
      .getSharedQuiz(token)
      .then((data) => {
        setQuiz(data);
        setAnswers(Array(data.questions.length).fill(null));
      })
      .catch((err) => setLoadError(err.message));
  }, [token]);

  const answeredCount = answers.filter((a) => a !== null).length;
  const complete = quiz && answeredCount === quiz.questions.length;

  async function submit() {
    setSubmitting(true);
    try {
      const data = await publicApi.submitSharedAttempt(token, answers, guestName.trim());
      setResult(data);
      setPhase("done");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shared-page">
      <header className="landing-nav">
        <Link to="/" className="brand brand-link">
          <LogoMark size={40} />
          <h1>Notes to quiz</h1>
        </Link>
        <label className="theme-control">
          <span>Theme</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
            <option value="system">System</option>
            <option value="light">Day</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>

      {loadError && !quiz && (
        <div className="card">
          <h2 className="test-name">Link unavailable</h2>
          <p className="summary">{loadError}</p>
          <Link to="/" className="primary">Go home <IconArrowRight width={16} height={16} /></Link>
        </div>
      )}

      {!quiz && !loadError && <p className="notice">Loading the quiz…</p>}

      {quiz && (
        <article className="card">
          <div className="card-heading">
            <div className="card-heading-info">
              <p className="eyebrow">Shared quiz{quiz.attempt_count > 0 ? ` · taken ${quiz.attempt_count}×` : ""}</p>
              <h2 className="test-name">{quiz.name}</h2>
            </div>
            {phase === "done" && result && (
              <div className="score-block">
                <strong className="score">{result.score}/{result.total}</strong>
                <span>Your score</span>
              </div>
            )}
          </div>

          <p className="summary">{quiz.summary}</p>

          {phase === "intro" && (
            <div className="shared-gate">
              <label className="field-label" htmlFor="guest-name">Your name (optional)</label>
              <input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="So the quiz owner knows who took it"
                maxLength={80}
              />
              <button type="button" className="primary" onClick={() => setPhase("taking")}>
                Start quiz ({quiz.questions.length} questions)
              </button>
            </div>
          )}

          {phase !== "intro" && (
            <>
              <h2 className="section-label">Questions</h2>
              <ol className="questions">
                {quiz.questions.map((q, i) => {
                  const review = result?.review?.[i];
                  return (
                    <li key={i} className="question" style={{ "--i": i }}>
                      <p className="question-text">
                        <span className="question-number">{i + 1}</span>
                        <span>
                          {q.question}
                          <span className="question-type-badge">
                            {q.type === "true_false" ? "True / False" : "Multiple choice"}
                          </span>
                        </span>
                      </p>
                      <div className={q.type === "true_false" ? "options options-two" : "options"} role="radiogroup">
                        {q.options.map((opt, oi) => {
                          let state = answers[i] === oi ? "is-selected" : "";
                          if (review) {
                            if (oi === review.correct_index) state = "is-correct";
                            else if (oi === review.your_answer) state = "is-wrong";
                            else state = "is-muted";
                          }
                          return (
                            <OptionButton
                              key={oi}
                              label={opt}
                              state={state}
                              disabled={phase === "done"}
                              onClick={() =>
                                setAnswers((cur) => cur.map((v, idx) => (idx === i ? oi : v)))
                              }
                            />
                          );
                        })}
                      </div>
                      {review && <p className="explanation">{review.explanation || "Review the highlighted answer."}</p>}
                    </li>
                  );
                })}
              </ol>

              {phase === "taking" && (
                <div className="actions">
                  <span className="counter">{answeredCount} / {quiz.questions.length} answered</span>
                  <button type="button" className="primary" onClick={submit} disabled={!complete || submitting}>
                    {submitting && <Spinner />}
                    {submitting ? "Scoring…" : "Submit answers"}
                  </button>
                </div>
              )}

              {phase === "done" && (
                <div className="actions">
                  <span className="counter">Nice work. Want your own quizzes?</span>
                  <Link to="/studio" className="primary">Try Notes to quiz <IconArrowRight width={16} height={16} /></Link>
                </div>
              )}
            </>
          )}
        </article>
      )}
    </main>
  );
}
