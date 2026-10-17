// Applies the saved or system theme before first paint to prevent a flash of the wrong theme.
// Kept as a file (not inline) so the site's CSP can drop 'unsafe-inline' from script-src.
try {
  const stored = localStorage.getItem('darkMode');
  const dark = stored !== null ? stored === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
