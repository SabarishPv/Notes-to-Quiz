import { Fragment, useState } from "react";

import { IconChevronRight, IconFolder, IconLayers, IconPlus, IconTrash } from "./Icons";

export default function FolderRail({
  folders,
  unfiledCount,
  totalCount,
  selected,           // "all" | "unfiled" | folderId (number)
  onSelect,
  onCreate,
  onDelete,
  onNewQuiz,
  quizzes,            // quizzes in the selected folder
  selectedQuizId,
  onSelectQuiz,
  busy,
}) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");

  function submitNew() {
    const name = draftName.trim();
    if (!name) return;
    onCreate(name);
    setDraftName("");
    setCreating(false);
  }

  function quizList() {
    return (
      <div className="folder-quizzes">
        {quizzes.length === 0 ? (
          <p className="folder-quizzes-empty">No quizzes here yet</p>
        ) : (
          quizzes.map((q) => {
            const taken = q.attempt_count > 0;
            return (
              <button
                key={q.id}
                type="button"
                className={selectedQuizId === q.id ? "folder-quiz-item is-selected" : "folder-quiz-item"}
                onClick={() => onSelectQuiz(q.id)}
                title={q.name}
              >
                <span className="folder-quiz-name">{q.name}</span>
                <span className={taken ? "folder-quiz-pill is-taken" : "folder-quiz-pill"}>
                  {taken ? `${q.best_score}/${q.questions.length}` : "New"}
                </span>
              </button>
            );
          })
        )}
      </div>
    );
  }

  function row(key, label, count, icon, extra = null) {
    const active = String(selected) === String(key);
    return (
      <Fragment key={key}>
        <div className={active ? "folder-row is-active" : "folder-row"}>
          <button type="button" className="folder-row-main" onClick={() => onSelect(key)}>
            <span className={active ? "folder-caret is-open" : "folder-caret"} aria-hidden="true">
              <IconChevronRight width={13} height={13} />
            </span>
            <span className="folder-row-icon" aria-hidden="true">{icon}</span>
            <span className="folder-row-label">{label}</span>
            <span className="folder-row-count">{count}</span>
          </button>
          {extra}
        </div>
        {active && quizList()}
      </Fragment>
    );
  }

  return (
    <aside className="folder-rail">
      {onNewQuiz && (
        <button type="button" className="primary rail-new" onClick={onNewQuiz}>
          <IconPlus width={16} height={16} /> New quiz
        </button>
      )}

      <div className="folder-rail-head">
        <span>Folders</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="New folder"
          onClick={() => setCreating((v) => !v)}
          disabled={busy}
        >
          <IconPlus width={16} height={16} />
        </button>
      </div>

      {creating && (
        <form
          className="folder-new"
          onSubmit={(e) => {
            e.preventDefault();
            submitNew();
          }}
        >
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Science"
            maxLength={120}
          />
          <button type="submit" className="primary small">Add</button>
        </form>
      )}

      <div className="folder-list">
        {row("all", "All quizzes", totalCount, <IconLayers width={17} height={17} />)}
        {row("unfiled", "Unfiled", unfiledCount, <IconFolder width={17} height={17} />)}
        {folders.map((f) =>
          row(
            f.id,
            f.name,
            f.quiz_count,
            <IconFolder width={17} height={17} />,
            <button
              type="button"
              className="icon-btn folder-row-delete"
              aria-label={`Delete folder ${f.name}`}
              title="Delete folder and its quizzes"
              onClick={() => onDelete(f)}
            >
              <IconTrash width={15} height={15} />
            </button>,
          ),
        )}
      </div>
    </aside>
  );
}
