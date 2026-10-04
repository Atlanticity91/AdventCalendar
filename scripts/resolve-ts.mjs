// Lets Node resolve the extensionless relative imports Vite allows
// (`from './date'` -> `./date.ts`), so the real sources can be checked unmodified.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/i.test(specifier)) {
    for (const ext of ['.ts', '.tsx']) {
      try {
        return await next(specifier + ext, context)
      } catch {
        /* try the next extension */
      }
    }
  }
  return next(specifier, context)
}
