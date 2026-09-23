import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import MovementsPage from "../src/pages/MovementsPage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

const codes = ["inventory:item:read", "inventory:movement:approve", "inventory:withdrawal:request"];

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 24, username: "gestor", permission_codes: codes },
    hasPermission: (code: string) => codes.includes(code),
    hasAnyPermission: (...wanted: string[]) => wanted.some((code) => codes.includes(code)),
  }),
}));

const order = {
  id: "order-1",
  status: "pending_approval",
  reason: "Campo",
  purpose: "consumo",
  due_date: null,
  platform_id: null,
  platform_name: null,
  requested_by_id: 8,
  requested_by_username: "campo",
  events: [],
  audit_trail: [],
  lines: [{ id: "l1", item_name: "Cabo", from_location_name: "Paiol", quantity: 1, status: "pending", custody_quantity: 0 }],
} as unknown as WithdrawalOrder;

describe("admin do inventário", () => {
  afterEach(() => vi.restoreAllMocks());

  it("vê a fila de aprovação e pode aprovar, sem entregar", async () => {
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({ items: [order], total: 1 });
    vi.spyOn(inventoryService, "listMovements").mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(
      <MemoryRouter>
        <MovementsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
  });
});
