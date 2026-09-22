import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import AcquisitionsPage from "../src/pages/AcquisitionsPage";
import { inventoryService } from "../src/services/inventoryService";
import type { AcquisitionNeed } from "../src/types";
import { renderWithProviders } from "./test-utils";

const permissions = { current: [] as string[] };

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "gestor", permission_codes: permissions.current },
    hasPermission: (code: string) => permissions.current.includes(code),
    hasAnyPermission: (...codes: string[]) => codes.some((code) => permissions.current.includes(code)),
  }),
}));

const need: AcquisitionNeed = {
  id: "nec-1",
  item_id: "item-1",
  item_name: "Bateria 12V",
  item_unit: "un",
  stock_total: 3,
  quantity: 21,
  received_quantity: 0,
  status: "sugerida",
  priority: "alta",
  origin: "automatica",
  reason: "Saldo 3 abaixo do mínimo 10.",
  process_number: null,
  expected_date: null,
  created_by_username: null,
  updated_by_username: null,
  created_at: "2026-09-22T12:00:00Z",
  updated_at: "2026-09-22T12:00:00Z",
};

function renderPage() {
  renderWithProviders(
    <MemoryRouter>
      <AcquisitionsPage />
    </MemoryRouter>,
  );
}

describe("aquisições", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gestor aprova a sugestão com motivo", async () => {
    permissions.current = ["inventory:item:read", "inventory:movement:approve"];
    vi.spyOn(inventoryService, "listAcquisitions").mockResolvedValue({ items: [need], total: 1 });
    const update = vi.spyOn(inventoryService, "updateAcquisition").mockResolvedValue({ ...need, status: "aprovada" });
    renderPage();

    expect(await screen.findByText("Bateria 12V")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sugeridas (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    fireEvent.change(screen.getByRole("textbox", { name: /motivo/i }), { target: { value: "Repor para a campanha." } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("nec-1", { status: "aprovada", reason: "Repor para a campanha." }));
  });

  it("quem só lê não vê ações", async () => {
    permissions.current = ["inventory:item:read"];
    vi.spyOn(inventoryService, "listAcquisitions").mockResolvedValue({ items: [need], total: 1 });
    renderPage();

    expect(await screen.findByText("Bateria 12V")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Nova necessidade" })).toBeNull();
  });
});
