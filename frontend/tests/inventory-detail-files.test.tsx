import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import InventoryDetailPage from "../src/pages/InventoryDetailPage";
import { inventoryService } from "../src/services/inventoryService";
import { renderWithProviders } from "./test-utils";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    hasPermission: (permission: string) =>
      ["inventory:item:read", "inventory:item:update", "inventory:item:delete"].includes(permission),
    hasAnyPermission: (...permissions: string[]) =>
      permissions.some((permission) =>
        ["inventory:item:read", "inventory:item:update", "inventory:item:delete"].includes(permission),
      ),
  }),
}));

const item = {
  id: "item-1",
  item_type: "consumable" as const,
  name: "Bateria 28Ah",
  brand: "Moura",
  model: "28Ah",
  serial_number: null,
  patrimony_number: "REM-000042",
  invoice_number: null,
  description: "Bateria de campo",
  condition_status: "operacional",
  unit: "un",
  category_name: "Energia",
  current_location_id: "loc-1",
  current_location_name: "Estoque",
  stock_total: 3,
  minimum_stock_national: 1,
  ideal_stock: 5,
  row_version: 1,
  balances: [
    {
      id: "bal-1",
      location_id: "loc-1",
      location_name: "Estoque",
      quantity: 3,
      reserved_quantity: 0,
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("anexos no detalhe do inventário", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exibe botões de anexar e lista arquivos existentes", async () => {
    vi.spyOn(inventoryService, "getItem").mockResolvedValue(item);
    vi.spyOn(inventoryService, "getItemHistory").mockResolvedValue({ movements: [], audit_logs: [] });
    vi.spyOn(inventoryService, "listItemFiles").mockResolvedValue({
      items: [
        {
          id: "file-1",
          file_id: "meta-1",
          entity_type: "inventory_item",
          entity_id: "item-1",
          file_role: "foto",
          notes: null,
          original_name: "bateria.jpg",
          mime_type: "image/jpeg",
          size_bytes: 2048,
          uploaded_by: 1,
          created_at: "2026-08-06T12:00:00Z",
          download_path: "/inventory/items/item-1/files/file-1/content",
        },
      ],
      total: 1,
    });
    vi.spyOn(inventoryService, "downloadItemFile").mockResolvedValue(new Blob(["fake-image"], { type: "image/jpeg" }));

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/inventory/item-1"]}>
        <Routes>
          <Route path="/app/inventory/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /anexar foto/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /anexar documento/i })).toBeTruthy();
    expect(await screen.findByText("bateria.jpg")).toBeTruthy();
    expect(screen.getAllByText("REM-000042").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: "QR Code do patrimônio REM-000042" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /imprimir etiqueta/i })).toBeTruthy();
    expect(screen.getByText(/2\.0 KB/i)).toBeTruthy();
  });

  it("envia foto e mostra snackbar de sucesso", async () => {
    vi.spyOn(inventoryService, "getItem").mockResolvedValue(item);
    vi.spyOn(inventoryService, "getItemHistory").mockResolvedValue({ movements: [], audit_logs: [] });
    const listSpy = vi.spyOn(inventoryService, "listItemFiles").mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(inventoryService, "downloadItemFile").mockResolvedValue(new Blob());
    const uploadSpy = vi.spyOn(inventoryService, "uploadItemFile").mockResolvedValue({
      id: "file-2",
      file_id: "meta-2",
      entity_type: "inventory_item",
      entity_id: "item-1",
      file_role: "foto",
      notes: null,
      original_name: "nova.png",
      mime_type: "image/png",
      size_bytes: 10,
      uploaded_by: 1,
      created_at: "2026-08-06T13:00:00Z",
      download_path: "/inventory/items/item-1/files/file-2/content",
    });

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/inventory/item-1"]}>
        <Routes>
          <Route path="/app/inventory/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /anexar foto/i });
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs.length).toBe(2);

    const file = new File([new Uint8Array([1, 2, 3])], "nova.png", { type: "image/png" });
    fireEvent.change(inputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledWith("item-1", file, "foto");
    });
    await waitFor(() => {
      expect(listSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(await screen.findByText("Foto anexada com sucesso.")).toBeTruthy();
  });

  it("mostra snackbar de erro quando upload falha", async () => {
    vi.spyOn(inventoryService, "getItem").mockResolvedValue(item);
    vi.spyOn(inventoryService, "getItemHistory").mockResolvedValue({ movements: [], audit_logs: [] });
    vi.spyOn(inventoryService, "listItemFiles").mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(inventoryService, "uploadItemFile").mockRejectedValue(new Error("fail"));

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/inventory/item-1"]}>
        <Routes>
          <Route path="/app/inventory/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("button", { name: /anexar foto/i });
    const inputs = document.querySelectorAll('input[type="file"]');
    const file = new File([new Uint8Array([1, 2, 3])], "falha.png", { type: "image/png" });
    fireEvent.change(inputs[0], { target: { files: [file] } });

    expect(await screen.findByText("Não foi possível enviar a foto.")).toBeTruthy();
  });

  it("abre visualização de imagem sem botão de download", async () => {
    vi.spyOn(inventoryService, "getItem").mockResolvedValue(item);
    vi.spyOn(inventoryService, "getItemHistory").mockResolvedValue({ movements: [], audit_logs: [] });
    vi.spyOn(inventoryService, "listItemFiles").mockResolvedValue({
      items: [
        {
          id: "file-1",
          file_id: "meta-1",
          entity_type: "inventory_item",
          entity_id: "item-1",
          file_role: "foto",
          notes: null,
          original_name: "bateria.jpg",
          mime_type: "image/jpeg",
          size_bytes: 2048,
          uploaded_by: 1,
          created_at: "2026-08-06T12:00:00Z",
          download_path: "/inventory/items/item-1/files/file-1/content",
        },
      ],
      total: 1,
    });
    vi.spyOn(inventoryService, "downloadItemFile").mockResolvedValue(new Blob(["fake-image"], { type: "image/jpeg" }));

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/inventory/item-1"]}>
        <Routes>
          <Route path="/app/inventory/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("bateria.jpg")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /baixar bateria\.jpg/i })).toBeNull();

    const viewButtons = await screen.findAllByRole("button", { name: /visualizar bateria\.jpg/i });
    fireEvent.click(viewButtons[0]);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /fechar visualização/i })).toBeTruthy();
  });

  it("mantém download para documentos", async () => {
    vi.spyOn(inventoryService, "getItem").mockResolvedValue(item);
    vi.spyOn(inventoryService, "getItemHistory").mockResolvedValue({ movements: [], audit_logs: [] });
    vi.spyOn(inventoryService, "listItemFiles").mockResolvedValue({
      items: [
        {
          id: "file-doc",
          file_id: "meta-doc",
          entity_type: "inventory_item",
          entity_id: "item-1",
          file_role: "documento",
          notes: null,
          original_name: "manual.pdf",
          mime_type: "application/pdf",
          size_bytes: 4096,
          uploaded_by: 1,
          created_at: "2026-08-06T12:00:00Z",
          download_path: "/inventory/items/item-1/files/file-doc/content",
        },
      ],
      total: 1,
    });
    const downloadSpy = vi
      .spyOn(inventoryService, "downloadItemFile")
      .mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));

    renderWithProviders(
      <MemoryRouter initialEntries={["/app/inventory/item-1"]}>
        <Routes>
          <Route path="/app/inventory/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("manual.pdf")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /baixar manual\.pdf/i }));

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith("item-1", "file-doc");
    });
    expect(await screen.findByText("Download iniciado.")).toBeTruthy();
  });
});
