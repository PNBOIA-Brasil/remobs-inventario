import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReceivedInvoicesPage from "../src/pages/ReceivedInvoicesPage";
import { inventoryService, type ReceivedInvoice } from "../src/services/inventoryService";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({ hasAnyPermission: () => false, hasPermission: () => false }),
}));

const invoice = (id: string, number: string, supplier: string, cnpj: string): ReceivedInvoice => ({
  id,
  number,
  series: "1",
  supplier_name: supplier,
  supplier_cnpj: cnpj,
  issue_date: "2026-09-18",
  total_value: 3412.4,
  access_key: null,
  origin: "compra",
  location_name: "Paiol A",
  notes: "Compra. Divergências: Manilha: 10 de 12.",
  received_by_username: "paiol",
  received_at: "2026-09-23T15:00:00Z",
  lines: 3,
  units: 7,
  files: 1,
});

describe("notas fiscais recebidas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("filtra, mostra os itens da nota e baixa o arquivo", async () => {
    vi.spyOn(inventoryService, "listReceivedInvoices").mockResolvedValue({
      items: [invoice("a", "004.521", "Náutica Sul", "12.345.678/0001-90"), invoice("b", "000.777", "Elétrica Norte", "98.765.432/0001-10")],
      total: 2,
    });
    const detail = vi.spyOn(inventoryService, "getReceivedInvoice").mockResolvedValue({
      ...invoice("a", "004.521", "Náutica Sul", "12.345.678/0001-90"),
      received_items: [{ item_id: "i1", name: "Bateria 12 V", patrimony_number: "REM-000900", item_type: "permanent_component", unit: "un", quantity: 1 }],
    });
    const download = vi.spyOn(inventoryService, "downloadInvoice").mockResolvedValue(1);

    renderWithProviders(
      <MemoryRouter>
        <ReceivedInvoicesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/NF 004\.521/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Buscar por número/), { target: { value: "12345678" } });
    expect(screen.getByText("1 de 2 nota(s)")).toBeTruthy();
    expect(screen.queryByText(/NF 000\.777/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Buscar por número/), { target: { value: "nautica" } });
    expect(screen.getByText("1 de 2 nota(s)")).toBeTruthy();

    fireEvent.click(screen.getByText(/NF 004\.521/));
    expect(await screen.findByText("Bateria 12 V")).toBeTruthy();
    expect(detail).toHaveBeenCalledWith("a");
    fireEvent.click(screen.getByRole("button", { name: "Baixar nota fiscal" }));
    await waitFor(() => expect(download).toHaveBeenCalledWith("a"));
  });
});
