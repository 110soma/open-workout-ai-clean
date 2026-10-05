export interface PerformanceMetric {
  name: string;
  durationMs: number;
  at: string;
}

const metrics: PerformanceMetric[] = [];
let metricsSnapshot: PerformanceMetric[] = [];
const listeners = new Set<() => void>();

export function recordMetric(name: string, durationMs: number): PerformanceMetric {
  const metric = { name, durationMs: Number(durationMs.toFixed(2)), at: new Date().toISOString() };
  metrics.push(metric);
  if (metrics.length > 100) metrics.shift();
  metricsSnapshot = [...metrics];
  console.info(`[Performance] ${name}: ${metric.durationMs} ms`);
  listeners.forEach((listener) => listener());
  return metric;
}

export async function measureAsync<T>(name: string, action: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await action();
  } finally {
    recordMetric(name, performance.now() - started);
  }
}

export function getMetrics(): PerformanceMetric[] {
  return metricsSnapshot;
}

export function subscribeMetrics(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

declare global {
  interface Window {
    __WORKOUT_PERFORMANCE__?: {
      getMetrics: typeof getMetrics;
    };
    __WORKOUT_BOOT_AT__?: number;
  }
}

if (typeof window !== "undefined") {
  window.__WORKOUT_PERFORMANCE__ = { getMetrics };
}
