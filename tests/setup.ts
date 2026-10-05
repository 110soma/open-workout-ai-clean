import "fake-indexeddb/auto";

if (!globalThis.performance) {
  Object.defineProperty(globalThis, "performance", {
    value: { now: () => Date.now() }
  });
}
