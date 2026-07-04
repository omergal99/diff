/**
 * Theme and RTL management.
 * Persists preference to localStorage.
 */

const THEME_KEY = 'diffinity-theme';
const DIR_KEY   = 'diffinity-dir';

const THEMES = ['light', 'dark', 'high-contrast'];

/** Apply a theme by name. */
export function setTheme(name) {
  if (!THEMES.includes(name)) name = 'light';
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
}

/** Return the currently active theme name. */
export function getTheme() {
  return localStorage.getItem(THEME_KEY) ?? 'light';
}

/** Cycle through available themes. */
export function cycleTheme() {
  const current = getTheme();
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  setTheme(next);
  return next;
}

/** Set document direction. */
export function setDir(dir) {
  document.documentElement.setAttribute('dir', dir === 'rtl' ? 'rtl' : 'ltr');
  localStorage.setItem(DIR_KEY, dir);
}

/** Toggle between RTL and LTR. */
export function toggleDir() {
  const current = localStorage.getItem(DIR_KEY) ?? 'ltr';
  const next = current === 'ltr' ? 'rtl' : 'ltr';
  setDir(next);
  return next;
}

/** Restore persisted preferences on startup. */
export function restorePreferences() {
  setTheme(getTheme());
  setDir(localStorage.getItem(DIR_KEY) ?? 'ltr');
}
