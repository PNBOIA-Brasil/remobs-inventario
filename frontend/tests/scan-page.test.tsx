import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScanPage, { itemIdFromCode } from "../src/pages/ScanPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem } from "../src/types";
import { renderWithProviders } from "./test-utils";

const item = (id: string, patrimony: string) =>
  ({ id, name: `Multímetro ${id}`, patrimony_number: patrimony, serial_number: null, stock_total: 1, unit: "un" }) as unknown as InventoryItem;

function renderPage() {
  renderWithProviders(
    <MemoryRouter initialEntries={["/app/scan"]}>
      <Routes>
        <Route path="/app/scan" element={<ScanPage />} />
        <Route path="/app/inventory/:id" element={<div>Ficha do item</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("leitor de etiquetas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("extrai o id do item de um link ou do próprio código", () => {
    const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
    expect(itemIdFromCode(`https://inventario.remobs.com.br/app/inventory/${id}`)).toBe(id);
    expect(itemIdFromCode("PAT 004512")).toBeNull();
  });

  it("abre a ficha quando o patrimônio bate exatamente", async () => {
    const search = vi
      .spyOn(inventoryService, "listItems")
      .mockResolvedValue({ items: [item("a", "PAT-10"), item("b", "PAT-100")], total: 2 });
    renderPage();

    expect(screen.getByText(/indisponível neste navegador/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "pat-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Ficha do item")).toBeTruthy();
    expect(search).toHaveBeenCalledWith({ q: "pat-10" });
  });

  it("lista quando há vários resultados sem correspondência exata", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({ items: [item("a", "X1"), item("b", "X2")], total: 2 });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "Multímetro" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(screen.getByText("2 materiais encontrados")).toBeTruthy());
  });
});
