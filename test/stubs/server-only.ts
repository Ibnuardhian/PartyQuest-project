// Vitest stand-in for the "server-only" guard, which Next.js resolves internally.
// Lets unit tests import server modules; the real guard still protects client bundles.
export {};
