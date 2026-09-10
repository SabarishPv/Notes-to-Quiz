import { useEffect, useState } from "react";

const KEY = "notes-to-quiz-theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(KEY) || "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode / storage disabled — fine */
    }
  }, [theme]);

  return [theme, setTheme];
}
