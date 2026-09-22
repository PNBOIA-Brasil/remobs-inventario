import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("fallbacks estáticos do SPA", () => {
  it("inclui rotas diretas usadas pelo frontend em produção", () => {
    const script = readFileSync(resolve("scripts/create-spa-fallbacks.mjs"), "utf8");

    for (const route of ["app/platforms/new", "app/sensors/new", "app/checklists", "app/checklists/new", "app/locations", "app/locations/new", "app/withdrawals", "app/movements/new"]) {
      expect(script).toContain(`"${route}"`);
    }
  });
});
