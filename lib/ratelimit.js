// Best-effort limiter kept in server memory. On serverless hosting each instance has its own counter, so this slows abuse
// but is not a hard guarantee; add a shared store (e.g. Upstash) before heavy traffic.
const hits = new Map();
export function tooMany(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > limit;
}
export const clientIp = (req) => (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
