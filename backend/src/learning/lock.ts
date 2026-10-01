// backend/src/learning/lock.ts
/**
 * Process-local async mutex for file-backed state writes.
 * Not distributed; enough to avoid concurrent JSON corruption in one Deno process.
 */

let chain: Promise<void> = Promise.resolve();

export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
