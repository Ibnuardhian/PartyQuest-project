/**
 * Small in-memory sliding-window limiter. Per server process only (each serverless instance has
 * its own window), which is enough to stop a runaway client from burning TTS quota.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Records a hit and returns true when the key is still within its limit. */
  allow(key: string, now = Date.now()) {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000) this.prune(since);
    return true;
  }

  private prune(since: number) {
    for (const [key, times] of this.hits) if (times.every((time) => time <= since)) this.hits.delete(key);
  }
}
