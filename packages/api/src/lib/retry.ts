export type RetryOptions = {
  attempts?: number;
  delayMs?: number;
  backoff?: number;
  onRetry?: (error: unknown, attempt: number) => void;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { attempts = 3, delayMs = 1000, backoff = 2, onRetry } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        onRetry?.(err, attempt);
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(backoff, attempt - 1)));
      }
    }
  }
  throw lastError;
}
