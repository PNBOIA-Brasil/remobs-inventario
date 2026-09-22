import { describe, expect, it } from "vitest";

import { getGroupedNavigation, getVisibleNavigation } from "../src/navigation";

describe("navegação por permissão", () => {
  it("oculta módulos sem permissão operacional", () => {
    const items = getVisibleNavigation(["inventory:item:read"]);

    expect(items.map((item) => item.label)).toContain("Itens e saldos");
    expect(items.map((item) => item.label)).not.toContain("Pedidos");
    expect(items.map((item) => item.label)).not.toContain("Checklists");
  });

  it("mostra Pedidos para o paiol mesmo sem permissão de solicitar", () => {
    const items = getVisibleNavigation(["inventory:withdrawal:deliver"]);

    expect(items.map((item) => item.label)).toContain("Pedidos");
  });

  it("agrupa por intenção para permissão coringa", () => {
    const groups = getGroupedNavigation(["*"]);

    expect(groups.map(({ group, items }) => [group, items.map((item) => item.label)])).toEqual([
      ["Operação", ["Início", "Pedidos"]],
      ["Estoque", ["Itens e saldos", "Alertas"]],
      ["Campo", ["Plataformas", "Sensores", "Checklists"]],
      ["Administração", ["Locais", "Sincronização"]],
    ]);
  });

  it("omite grupos sem itens visíveis", () => {
    const groups = getGroupedNavigation([]);

    expect(groups.map(({ group }) => group)).toEqual(["Operação"]);
  });
});
