import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import InvoiceReceiptPage from "../src/pages/InvoiceReceiptPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 3, username: "paiol", permission_codes: ["inventory:withdrawal:deliver"] },
    hasPermission: (code: string) => code === "inventory:withdrawal:deliver",
    hasAnyPermission: () => true,
  }),
}));

const bateria = { id: "bat", name: "Bateria 12 V", item_type: "permanent_component", unit: "un", stock_total: 1, patrimony_number: "REM-000001" } as unknown as InventoryItem;
const unit = (id: string) => ({ ...bateria, id, patrimony_number: `REM-00000${id}` }) as InventoryItem;

describe("recebimento por nota fiscal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("permanente vira uma unidade por peça, com foto em cada unidade", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({ items: [bateria], total: 1 });
    vi.spyOn(inventoryService, "listLocations").mockResolvedValue({
      items: [{ id: "loc-a", name: "Paiol A", location_type: "estoque", is_active: true, created_at: "" }],
      total: 1,
    });
    vi.spyOn(inventoryService, "readInvoice").mockResolvedValue({
      invoice_id: "nf-1",
      supplier_name: "Fornecedor",
      supplier_cnpj: "12.345.678/0001-90",
      number: "4521",
      series: "1",
      issue_date: "2026-09-18",
      total_value: 778,
      access_key: null,
      lines: [{ supplier_code: "88103", description: "BATERIA 12V", unit: "UN", quantity: 2, unit_value: 389, total_value: 778, ncm: null }],
      uncertain_fields: [],
      suggestions: [[{ item_id: "bat", score: 0.9, match: "similar" }]],
      already_received: null,
    });
    const register = vi.spyOn(inventoryService, "registerReceipt").mockResolvedValue({ movements: [], total_quantity: 2, items: [unit("2"), unit("3")] });
    const photo = vi.spyOn(inventoryService, "uploadReceiptPhoto").mockResolvedValue({} as never);

    const { container } = renderWithProviders(
      <MemoryRouter>
        <InvoiceReceiptPage />
      </MemoryRouter>,
    );
    const pickFile = (accept: string, name: string) => {
      const input = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')].find((entry) => entry.accept === accept)!;
      fireEvent.change(input, { target: { files: [new File(["x"], name, { type: "image/png" })] } });
    };

    await screen.findByRole("button", { name: "Ler nota fiscal" });
    pickFile("image/jpeg,image/png,image/webp,application/pdf", "nota.png");
    fireEvent.click(screen.getByRole("button", { name: "Ler nota fiscal" }));
    fireEvent.click(await screen.findByRole("button", { name: /Começar conferência/ }));

    expect(await screen.findByText(/cada peça vira uma unidade nova/)).toBeTruthy();
    pickFile("image/jpeg,image/png,image/webp", "foto.png");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar item" }));
    expect(await screen.findByText("2 unidade(s) nova(s)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_id: "nf-1",
          invoice_number: "4521",
          invoice_series: "1",
          supplier_name: "Fornecedor",
          issue_date: "2026-09-18",
          total_value: 778,
          supplier_cnpj: "12.345.678/0001-90",
          lines: [{ item_id: "bat", quantity: 2, supplier_code: "88103" }],
        }),
      ),
    );
    await screen.findByRole("button", { name: "Baixar nota fiscal" });
    expect(photo.mock.calls.map(([id]) => id)).toEqual(["2", "3"]);
    expect(screen.getByText(/2 item\(ns\) ou unidade\(s\) nova\(s\)/)).toBeTruthy();
  });
});
