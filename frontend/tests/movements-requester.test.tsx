import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import MovementsPage from "../src/pages/MovementsPage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 8, username: "campo", permission_codes: ["inventory:withdrawal:request"] },
    hasPermission: (permission: string) => permission === "inventory:withdrawal:request",
    hasAnyPermission: (...permissions: string[]) => permissions.includes("inventory:withdrawal:request"),
  }),
}));

const order: WithdrawalOrder = {
  id: "order-1",
  status: "pending_approval",
  reason: "Manutenção da boia.",
  purpose: "consumo",
  due_date: null,
  platform_id: null,
  platform_name: null,
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

describe("fila do solicitante", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não oferece aprovar, recusar nem entregar o próprio pedido", async () => {
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({ items: [order], total: 1 });
    vi.spyOn(inventoryService, "listMovements").mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(
      <MemoryRouter>
        <MovementsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Solicitado por campo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /solicitar retirada/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
    expect(screen.getByText(/Aguardando outro aprovador/)).toBeTruthy();
  });
});
