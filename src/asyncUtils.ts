// src/asyncUtils.ts — small async helpers shared across screens.

/**
 * Race a promise against a timeout. Resolves to the promise's value if it
 * settles within `ms`, otherwise resolves to `null`. Rejections also resolve
 * to `null` so callers can treat "failed" and "too slow" the same way.
 *
 * `label` is accepted for call-site readability / future logging.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, _label?: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result as T | null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
