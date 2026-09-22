import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import MovementsPage from "../src/pages/MovementsPage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 3, username: "paiol", permission_codes: ["inventory:withdrawal:approve", "inventory:withdrawal:deliver"] },
    hasPermission: (permission: string) => ["inventory:withdrawal:approve", "inventory:withdrawal:deliver"].includes(permission),
    hasAnyPermission: (...permissions: string[]) =>
      permissions.some((permission) => ["inventory:withdrawal:approve", "inventory:withdrawal:deliver"].includes(permission)),
  }),
}));

const order: WithdrawalOrder = {
  id: "order-1",
  status: "pending_approval",
  reason: "Manutenção da boia.",
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
      item_name: "Cabo",
      item_type: "consumable",
      from_location_id: "loc-1",
      from_location_name: "Paiol",
      quantity: 2,
      reserved_quantity: 2,
      delivered_quantity: 0,
      returned_quantity: 0,
      written_off_quantity: 0,
      custody_quantity: 0,
      status: "pending",
    },
  ],
};

describe("fila do paiol", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra o material e as ações de aprovar e recusar", async () => {
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({ items: [order], total: 1 });
    vi.spyOn(inventoryService, "listMovements").mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(
      <MemoryRouter>
        <MovementsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/2 × Cabo — Paiol/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();

    const approve = vi.spyOn(inventoryService, "approveWithdrawal").mockResolvedValue(order);
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByRole("textbox", { name: /motivo/i }), { target: { value: "Retirada autorizada pelo paiol." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("order-1", "Retirada autorizada pelo paiol."));
  });
});
