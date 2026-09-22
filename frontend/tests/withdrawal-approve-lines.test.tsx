import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import WithdrawalDetailPage from "../src/pages/WithdrawalDetailPage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 3, username: "paiol", permission_codes: ["inventory:withdrawal:approve"] },
    hasPermission: (code: string) => code === "inventory:withdrawal:approve",
    hasAnyPermission: () => true,
  }),
}));

const baseLine = {
  item_type: "consumable",
  from_location_id: "loc",
  from_location_name: "Paiol",
  reserved_quantity: 0,
  delivered_quantity: 0,
  returned_quantity: 0,
  written_off_quantity: 0,
  custody_quantity: 0,
  status: "pending",
};

const order: WithdrawalOrder = {
  id: "order-1",
  status: "pending_approval",
  reason: "Campo",
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
    { ...baseLine, id: "l1", item_id: "i1", item_name: "Bateria", quantity: 4 },
    { ...baseLine, id: "l2", item_id: "i2", item_name: "Cabo", quantity: 2 },
  ],
};

describe("aprovação por linha", () => {
  afterEach(() => vi.restoreAllMocks());

  it("envia quantidades por material quando o paiol aprova parcialmente", async () => {
    vi.spyOn(inventoryService, "getWithdrawal").mockResolvedValue(order);
    const approve = vi.spyOn(inventoryService, "approveWithdrawal").mockResolvedValue(order);

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/withdrawals/order-1"]}>
        <Routes>
          <Route path="/app/withdrawals/:id" element={<WithdrawalDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("Aprovar de Bateria"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Aprovar de Cabo"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo/i }), { target: { value: "Saldo parcial." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith("order-1", "Saldo parcial.", [
        { line_id: "l1", quantity: 3 },
        { line_id: "l2", quantity: 0 },
      ]),
    );
  });
});
