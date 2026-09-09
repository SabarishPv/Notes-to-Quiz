import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from "@clerk/clerk-react";

import QuizCard from "./QuizCard";
import { useApi } from "./api";

const MIN_CHARS = 100;

const SOURCES = [
  {
    value: "notes",
    label: "Paste notes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h6M9 9h1" />
      </svg>
    ),
  },
  {
    value: "file",
    label: "Upload file",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
        <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
    ),
  },
  {
    value: "url",
    label: "Import URL",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 14.5 14.5 9.5" />
        <path d="M11 6.5 12.4 5a3.5 3.5 0 0 1 5 5L16 11.4" />
        <path d="M13 17.5 11.6 19a3.5 3.5 0 0 1-5-5L8 12.6" />
      </svg>
    ),
  },
];

function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h7l-1 8 11-13h-7z" />
      </svg>
    </span>
  );
}

function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      {action}
    </div>
  );
}

export default function App() {
  const { generateSet, generateUpload, fetchHistory, saveResult, regenerate, wakeServer } = useApi();
  const { user } = useUser();
  const [tab, setTab] = useState("create");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [source, setSource] = useState("notes");
  const [sort, setSort] = useState("newest");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("notes-to-quiz-theme") || "system");
  const [status, setStatus] = useState("waking");
  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("notes-to-quiz-theme", theme);
  }, [theme]);

  // The backend sleeps after 15 minutes idle. Knock on the door as soon
  // as the page opens, so it is awake by the time anyone presses Generate.
  useEffect(() => {
    wakeServer()
      .then(() => setStatus("idle"))
      .catch(() => setStatus("idle"));
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    fetchHistory(sort)
      .then((data) => {
        setHistory(data.items);
        setSelectedId((currentId) => data.items.some((item) => item.id === currentId) ? currentId : data.items[0]?.id || null);
      })
      .catch((err) => setError(err.message));
  }, [tab, sort]);

  async function handleGenerate() {
    setStatus("working");
    setError(null);
    setCurrent(null);

    try {
      const data = source === "notes"
        ? await generateSet(notes, name)
        : await generateUpload({ file: source === "file" ? file : null, url: source === "url" ? url : null, name });
      setCurrent(data);
      setName("");
      setTab("create");
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSubmit(id, answers) {
    const result = await saveResult(id, answers);
    setCurrent((currentSet) => currentSet?.id === id ? result : currentSet);
    setHistory((items) => items.map((item) => item.id === id ? result : item));
    return result;
  }

  async function handleRegenerate(set) {
    setStatus("working");
    setError(null);
    try {
      const result = await regenerate(set.id);
      setCurrent((currentSet) => (currentSet?.id === set.id ? result : currentSet));
      setHistory((items) => items.map((item) => (item.id === set.id ? result : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  function switchTab(nextTab) {
    setError(null);
    setTab(nextTab);
  }

  const sourceReady = source === "notes"
    ? notes.trim().length >= MIN_CHARS
    : source === "file" ? Boolean(file) : url.trim().length > 0;

  const selectedSet = history.find((set) => set.id === selectedId) || null;

  return (
    <main className="app">
      <header className="masthead">
        <div className="brand">
          <LogoMark />
          <div>
            <h1>Notes to quiz</h1>
            <p>Paste your notes. Get a summary and five questions to test yourself.</p>
          </div>
        </div>
        <SignedIn>
          <div className="header-tools">
            {user && (
              <span className="user-chip">
                <span className="user-dot" aria-hidden="true" />
                {user.primaryEmailAddress?.emailAddress}
              </span>
            )}
            <label className="theme-control">
              <span>Appearance</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Appearance">
                <option value="system">System</option>
                <option value="light">Day</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <UserButton />
          </div>
        </SignedIn>
      </header>

      <SignedOut>
        <section className="signin">
          <p className="signin-lede">Sign in to generate and save quizzes.</p>
          <SignIn routing="hash" />
        </section>
      </SignedOut>

      <SignedIn>

      <nav className="tabs">
        <button
          className={tab === "create" ? "tab is-active" : "tab"}
          onClick={() => switchTab("create")}
        >
          Create
        </button>
        <button
          className={tab === "history" ? "tab is-active" : "tab"}
          onClick={() => switchTab("history")}
        >
          Saved
        </button>
      </nav>

      {status === "waking" && (
        <p className="notice">Waking the server up. This takes up to a minute
        on the free plan.</p>
      )}

      {error && <p className="notice is-error">{error}</p>}

      {tab === "create" && (
        <section className="create-page">
          <div className="page-intro">
            <div>
              <p className="eyebrow">Build a study set</p>
              <h2>Turn any source into a test</h2>
            </div>
            <span className="step-pill">01 / CREATE</span>
          </div>
          <div className="create-panel">
          <div className="source-switcher">
            {SOURCES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                className={source === value ? "source-tab is-active" : "source-tab"}
                onClick={() => setSource(value)}
              >
                <span className="source-tab-icon" aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="test-name">Test name</label>
          <input id="test-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional, e.g. Biology - Test 1" />
          {source === "notes" && <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste a page of notes here." rows={10} />}
          {source === "file" && <label className="upload-box"><span>{file ? file.name : "Choose a PDF, TXT, or Markdown file"}</span><input type="file" accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>}
          {source === "url" && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" type="url" />}

          <div className="actions">
            <span className="counter">
              {source === "notes" ? `${notes.trim().length} characters${!sourceReady ? ` — need at least ${MIN_CHARS}` : ""}` : "The source will be read and saved with this test."}
            </span>
            <button
              type="button"
              className="primary"
              onClick={handleGenerate}
              disabled={!sourceReady || status !== "idle"}
            >
              {status === "working" && <span className="spinner" aria-hidden="true" />}
              {status === "working" ? "Generating" : "Generate quiz"}
            </button>
          </div>

          </div>
          {current && (
            <QuizCard
              set={current}
              onSubmit={handleSubmit}
              onRegenerate={handleRegenerate}
              regenerating={status === "working"}
            />
          )}
        </section>
      )}

      {tab === "history" && (
        <section className="saved-page">
          <div className="history-toolbar">
            <div>
              <p className="eyebrow">Your library</p>
              <h2>Saved tests</h2>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort saved tests">
              <option value="newest">Newest</option>
              <option value="score">Highest score</option>
              <option value="name">Name</option>
            </select>
          </div>
          {history.length === 0 ? (
            <EmptyState
              icon={(
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
                  <path d="M4 7.5 12 12l8-4.5M12 12v9" />
                </svg>
              )}
              title="Nothing saved yet"
              subtitle="Generate your first quiz and it'll show up here, ready to retake any time."
              action={(
                <button type="button" className="primary" onClick={() => switchTab("create")}>
                  Create a quiz
                </button>
              )}
            />
          ) : (
            <div className="saved-layout">
              <div className="test-list" role="list">
                {history.map((set) => {
                  const taken = set.score !== null && set.score !== undefined;
                  return (
                    <button
                      key={set.id}
                      type="button"
                      role="listitem"
                      aria-current={selectedId === set.id ? "true" : undefined}
                      className={selectedId === set.id ? "test-row is-selected" : "test-row"}
                      onClick={() => setSelectedId(set.id)}
                    >
                      <span className="test-row-title">{set.name}</span>
                      <span className="test-row-meta">
                        <span className="test-row-source">{set.source_type || "text"}</span>
                        <span className={taken ? "status-pill is-taken" : "status-pill is-pending"}>
                          {taken ? `${set.score}/${set.questions.length}` : "Not taken"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="saved-detail">
                {selectedSet && (
                  <QuizCard
                    key={selectedSet.id}
                    set={selectedSet}
                    onSubmit={handleSubmit}
                    onRegenerate={handleRegenerate}
                    regenerating={status === "working"}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      )}

      </SignedIn>
    </main>
  );
}