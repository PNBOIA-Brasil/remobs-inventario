import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import MovementRequestPage from "../src/pages/MovementRequestPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem, InventoryLocation } from "../src/types";
import { renderWithProviders } from "./test-utils";

const locations: InventoryLocation[] = [
  { id: "loc-paiol", name: "Paiol", location_type: "estoque", is_active: true, created_at: "2026-01-01T00:00:00Z" },
];

function item(id: string, name: string): InventoryItem {
  return {
    id,
    item_type: "consumable",
    name,
    brand: null,
    model: null,
    serial_number: null,
    patrimony_number: null,
    invoice_number: null,
    description: null,
    condition_status: "operacional",
    category_name: "Geral",
    current_location_id: "loc-paiol",
    current_location_name: "Paiol",
    unit: "un",
    minimum_stock_national: 0,
    ideal_stock: 1,
    row_version: 1,
    stock_total: 4,
    balances: [{ id: `bal-${id}`, location_id: "loc-paiol", location_name: "Paiol", quantity: 4, reserved_quantity: 0 }],
  };
}

describe("solicitação de retirada com vários materiais", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("envia um pedido com dois materiais", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({
      items: [item("item-cabo", "Cabo"), item("item-bateria", "Bateria")],
      total: 2,
    });
    vi.spyOn(inventoryService, "listLocations").mockResolvedValue({ items: locations, total: 1 });
    const request = vi.spyOn(inventoryService, "requestWithdrawal").mockResolvedValue({
      id: "order-1",
      status: "pending_approval",
      reason: "Uso em operação de campo.",
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
      lines: [],
      events: [],
      audit_trail: [],
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/movements/new"]}>
        <Routes>
          <Route path="/app/movements/new" element={<MovementRequestPage />} />
          <Route path="/app/movements" element={<div>Fila</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("combobox", { name: /^Origem/i });
    fireEvent.click(screen.getByRole("button", { name: /adicionar material/i }));
    fireEvent.click(screen.getByRole("button", { name: /enviar solicitação/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const payload = request.mock.calls[0][0];
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines.map((line) => line.item_id).sort()).toEqual(["item-bateria", "item-cabo"]);
    expect(payload.lines.every((line) => line.from_location_id === "loc-paiol" && line.quantity === 1)).toBe(true);
  });
  it("exige data de devolução no empréstimo e a envia no pedido", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({ items: [item("item-cabo", "Cabo")], total: 1 });
    vi.spyOn(inventoryService, "listLocations").mockResolvedValue({ items: locations, total: 1 });
    const request = vi.spyOn(inventoryService, "requestWithdrawal").mockResolvedValue({} as never);

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/movements/new"]}>
        <Routes>
          <Route path="/app/movements/new" element={<MovementRequestPage />} />
          <Route path="/app/movements" element={<div>Fila</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("combobox", { name: /^Origem/i });
    fireEvent.click(screen.getByRole("button", { name: "Empréstimo" }));
    expect(screen.getByText("Informe a data de devolução do empréstimo.")).toBeTruthy();
    expect((screen.getByRole("button", { name: /enviar solicitação/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Devolver até/), { target: { value: "2999-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar solicitação/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0][0]).toMatchObject({ purpose: "emprestimo", due_date: "2999-12-31" });
  });
});
