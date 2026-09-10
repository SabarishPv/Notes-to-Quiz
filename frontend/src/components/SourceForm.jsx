import { useRef, useState } from "react";

import { IconLink, IconNotes, IconUpload } from "./Icons";
import QuizConfig from "./QuizConfig";
import Spinner from "./Spinner";

const MIN_CHARS = 100;

const SOURCES = [
  { value: "notes", label: "Paste notes", hint: "Type or paste text", Icon: IconNotes },
  { value: "file", label: "Upload file", hint: "PDF, TXT, or Markdown", Icon: IconUpload },
  { value: "url", label: "Import URL", hint: "Any web page", Icon: IconLink },
];

const ACCEPT = ".pdf,.txt,.md,.markdown,text/plain,application/pdf";

export default function SourceForm({ busy, folderName, onGenerate }) {
  const [source, setSource] = useState("notes");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState(["mcq"]);
  const fileInput = useRef(null);

  const ready =
    source === "notes" ? notes.trim().length >= MIN_CHARS
    : source === "file" ? Boolean(file)
    : url.trim().length > 0;

  function submit() {
    onGenerate({
      source,
      notes,
      url: url.trim(),
      file,
      name: name.trim(),
      questionCount: count,
      questionTypes: types,
      reset: () => {
        setNotes("");
        setUrl("");
        setFile(null);
        setName("");
      },
    });
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div className="source-card">
      <p className="source-card-title">Choose a source</p>

      <div className="source-picker">
        {SOURCES.map(({ value, label, hint, Icon }) => (
          <button
            key={value}
            type="button"
            className={source === value ? "source-option is-active" : "source-option"}
            aria-pressed={source === value}
            onClick={() => setSource(value)}
          >
            <span className="source-option-icon" aria-hidden="true"><Icon width={22} height={22} /></span>
            <span className="source-option-label">{label}</span>
            <span className="source-option-hint">{hint}</span>
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="test-name">Quiz name</label>
      <input
        id="test-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={folderName ? `Optional, e.g. ${folderName} — Test 1` : "Optional, e.g. Biology — Test 1"}
      />

      {source === "notes" && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste a page of notes here."
          rows={9}
        />
      )}

      {source === "file" && (
        <div
          className={dragging ? "dropzone is-dragging" : "dropzone"}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        >
          <span className="dropzone-icon" aria-hidden="true"><IconUpload width={30} height={30} /></span>
          {file ? (
            <>
              <strong className="dropzone-title">{file.name}</strong>
              <span className="dropzone-hint">Click to choose a different file</span>
            </>
          ) : (
            <>
              <strong className="dropzone-title">Drag &amp; drop, or choose a file</strong>
              <span className="dropzone-hint">PDF, TXT, or Markdown</span>
            </>
          )}
          <span className="primary small">Choose file</span>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      )}

      {source === "url" && (
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" type="url" />
      )}

      <QuizConfig count={count} types={types} onCountChange={setCount} onTypesChange={setTypes} />

      <div className="actions">
        <span className="counter">
          {source === "notes"
            ? `${notes.trim().length} characters${!ready ? ` — need at least ${MIN_CHARS}` : ""}`
            : "The source is read and saved with this quiz."}
        </span>
        <button type="button" className="primary" onClick={submit} disabled={!ready || busy}>
          {busy && <Spinner />}
          {busy ? "Generating…" : "Generate quiz"}
        </button>
      </div>
    </div>
  );
}
