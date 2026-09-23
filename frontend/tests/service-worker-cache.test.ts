import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("service worker do PWA", () => {
  it("força troca de cache e ativação imediata após novo deploy", () => {
    const serviceWorker = readFileSync(resolve("public/sw.js"), "utf8");

    expect(serviceWorker).toContain('const CACHE_NAME = "remobs-inventario-v25"');
    expect(serviceWorker).toContain("self.skipWaiting()");
    expect(serviceWorker).toContain("self.clients.claim()");
  });
});
