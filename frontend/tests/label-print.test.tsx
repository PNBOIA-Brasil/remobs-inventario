import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LABELS_PER_A4, printLabels } from "../src/labelPrint";
import InventoryListPage from "../src/pages/InventoryListPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem } from "../src/types";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) => permission === "inventory:item:read",
    hasAnyPermission: () => true,
  }),
}));

function item(index: number): InventoryItem {
  return {
    id: `item-${index}`,
    item_type: "permanent_component",
    name: `Multímetro ${index}`,
    brand: null,
    model: null,
    serial_number: null,
    patrimony_number: `REM-${String(index).padStart(6, "0")}`,
    invoice_number: null,
    description: null,
    condition_status: "operacional",
    category_name: "Medição",
    current_location_id: "loc-1",
    current_location_name: "Paiol",
    unit: "un",
    minimum_stock_national: 0,
    ideal_stock: 0,
    row_version: 1,
    stock_total: 1,
    balances: [],
  };
}

/** Janela de impressão falsa: documento próprio, print espionado. */
function fakePrintWindow() {
  const doc = document.implementation.createHTMLDocument("");
  const win = { document: doc, focus: vi.fn(), print: vi.fn() };
  vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  return win;
}

describe("impressão de etiquetas", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pagina a folha A4 com 27 etiquetas por página", () => {
    const win = fakePrintWindow();
    const items = Array.from({ length: LABELS_PER_A4 + 1 }, (_, index) => item(index + 1));

    expect(printLabels(items, "a4")).toBe(true);

    const pages = win.document.querySelectorAll(".p");
    expect([...pages].map((page) => page.querySelectorAll(".l").length)).toEqual([27, 1]);
    expect(win.document.title).toBe("Etiquetas (28)");
    expect(win.document.body.textContent).toContain("REM-000028");
    expect(win.document.body.textContent).toContain("Multímetro 28");
    expect(win.document.querySelectorAll("svg[aria-label^='QR Code do patrimônio']")).toHaveLength(28);
    expect(win.document.querySelector("style")?.textContent).toContain("size:A4");
    expect(win.print).toHaveBeenCalledTimes(1);
  });

  it("avisa quando o navegador bloqueia a janela", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(printLabels([item(1)], "individual")).toBe(false);
  });

  it("lista mostra o QR de cada item e imprime só os selecionados", async () => {
    vi.spyOn(inventoryService, "listItems").mockResolvedValue({ items: [item(1), item(2), item(3)], total: 3 });
    const win = fakePrintWindow();
    renderWithProviders(
      <MemoryRouter>
        <InventoryListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("img", { name: "QR Code do patrimônio REM-000001" })).toBeTruthy();
    expect(screen.getAllByRole("img", { name: /QR Code do patrimônio/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar etiqueta de Multímetro 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Imprimir etiquetas (1)" }));
    expect(win.document.querySelectorAll(".l")).toHaveLength(1);
    expect(win.document.body.textContent).toContain("REM-000002");

    fireEvent.click(screen.getByRole("button", { name: "Selecionar visíveis" }));
    expect(screen.getByRole("button", { name: "Imprimir etiquetas (3)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar visíveis" }));
    expect((screen.getByRole("button", { name: "Imprimir etiquetas (0)" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
