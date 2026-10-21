import { describe, expect, it } from "vitest";

import { initialDecision, manualLine } from "../src/pages/InvoiceReceiptPage";
import type { InvoiceLine } from "../src/services/inventoryService";

const line: InvoiceLine = {
  supplier_code: "1",
  description: "PARAFUSO M6",
  unit: "UN",
  quantity: 3,
  unit_value: null,
  total_value: null,
  ncm: null,
};

describe("initialDecision — padrão da conferência por nota fiscal", () => {
  it("sem sugestão confiável e com permissão de criar, o padrão é cadastrar item novo", () => {
    const decision = initialDecision(line, [], true);
    expect(decision.choice).toBe("new");
    expect(decision.newName).toBe("Parafuso m6");
  });

  it("sem permissão de criar, não pré-seleciona nada", () => {
    expect(initialDecision(line, [], false).choice).toBeNull();
  });

  it("sugestão confiável vence o padrão de item novo", () => {
    const decision = initialDecision(line, [{ item_id: "x", score: 0.9, match: "similar" }], true);
    expect(decision.choice).toBe("x");
  });

  it("usa o nome limpo e o número de série lidos da nota, quando vierem", () => {
    const decision = initialDecision(
      { ...line, name: "Furadeira de impacto", serial_number: "SN-12345" },
      [],
      true,
    );
    expect(decision.newName).toBe("Furadeira de impacto");
    expect(decision.newSerial).toBe("SN-12345");
  });

  it("item adicionado à mão entra com a quantidade informada, sem divergência", () => {
    const added = manualLine("  Cabo de aço 6 mm ", 4, "");
    expect(added).toMatchObject({ description: "Cabo de aço 6 mm", unit: "un", quantity: 4, supplier_code: null });
    expect(initialDecision(added, [], true).quantity).toBe("4");
  });
});
