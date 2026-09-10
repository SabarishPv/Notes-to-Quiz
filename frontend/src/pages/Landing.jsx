import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

import LogoMark from "../components/LogoMark";
import { IconArrowRight, IconFolder, IconLayers, IconRefresh, IconShare } from "../components/Icons";
import { useTheme } from "../lib/theme";

const FEATURES = [
  {
    Icon: IconLayers,
    title: "Any source, in seconds",
    body: "Paste notes, drop a PDF, or point at a URL. You get a plain-language summary and a set of questions built only from that material.",
  },
  {
    Icon: IconFolder,
    title: "Folders per subject",
    body: "Keep Biology, History and everything else in their own folders instead of one endless list.",
  },
  {
    Icon: IconRefresh,
    title: "Retake and track",
    body: "Every attempt is scored and kept. See how many times you've taken a quiz and whether your best score is moving.",
  },
  {
    Icon: IconShare,
    title: "Share a link",
    body: "Send a quiz to a classmate. They take it without an account; their attempts are counted separately from yours.",
  },
];

const STEPS = [
  ["Add your material", "Notes, a PDF, or a link — plus how many questions and which types you want."],
  ["Generate", "The model writes a summary and questions you can actually reason about, not word-matching trivia."],
  ["Study & repeat", "Take it, see the answer key with explanations, then retake it until it sticks."],
];

export default function Landing() {
  const [theme, setTheme] = useTheme();

  return (
    <main className="landing">
      <header className="landing-nav">
        <div className="brand">
          <LogoMark size={44} />
          <h1>Notes to quiz</h1>
        </div>
        <div className="landing-nav-actions">
          <label className="theme-control">
            <span>Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Theme">
              <option value="system">System</option>
              <option value="light">Day</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <SignedIn>
            <Link to="/studio" className="primary">Open studio <IconArrowRight width={16} height={16} /></Link>
          </SignedIn>
          <SignedOut>
            <Link to="/studio" className="primary">Get started <IconArrowRight width={16} height={16} /></Link>
          </SignedOut>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Study smarter</p>
        <h2>Turn your notes into quizzes you can actually retake.</h2>
        <p className="hero-sub">
          Drop in a page of notes, a PDF, or a link. Get a summary and a custom quiz —
          pick the number of questions and the question types. Organise everything into
          folders, retake as often as you like, and share a quiz with a link.
        </p>
        <div className="hero-cta">
          <Link to="/studio" className="primary large">Start building <IconArrowRight width={18} height={18} /></Link>
          <span className="hero-note">Free · sign in with email</span>
        </div>
      </section>

      <section className="feature-grid">
        {FEATURES.map(({ Icon, title, body }) => (
          <article key={title} className="feature-card">
            <div className="feature-icon" aria-hidden="true"><Icon width={22} height={22} /></div>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="how">
        <p className="eyebrow">How it works</p>
        <ol className="how-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <span className="how-num">{i + 1}</span>
              <div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className="landing-footer">
        <div className="brand"><LogoMark size={32} /><span>Notes to quiz</span></div>
        <Link to="/studio" className="ghost">Open the studio <IconArrowRight width={15} height={15} /></Link>
      </footer>
    </main>
  );
}
