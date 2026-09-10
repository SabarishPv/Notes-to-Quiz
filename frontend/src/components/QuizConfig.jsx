export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 15;

const TYPE_OPTIONS = [
  { value: "mcq", label: "Multiple choice", hint: "Four options, one right" },
  { value: "true_false", label: "True / False", hint: "Two options" },
];

export default function QuizConfig({ count, types, onCountChange, onTypesChange }) {
  function toggleType(value) {
    const next = types.includes(value)
      ? types.filter((t) => t !== value)
      : [...types, value];
    if (next.length === 0) return; // keep at least one selected
    onTypesChange(next);
  }

  return (
    <div className="quiz-config">
      <div className="config-row">
        <div className="config-label">
          <span>Questions</span>
          <strong>{count}</strong>
        </div>
        <input
          type="range"
          min={MIN_QUESTIONS}
          max={MAX_QUESTIONS}
          value={count}
          onChange={(e) => onCountChange(Number(e.target.value))}
          aria-label="Number of questions"
        />
      </div>

      <div className="config-row">
        <div className="config-label"><span>Question types</span></div>
        <div className="type-options">
          {TYPE_OPTIONS.map(({ value, label, hint }) => {
            const active = types.includes(value);
            return (
              <button
                key={value}
                type="button"
                className={active ? "type-chip is-active" : "type-chip"}
                aria-pressed={active}
                onClick={() => toggleType(value)}
              >
                <span className="type-chip-box" aria-hidden="true" />
                <span className="type-chip-text">
                  {label}
                  <small>{hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
