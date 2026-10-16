import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReceiptPage from "../src/pages/ReceiptPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 3, username: "paiol", permission_codes: ["inventory:withdrawal:deliver", "inventory:item:create"] },
    hasPermission: (code: string) => ["inventory:withdrawal:deliver", "inventory:item:create"].includes(code),
    hasAnyPermission: () => true,
  }),
}));

const created = { id: "novo", name: "Fusível 5 A", patrimony_number: null } as unknown as InventoryItem;

describe("entrada de material", () => {
  afterEach(() => vi.restoreAllMocks());

  it("cadastra material novo no fluxo e envia a entrada", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(inventoryService, "listLocations").mockResolvedValue({
      items: [{ id: "loc-a", name: "Paiol A", location_type: "estoque", is_active: true, created_at: "" }],
      total: 1,
    });
    const createItem = vi.spyOn(inventoryService, "createItem").mockResolvedValue(created);
    const register = vi.spyOn(inventoryService, "registerReceipt").mockResolvedValue({ movements: [], total_quantity: 10, items: [] });

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/receipts/new"]}>
        <Routes>
          <Route path="/app/receipts/new" element={<ReceiptPage />} />
          <Route path="/app/inventory" element={<div>Estoque</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /cadastrar agora/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Nome do material/), { target: { value: "Fusível 5 A" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar e incluir" }));
    await waitFor(() => expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ name: "Fusível 5 A", location_name: "Paiol A", initial_quantity: 0 })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.change(screen.getByLabelText(/Nota fiscal/), { target: { value: "NF 1" } });
    fireEvent.change(screen.getByLabelText(/Quantidade 1/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        origin: "compra",
        location_id: "loc-a",
        document: "NF 1",
        lines: [{ item_id: "novo", quantity: 10 }],
      }),
    );
    expect(await screen.findByText("Estoque")).toBeTruthy();
  });
});
