import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ScanPage, { itemIdFromCode, withdrawalIdFromCode, withdrawalPathFromCode } from "../src/pages/ScanPage";
import { inventoryService } from "../src/services/inventoryService";
import type { InventoryItem, WithdrawalOrder } from "../src/types";
import { renderWithProviders } from "./test-utils";

function WithdrawalStub() {
  return <div>{`Pedido ${useParams().id}`}</div>;
}

const item = (id: string, patrimony: string) =>
  ({ id, name: `Multímetro ${id}`, patrimony_number: patrimony, serial_number: null, stock_total: 1, unit: "un" }) as unknown as InventoryItem;

function renderPage() {
  renderWithProviders(
    <MemoryRouter initialEntries={["/app/scan"]}>
      <Routes>
        <Route path="/app/scan" element={<ScanPage />} />
        <Route path="/app/inventory/:id" element={<div>Ficha do item</div>} />
        <Route path="/app/withdrawals/:id" element={<WithdrawalStub />} />
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

  it("abre o pedido ao ler o QR Code da retirada", async () => {
    const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
    expect(withdrawalIdFromCode(`https://inventario.remobs.com.br/app/withdrawals/${id}`)).toBe(id);
    expect(withdrawalIdFromCode(`https://inventario.remobs.com.br/app/inventory/${id}`)).toBeNull();
    const search = vi.spyOn(inventoryService, "listItems");
    renderPage();

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: `https://x/app/withdrawals/${id}` } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(`Pedido ${id}`)).toBeTruthy();
    expect(search).not.toHaveBeenCalled();
  });

  it("abre o pedido pelo código RET- digitado", async () => {
    const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({
      items: [{ id: "aaaaaaaa-0000-4000-8000-000000000000" }, { id }] as unknown as WithdrawalOrder[],
      total: 2,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "ret-3f2b8c1e" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(`Pedido ${id}`)).toBeTruthy();
  });

  it("mantém a devolução ao ler o QR Code da devolução", () => {
    const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
    const eventId = "9a8b7c6d-1234-4abc-9def-0123456789ab";
    expect(withdrawalPathFromCode(`https://x/app/withdrawals/${id}?devolucao=${eventId}`)).toBe(
      `/app/withdrawals/${id}?devolucao=${eventId}`,
    );
    expect(withdrawalPathFromCode(`https://x/app/withdrawals/${id}`)).toBe(`/app/withdrawals/${id}`);
  });

  it("abre o pedido pelo código DEV- digitado", async () => {
    const id = "3f2b8c1e-1234-4abc-9def-0123456789ab";
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({
      items: [{ id, events: [{ id: "9a8b7c6d-1234-4abc-9def-0123456789ab" }] }] as unknown as WithdrawalOrder[],
      total: 1,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "dev-9a8b7c6d" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText(`Pedido ${id}`)).toBeTruthy();
  });

  it("avisa quando o código RET- não corresponde a nenhuma retirada", async () => {
    vi.spyOn(inventoryService, "listWithdrawals").mockResolvedValue({ items: [], total: 0 });
    renderPage();

    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "RET-00000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Nenhuma retirada encontrada para este código.")).toBeTruthy();
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
