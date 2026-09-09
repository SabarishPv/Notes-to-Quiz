import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignIn, UserButton, useUser } from "@clerk/clerk-react";

import QuizCard from "./QuizCard";
import { useApi } from "./api";

const MIN_CHARS = 100;

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
        <div>
          <h1>Notes to quiz</h1>
          <p>Paste your notes. Get a summary and five questions to test yourself.</p>
        </div>
        <SignedIn>
          <div className="header-tools">
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
          <p className="notice">Sign in to generate and save quizzes.</p>
          <SignIn routing="hash" />
        </section>
      </SignedOut>

      <SignedIn>

      {user && <p className="greeting">Signed in as {user.primaryEmailAddress?.emailAddress}</p>}

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
            {[["notes", "Paste notes"], ["file", "Upload PDF or text"], ["url", "Import URL"]].map(([value, label]) => (
              <button key={value} className={source === value ? "tab is-active" : "tab"} onClick={() => setSource(value)}>{label}</button>
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
              className="primary"
              onClick={handleGenerate}
              disabled={!sourceReady || status !== "idle"}
            >
              {status === "working" ? "Generating" : "Generate quiz"}
            </button>
          </div>

          </div>
          {current && <QuizCard set={current} onSubmit={handleSubmit} onRegenerate={handleRegenerate} />}
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
            <p className="notice">Nothing saved yet. Generate a quiz first.</p>
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