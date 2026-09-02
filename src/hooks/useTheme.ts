import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "stash_theme";

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

/** Read the stored choice. Anything unrecognised falls back to following the OS. */
export function storedTheme(): ThemeChoice {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/** Put the resolved mode on <html>, which is what the .dark variant keys off. */
function apply(choice: ThemeChoice): void {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Applied before React mounts (see main.tsx) so the first paint is already in
 * the right mode. Without this the page flashes dark — index.html ships
 * class="dark" so a no-JS visitor still gets a styled page rather than
 * unstyled-light — and then corrects itself a frame later.
 */
export function initTheme(): void {
  apply(storedTheme());
}

/**
 * Theme state. Three choices, not a binary: "system" is the default and a real
 * option, so someone whose OS switches at dusk gets that for free.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(() => storedTheme());

  // Follow the OS while the choice is "system". The listener is only live in
  // that mode, so an explicit light/dark pick is never overridden.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const choose = useCallback((next: ThemeChoice) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }, []);

  return { theme, setTheme: choose };
}
