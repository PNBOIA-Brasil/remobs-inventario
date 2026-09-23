import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import WithdrawalDetailPage from "../src/pages/WithdrawalDetailPage";
import { inventoryService } from "../src/services/inventoryService";
import type { WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 8, username: "campo", permission_codes: ["inventory:withdrawal:request"] },
    hasPermission: () => false,
    hasAnyPermission: () => false,
  }),
}));

function line(partial: Partial<WithdrawalOrder["lines"][number]>): WithdrawalOrder["lines"][number] {
  return {
    id: "line",
    item_id: "item",
    item_name: "Material",
    item_type: "consumable",
    from_location_id: "loc",
    from_location_name: "Paiol",
    quantity: 1,
    reserved_quantity: 0,
    delivered_quantity: 1,
    returned_quantity: 0,
    written_off_quantity: 0,
    custody_quantity: 1,
    status: "in_custody",
    ...partial,
  };
}

const order: WithdrawalOrder = {
  id: "order-1",
  status: "delivered",
  reason: "Manutenção da boia.",
  purpose: "consumo",
  due_date: null,
  platform_id: null,
  platform_name: null,
  requested_by_id: 8,
  requested_by_username: "campo",
  decided_by_username: "paiol",
  decision_reason: "Autorizado.",
  delivered_by_username: "paiol",
  delivery_reason: "Entregue.",
  created_at: "2026-09-22T12:00:00Z",
  decided_at: "2026-09-22T13:00:00Z",
  delivered_at: "2026-09-22T14:00:00Z",
  lines: [
    line({ id: "line-cabo", item_id: "cabo", item_name: "Cabo", item_type: "consumable" }),
    line({ id: "line-adcp", item_id: "adcp", item_name: "ADCP", item_type: "permanent_component" }),
  ],
  events: [],
  audit_trail: [
    {
      id: "audit-1",
      occurred_at: "2026-09-22T12:00:00Z",
      actor_username: "campo",
      actor_roles: ["operacao"],
      action: "withdrawal_requested",
      reason: "Manutenção da boia.",
    },
    {
      id: "audit-2",
      occurred_at: "2026-09-22T14:00:00Z",
      actor_username: "paiol",
      actor_roles: ["paiol"],
      action: "withdrawal_delivered",
      reason: "Entregue.",
    },
  ],
};

describe("detalhe da retirada para o solicitante", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("oferece baixa só para consumo e mostra o histórico", async () => {
    vi.spyOn(inventoryService, "getWithdrawal").mockResolvedValue(order);

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/withdrawals/order-1"]}>
        <Routes>
          <Route path="/app/withdrawals/:id" element={<WithdrawalDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Retirada solicitada/)).toBeTruthy();
    expect(screen.getByText(/Material entregue/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Devolver" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Baixar" })).toHaveLength(1);
    expect(screen.queryByText("QR Code da retirada")).toBeNull();
  });

  it("mostra o QR Code e o código enquanto o pedido aguarda entrega", async () => {
    vi.spyOn(inventoryService, "getWithdrawal").mockResolvedValue({
      ...order,
      id: "8f3a9c2e-1111-4222-8333-444455556666",
      status: "pending_approval",
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/withdrawals/x"]}>
        <Routes>
          <Route path="/app/withdrawals/:id" element={<WithdrawalDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("QR Code da retirada")).toBeTruthy();
    expect(screen.getByRole("img", { name: "QR Code da retirada RET-8F3A9C2E" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tela cheia" })).toBeTruthy();
  });

  it("gera QR Code próprio para a devolução pendente", async () => {
    vi.spyOn(inventoryService, "getWithdrawal").mockResolvedValue({
      ...order,
      events: [
        {
          id: "5d4c3b2a-1111-4222-8333-444455556666",
          line_id: "line-adcp",
          item_id: "adcp",
          item_name: "ADCP",
          event_type: "devolucao",
          quantity: 1,
          status: "pending",
          reason: "Fim da campanha.",
          requested_by_id: 8,
          requested_by_username: "campo",
          decided_by_username: null,
          decision_reason: null,
          created_at: "2026-09-23T12:00:00Z",
          decided_at: null,
        },
      ],
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/withdrawals/order-1"]}>
        <Routes>
          <Route path="/app/withdrawals/:id" element={<WithdrawalDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("img", { name: "QR Code da devolução DEV-5D4C3B2A" })).toBeTruthy();
    expect(screen.queryByText("QR Code da retirada")).toBeNull();
  });
});
