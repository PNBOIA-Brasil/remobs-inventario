import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "../src/pages/HomePage";
import { inventoryService } from "../src/services/inventoryService";

vi.mock("../src/state/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "admin", permission_codes: ["*"] },
    hasPermission: () => true,
    hasAnyPermission: () => true,
  }),
}));

vi.mock("../src/services/inventoryService", () => ({
  inventoryService: {
    getDashboardSummary: vi.fn(),
    listWithdrawals: vi.fn(),
    listItems: vi.fn(),
    listMovements: vi.fn(),
    listAlerts: vi.fn(),
    listPlatforms: vi.fn(),
    listSensors: vi.fn(),
    listChecklists: vi.fn(),
    getSyncStatus: vi.fn(),
  },
}));

function expectMetric(label: string, value: string) {
  const labelElement = screen.getByText(label);
  const cardContent = labelElement.closest(".MuiCardContent-root");
  expect(cardContent).toBeTruthy();
  expect(within(cardContent as HTMLElement).getByText(value)).toBeTruthy();
}

describe("dashboard operacional", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("consulta o resumo agregado e exibe indicadores operacionais", async () => {
    vi.mocked(inventoryService.getDashboardSummary).mockResolvedValue({
      items_registered: 729,
      critical_stock: 0,
      pending_requests: 0,
      platforms_in_operation: 90,
      platforms_in_maintenance: 13,
      sensors_with_alert: 18,
      checklists_registered: 12,
      checklists_submitted: 7,
      offline_pending: 0,
      offline_conflicts: 0,
      critical_alerts: [],
      critical_stock_items: [],
    });
    vi.mocked(inventoryService.listWithdrawals).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listItems).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listMovements).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listAlerts).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listPlatforms).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listSensors).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(inventoryService.listChecklists).mockResolvedValue({
      items: [
        { id: "checklist-1", status: "submitted" },
        { id: "checklist-2", status: "draft" },
      ],
      total: 2,
    } as never);
    vi.mocked(inventoryService.getSyncStatus).mockResolvedValue({
      pending_actions: 0,
      conflict_actions: 0,
      server_time: "2026-06-15T18:00:00Z",
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(inventoryService.getDashboardSummary).toHaveBeenCalledTimes(1));
    expect(inventoryService.listItems).not.toHaveBeenCalled();
    expectMetric("Itens cadastrados", "729");
    expectMetric("Plataformas em operação", "90");
    expectMetric("Plataformas em manutenção", "13");
    expectMetric("Sensores com alerta", "18");
    expectMetric("Checklists registrados", "12");
    expectMetric("Checklists enviados", "7");
  });
});
