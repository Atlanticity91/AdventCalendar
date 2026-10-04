/**
 * Deploy base path, so asset URLs resolve under a subpath on GitHub Pages.
 *
 * Guarded because `import.meta.env` only exists under Vite; the scripts/ checks
 * import these modules in plain Node. Never write a bare absolute path in CSS or
 * fetch calls — `base` is `/AdventCalendar/`, so `/letters/x.json` would 404.
 */
export const BASE = typeof import.meta.env !== 'undefined' ? import.meta.env.BASE_URL : '/'
