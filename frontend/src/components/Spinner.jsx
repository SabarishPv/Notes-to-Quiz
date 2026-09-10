export default function Spinner({ dark = false }) {
  return <span className={dark ? "spinner spinner-dark" : "spinner"} aria-hidden="true" />;
}
