import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "../src/pages/HomePage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";

const permissions = { current: [] as string[] };

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 8, username: "campo", permission_codes: permissions.current },
    hasPermission: (code: string) => permissions.current.includes(code),
    hasAnyPermission: (...codes: string[]) => codes.some((code) => permissions.current.includes(code)),
  }),
}));

function order(overrides: Partial<WithdrawalOrder>): WithdrawalOrder {
  return {
    id: "order-1",
    status: "delivered",
    reason: "Manutenção",
    requested_by_id: 8,
    requested_by_username: "campo",
    decided_by_username: null,
    decision_reason: null,
    delivered_by_username: null,
    delivery_reason: null,
    created_at: "2026-09-22T12:00:00Z",
    decided_at: null,
    delivered_at: null,
    events: [],
    audit_trail: [],
    lines: [
      {
        id: "line-1",
        item_id: "item-1",
        item_name: "Multímetro",
        item_type: "permanent_component",
        from_location_id: "loc-1",
        from_location_name: "Paiol",
        quantity: 1,
        reserved_quantity: 0,
        delivered_quantity: 1,
        returned_quantity: 0,
        written_off_quantity: 0,
        custody_quantity: 1,
        status: "in_custody",
      },
    ],
    ...overrides,
  };
}

describe("início por perfil", () => {
  afterEach(() => vi.restoreAllMocks());

  it("solicitante vê ações e o que está com ele, sem fila do paiol", async () => {
    permissions.current = ["inventory:withdrawal:request"];
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({ items: [order({})], total: 1 });
    const summary = vi.spyOn(inventoryService, "getDashboardSummary");

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Multímetro")).toBeTruthy();
    expect(screen.getByText("Retirar material")).toBeTruthy();
    expect(screen.getByText("1 material(is) com você")).toBeTruthy();
    expect(screen.queryByText("Precisa de você")).toBeNull();
    expect(summary).not.toHaveBeenCalled();
  });

  it("paiol vê filas sem contar o próprio pedido", async () => {
    permissions.current = ["inventory:withdrawal:approve", "inventory:withdrawal:deliver"];
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({
      items: [
        order({ id: "a", status: "pending_approval", requested_by_id: 3 }),
        order({ id: "b", status: "pending_approval", requested_by_id: 8 }),
        order({ id: "c", status: "approved", requested_by_id: 3 }),
      ],
      total: 3,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Precisa de você")).toBeTruthy();
    const approve = screen.getByText("Aprovar pedidos").closest(".MuiCardContent-root") as HTMLElement;
    expect(approve.textContent).toContain("1");
    expect(screen.queryByText("Retirar material")).toBeNull();
  });
});
