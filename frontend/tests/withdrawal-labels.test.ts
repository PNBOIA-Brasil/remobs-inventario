import { describe, expect, it } from "vitest";

import type { WithdrawalOrder } from "../src/types";
import { isOverdue, purposeLabel } from "../src/withdrawalLabels";

const loan = {
  purpose: "emprestimo",
  due_date: "2026-09-20",
  platform_name: null,
  status: "delivered",
  lines: [{ custody_quantity: 1 }],
} as unknown as WithdrawalOrder;

describe("rótulos de finalidade", () => {
  it("descreve cada finalidade", () => {
    expect(purposeLabel(loan)).toBe("Empréstimo até 20/09/2026");
    expect(purposeLabel({ purpose: "plataforma", due_date: null, platform_name: "Boia 01" })).toBe("Plataforma Boia 01");
    expect(purposeLabel({ purpose: "consumo", due_date: null, platform_name: null })).toBe("Consumo");
  });

  it("marca vencido só com posse e prazo anterior a hoje", () => {
    const today = new Date(2026, 8, 22);
    expect(isOverdue(loan, today)).toBe(true);
    expect(isOverdue({ ...loan, due_date: "2026-09-22" }, today)).toBe(false);
    expect(isOverdue({ ...loan, lines: [{ custody_quantity: 0 }] } as unknown as WithdrawalOrder, today)).toBe(false);
    expect(isOverdue({ ...loan, status: "closed" }, today)).toBe(false);
  });
});
