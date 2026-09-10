import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SignIn, SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";

import EmptyState from "../components/EmptyState";
import FolderRail from "../components/FolderRail";
import LogoMark from "../components/LogoMark";
import QuizCard from "../components/QuizCard";
import SourceForm from "../components/SourceForm";
import { IconLayers, IconPlus } from "../components/Icons";
import { useApi } from "../lib/api";
import { useTheme } from "../lib/theme";

function Masthead() {
  const { user } = useUser();
  const [theme, setTheme] = useTheme();
  return (
    <header className="masthead">
      <Link to="/" className="brand brand-link">
        <LogoMark />
        <div>
          <h1>Notes to quiz</h1>
          <p>Turn notes, PDFs and pages into quizzes you can retake.</p>
        </div>
      </Link>
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
            <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Appearance">
              <option value="system">System</option>
              <option value="light">Day</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <UserButton />
        </div>
      </SignedIn>
    </header>
  );
}

function StudioInner() {
  const api = useApi();

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("create");
  const [folders, setFolders] = useState([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState("all");

  const [quizzes, setQuizzes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState("newest");

  const [current, setCurrent] = useState(null);   // freshly generated quiz on the Create tab
  const [status, setStatus] = useState("idle");   // idle | working
  const [error, setError] = useState(null);

  useEffect(() => {
    api.wakeServer().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFolders = useCallback(async () => {
    try {
      const data = await api.listFolders();
      setFolders(data.items);
      setUnfiledCount(data.unfiled_count);
      setTotalCount(data.total_count);
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshQuizzes = useCallback(async () => {
    try {
      const data = await api.listQuizzes({ folder: String(selectedFolder), sort });
      setQuizzes(data.items);
      setSelectedId((id) => (data.items.some((q) => q.id === id) ? id : data.items[0]?.id ?? null));
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, sort]);

  useEffect(() => {
    if (ready) refreshFolders();
  }, [ready, refreshFolders]);

  useEffect(() => {
    if (ready) refreshQuizzes();
  }, [ready, refreshQuizzes]);

  const selectedFolderObj =
    typeof selectedFolder === "number" || /^\d+$/.test(String(selectedFolder))
      ? folders.find((f) => String(f.id) === String(selectedFolder))
      : null;
  const targetFolderId = selectedFolderObj ? selectedFolderObj.id : null;

  function switchTab(next) {
    setError(null);
    setTab(next);
  }

  async function handleGenerate(form) {
    setStatus("working");
    setError(null);
    setCurrent(null);
    try {
      const payload = {
        name: form.name,
        folderId: targetFolderId,
        questionCount: form.questionCount,
        questionTypes: form.questionTypes,
      };
      const quiz = form.source === "notes"
        ? await api.generateFromText({ ...payload, text: form.notes })
        : await api.generateFromUpload({
            ...payload,
            file: form.source === "file" ? form.file : null,
            url: form.source === "url" ? form.url : null,
          });
      setCurrent(quiz);
      form.reset();
      refreshFolders();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  function patchInPlace(updated) {
    setCurrent((c) => (c?.id === updated.id ? updated : c));
    setQuizzes((list) => list.map((q) => (q.id === updated.id ? updated : q)));
  }

  async function handleSubmitAttempt(id, answers) {
    const updated = await api.submitAttempt(id, answers);
    patchInPlace(updated);
    refreshFolders();
    return updated;
  }

  async function handleRegenerate(set) {
    setStatus("working");
    setError(null);
    try {
      const updated = await api.regenerate(set.id);
      patchInPlace(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleShare(id) {
    await api.createShareLink(id);
    patchInPlace(await api.getQuiz(id));
  }

  async function handleRevokeShare(id) {
    await api.revokeShareLink(id);
    const fresh = await api.getQuiz(id);
    patchInPlace(fresh);
  }

  async function handleMove(id, folderId) {
    try {
      await api.patchQuiz(id, folderId == null ? { clear_folder: true } : { folder_id: folderId });
      patchInPlace(await api.getQuiz(id));
      refreshFolders();
      refreshQuizzes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateFolder(name) {
    try {
      await api.createFolder(name);
      refreshFolders();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteFolder(folder) {
    const msg = folder.quiz_count > 0
      ? `Delete "${folder.name}" and its ${folder.quiz_count} quiz${folder.quiz_count === 1 ? "" : "zes"}? This cannot be undone.`
      : `Delete the folder "${folder.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await api.deleteFolder(folder.id);
      if (String(selectedFolder) === String(folder.id)) setSelectedFolder("all");
      refreshFolders();
      refreshQuizzes();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteQuiz(id) {
    if (!window.confirm("Delete this quiz and all its attempts?")) return;
    try {
      await api.deleteQuiz(id);
      setCurrent((c) => (c?.id === id ? null : c));
      refreshFolders();
      refreshQuizzes();
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedId) || null,
    [quizzes, selectedId],
  );

  const folderLabel =
    selectedFolder === "all" ? "All quizzes"
    : selectedFolder === "unfiled" ? "Unfiled"
    : selectedFolderObj?.name || "Folder";

  return (
    <main className="app">
      <Masthead />

      <div className="studio-layout">
        <FolderRail
          folders={folders}
          unfiledCount={unfiledCount}
          totalCount={totalCount}
          selected={selectedFolder}
          onSelect={(key) => {
            setSelectedFolder(key === "all" || key === "unfiled" ? key : Number(key));
            setError(null);
          }}
          onCreate={handleCreateFolder}
          onDelete={handleDeleteFolder}
          onNewQuiz={() => switchTab("create")}
          quizzes={quizzes}
          selectedQuizId={selectedId}
          onSelectQuiz={(id) => {
            setSelectedId(id);
            setTab("library");
            setError(null);
          }}
          busy={status === "working"}
        />

        <div className="studio-main">
          <nav className="tabs">
            <button className={tab === "create" ? "tab is-active" : "tab"} onClick={() => switchTab("create")}>
              Create
            </button>
            <button className={tab === "library" ? "tab is-active" : "tab"} onClick={() => switchTab("library")}>
              Library
            </button>
          </nav>

          {!ready && <p className="notice">Waking the server up. This can take up to a minute on the free plan.</p>}
          {error && <p className="notice is-error">{error}</p>}

          {tab === "create" && (
            <section>
              <div className="page-intro">
                <div>
                  <p className="eyebrow">New quiz</p>
                  <h2>Saving to {folderLabel}</h2>
                </div>
              </div>

              <SourceForm
                busy={status === "working"}
                folderName={selectedFolderObj?.name}
                onGenerate={handleGenerate}
              />

              {current && (
                <QuizCard
                  set={current}
                  onSubmit={handleSubmitAttempt}
                  onRegenerate={handleRegenerate}
                  onShare={handleShare}
                  onRevokeShare={handleRevokeShare}
                  onDelete={(s) => handleDeleteQuiz(s.id)}
                  onMove={handleMove}
                  folders={folders}
                  regenerating={status === "working"}
                />
              )}
            </section>
          )}

          {tab === "library" && (
            <section className="saved-page">
              <div className="history-toolbar">
                <div>
                  <p className="eyebrow">{folderLabel}</p>
                  <h2>{selectedQuiz ? selectedQuiz.name : "Saved quizzes"}</h2>
                </div>
                <span className="toolbar-hint">{quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}</span>
              </div>

              {quizzes.length === 0 ? (
                <EmptyState
                  icon={<IconLayers width={30} height={30} />}
                  title="No quizzes here yet"
                  subtitle={
                    selectedFolder === "all"
                      ? "Generate your first quiz on the Create tab."
                      : `Nothing in ${folderLabel} yet — switch to Create to add one.`
                  }
                  action={
                    <button type="button" className="primary" onClick={() => switchTab("create")}>
                      <IconPlus width={16} height={16} /> New quiz
                    </button>
                  }
                />
              ) : selectedQuiz ? (
                <QuizCard
                  key={selectedQuiz.id}
                  set={selectedQuiz}
                  onSubmit={handleSubmitAttempt}
                  onRegenerate={handleRegenerate}
                  onShare={handleShare}
                  onRevokeShare={handleRevokeShare}
                  onDelete={(s) => handleDeleteQuiz(s.id)}
                  onMove={handleMove}
                  folders={folders}
                  sortMenu={{
                    value: sort,
                    onChange: setSort,
                    options: [
                      { value: "newest", label: "Newest" },
                      { value: "score", label: "Best score" },
                      { value: "name", label: "Name" },
                    ],
                  }}
                  regenerating={status === "working"}
                />
              ) : (
                <p className="notice">Pick a quiz from the sidebar.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export default function Studio() {
  return (
    <>
      <SignedIn>
        <StudioInner />
      </SignedIn>
      <SignedOut>
        <main className="app">
          <Masthead />
          <section className="signin">
            <p className="signin-lede">Sign in to build and save quizzes.</p>
            <SignIn routing="hash" forceRedirectUrl="/studio" />
          </section>
        </main>
      </SignedOut>
    </>
  );
}
