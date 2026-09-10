import { useEffect, useMemo, useState } from "react";

import Menu from "./Menu";
import Spinner from "./Spinner";
import { IconCheck, IconFolder, IconRefresh, IconShare, IconSort, IconTrash } from "./Icons";

function timeAgo(iso) {
  if (!iso) return "";
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Question({ item, index, answer, revealed, disabled, onChoose }) {
  function optionClass(optionIndex) {
    if (revealed) {
      if (optionIndex === item.correct_index) return "option is-correct";
      if (optionIndex === answer) return "option is-wrong";
      return "option is-muted";
    }
    return optionIndex === answer ? "option is-selected" : "option";
  }

  const badge = item.type === "true_false" ? "True / False" : "Multiple choice";

  return (
    <li className="question" style={{ "--i": index }}>
      <p className="question-text">
        <span className="question-number">{index + 1}</span>
        <span>
          {item.question}
          <span className="question-type-badge">{badge}</span>
        </span>
      </p>

      <div className={item.type === "true_false" ? "options options-two" : "options"} role="radiogroup">
        {item.options.map((option, optionIndex) => (
          <button
            key={optionIndex}
            type="button"
            className={optionClass(optionIndex)}
            onClick={() => onChoose(index, optionIndex)}
            disabled={disabled}
            role="radio"
            aria-checked={optionIndex === answer}
          >
            <span className="option-marker" aria-hidden="true" />
            <span className="option-text">{option}</span>
          </button>
        ))}
      </div>

      {revealed && (
        <p className="explanation">{item.explanation || item.explaination || "Review the highlighted answer."}</p>
      )}
    </li>
  );
}

export default function QuizCard({
  set,
  onSubmit,
  onRegenerate,
  onShare,
  onRevokeShare,
  onDelete,
  onMove,           // (quizId, folderIdOrNull) => void
  folders = [],     // [{ id, name }]
  sortMenu,         // { value, options: [{value,label}], onChange }
  regenerating = false,
}) {
  const total = set.questions.length;
  const [phase, setPhase] = useState("idle"); // idle | taking | graded
  const [answers, setAnswers] = useState(() => Array(total).fill(null));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false); // share / revoke in flight
  const [copied, setCopied] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // Reset when a different quiz is shown, or when it's regenerated.
  useEffect(() => {
    setPhase("idle");
    setAnswers(Array(set.questions.length).fill(null));
    setLastResult(null);
    setCopied(false);
  }, [set.id, set.created_at, set.questions.length]);

  const answeredCount = answers.filter((a) => a !== null).length;
  const complete = answeredCount === total;

  const shareUrl = useMemo(
    () => (set.share_token ? `${window.location.origin}/s/${set.share_token}` : null),
    [set.share_token],
  );

  function choose(index, value) {
    if (phase !== "taking") return;
    setAnswers((cur) => cur.map((v, i) => (i === index ? value : v)));
  }

  function startTaking() {
    setAnswers(Array(total).fill(null));
    setLastResult(null);
    setPhase("taking");
  }

  async function submit() {
    setSaving(true);
    try {
      const updated = await onSubmit(set.id, answers);
      setLastResult({ score: updated.score ?? updated.last_attempt?.score, total });
      setPhase("graded");
    } finally {
      setSaving(false);
    }
  }

  async function toggleShare() {
    setBusy(true);
    try {
      if (set.share_token) await onRevokeShare(set.id);
      else await onShare(set.id);
    } finally {
      setBusy(false);
    }
  }

  function copyShare() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const revealed = phase === "graded";
  const disabled = phase !== "taking";
  const attempts = set.attempts || [];
  const taken = set.attempt_count > 0;
  const scoreText =
    phase === "graded" && lastResult ? `${lastResult.score}/${lastResult.total}`
    : set.best_score != null ? `${set.best_score}/${total}`
    : `—/${total}`;

  const menuItems = [
    {
      label: "Retake test",
      icon: <IconRefresh width={15} height={15} />,
      onClick: startTaking,
      // The first-time CTA is the visible "Take test" button; only surface
      // retake in the menu once the quiz has actually been taken.
      hidden: phase === "taking" || (phase === "idle" && !taken),
    },
    {
      label: regenerating ? "Regenerating…" : "Regenerate questions",
      icon: <IconRefresh width={15} height={15} />,
      onClick: () => onRegenerate?.(set),
      hidden: !onRegenerate,
      disabled: regenerating,
    },
    {
      label: set.share_token ? "Stop sharing" : "Share link",
      icon: <IconShare width={15} height={15} />,
      onClick: toggleShare,
      hidden: !onShare,
      disabled: busy,
    },
    onMove && {
      label: "Move to folder",
      icon: <IconFolder width={15} height={15} />,
      submenu: [
        { label: "Unfiled", checked: set.folder_id == null, onClick: () => onMove(set.id, null) },
        ...folders.map((f) => ({
          label: f.name,
          checked: set.folder_id === f.id,
          onClick: () => onMove(set.id, f.id),
        })),
      ],
    },
    sortMenu && {
      label: "Sort quizzes",
      icon: <IconSort width={15} height={15} />,
      submenu: sortMenu.options.map((o) => ({
        label: o.label,
        checked: sortMenu.value === o.value,
        onClick: () => sortMenu.onChange(o.value),
      })),
    },
    (onDelete || onRegenerate || onShare || onMove) && { separator: true },
    onDelete && {
      label: "Delete quiz",
      icon: <IconTrash width={15} height={15} />,
      danger: true,
      onClick: () => onDelete(set),
    },
  ].filter(Boolean);

  return (
    <article className="card" key={set.id}>
      <div className="card-heading">
        <div className="card-heading-info">
          <p className="eyebrow">
            {set.source_type || "text"} source
            {taken && <span className="taken-badge">Taken {set.attempt_count}×</span>}
          </p>
          <h2 className="test-name">{set.name || "Untitled test"}</h2>
        </div>

        <div className="card-heading-actions">
          <div key={scoreText} className={revealed || set.best_score != null ? "score-block" : "score-block is-pending"}>
            <strong className="score">{scoreText}</strong>
            <span>{set.best_score != null ? "Best score" : "Not taken"}</span>
          </div>

          {phase === "idle" && !taken && (
            <button type="button" className="primary" onClick={startTaking}>Take test</button>
          )}
          {phase === "taking" && (
            <div className="submit-cluster">
              <button type="button" className="primary" onClick={submit} disabled={!complete || saving}>
                {saving && <Spinner />}
                {saving ? "Saving…" : "Submit test"}
              </button>
              <span className="hint">{answeredCount} / {total} answered</span>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${(answeredCount / total) * 100}%` }} />
              </div>
            </div>
          )}

          {menuItems.length > 0 && <Menu items={menuItems} />}
        </div>
      </div>

      {shareUrl && (
        <div className="share-bar">
          <span className="share-bar-label">Shareable link</span>
          <code>{shareUrl}</code>
          <button type="button" className="primary small" onClick={copyShare}>
            {copied ? <IconCheck width={14} height={14} /> : null}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      <p className="summary">{set.summary}</p>

      <h2 className="section-label">Questions</h2>
      <ol className="questions">
        {set.questions.map((item, i) => (
          <Question
            key={i}
            item={item}
            index={i}
            answer={answers[i]}
            revealed={revealed}
            disabled={disabled}
            onChoose={choose}
          />
        ))}
      </ol>

      {attempts.length > 0 && (
        <>
          <h2 className="section-label">Attempt history</h2>
          <ul className="attempt-list">
            {[...attempts].reverse().map((a) => (
              <li key={a.id} className="attempt-row">
                <span className="attempt-no">Attempt {a.number}</span>
                <span className="attempt-score">{a.score}/{a.total}</span>
                <span className="attempt-who">
                  {a.taker === "guest" ? (a.taker_name ? `guest · ${a.taker_name}` : "guest") : "you"}
                </span>
                <span className="attempt-time">{timeAgo(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
