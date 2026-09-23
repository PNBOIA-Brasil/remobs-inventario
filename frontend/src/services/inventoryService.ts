import { inventoryApi } from "../api/client";
import type {
  AcquisitionNeed,
  AcquisitionPriority,
  AcquisitionStatus,
  AlertItem,
  ApiList,
  AuditLog,
  Checklist,
  DashboardSummary,
  EntityFile,
  EntityFileRole,
  InventoryItem,
  ItemHistory,
  Movement,
  WithdrawalOrder,
  WithdrawalPurpose,
  InventoryLocation,
  Platform,
  PlatformDetail,
  Sensor,
  SensorDetail,
  SyncConflict,
  SyncStatus,
} from "../types";

export interface InventoryItemPayload {
  item_type: "consumable" | "permanent_component";
  name: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  patrimony_number?: string;
  invoice_number?: string;
  description?: string;
  condition_status?: string;
  category_name?: string;
  location_name?: string;
  unit?: string;
  initial_quantity?: number;
  minimum_stock_national?: number;
  minimum_stock_import?: number;
  minimum_stock_maintenance?: number;
  ideal_stock?: number;
  reason?: string;
}

export interface MovementRequestPayload {
  item_id: string;
  quantity: number;
  from_location_id: string;
  to_location_id?: string;
  to_location_name?: string;
  reason: string;
}

export interface ReceiptPayload {
  origin: "compra" | "doacao" | "transferencia";
  document?: string;
  location_id: string;
  notes?: string;
  lines: Array<{ item_id: string; quantity: number; supplier_code?: string }>;
  invoice_id?: string;
  invoice_number?: string;
  invoice_series?: string;
  supplier_name?: string;
  supplier_cnpj?: string;
  issue_date?: string;
  total_value?: number;
  access_key?: string;
}

export interface ReceivedInvoice {
  id: string;
  number: string | null;
  series: string | null;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  issue_date: string | null;
  total_value: number | null;
  access_key: string | null;
  origin: string | null;
  location_name: string | null;
  notes: string | null;
  received_by_username: string;
  received_at: string;
  lines: number;
  units: number;
  files: number;
}

export interface ReceivedInvoiceDetail extends ReceivedInvoice {
  received_items: Array<{ item_id: string; name: string; patrimony_number: string | null; item_type: string; unit: string; quantity: number }>;
}

export interface ReceiptResult {
  movements: Movement[];
  total_quantity: number;
  /** Itens que receberam saldo; permanente traz cada unidade nova. */
  items: InventoryItem[];
}

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

export interface InvoiceLine {
  supplier_code: string | null;
  description: string;
  unit: string | null;
  quantity: number;
  unit_value: number | null;
  total_value: number | null;
  ncm: string | null;
}

export interface InvoiceReadResult {
  invoice_id: string;
  supplier_name: string | null;
  supplier_cnpj: string | null;
  number: string | null;
  series: string | null;
  issue_date: string | null;
  total_value: number | null;
  access_key: string | null;
  lines: InvoiceLine[];
  uncertain_fields: string[];
  suggestions: Array<Array<{ item_id: string; score: number; match: "supplier_code" | "similar" }>>;
  already_received: ReceivedInvoice | null;
}

export interface ChecklistPayload {
  title?: string;
  template_name?: string;
  platform_id?: string | null;
  platform_name?: string | null;
  total_steps?: number;
  current_step?: number;
  answers?: Record<string, unknown>;
  evidence?: Array<Record<string, unknown>>;
  notes?: string | null;
}

export interface SyncConflictDecisionPayload {
  client_action_id: string;
  decision: "adjust" | "discard" | "send_to_admin";
  adjusted_payload?: Record<string, unknown>;
  reason: string;
}

export interface PlatformCreatePayload {
  name: string;
  platform_type: string;
  manufacturer?: string;
  model?: string;
  operational_status?: string;
  description?: string;
}

export interface PlatformUpdatePayload {
  name?: string;
  platform_type?: string;
  manufacturer?: string | null;
  model?: string | null;
  operational_status?: string;
  description?: string | null;
  reason?: string | null;
}

export interface LocationCreatePayload {
  name: string;
  location_type?: string;
}

export interface LocationUpdatePayload {
  name?: string;
  location_type?: string;
  is_active?: boolean;
  reason?: string | null;
}

export interface InventoryItemUpdatePayload {
  name?: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  invoice_number?: string | null;
  description?: string | null;
  condition_status?: string;
  category_name?: string;
  location_name?: string;
  unit?: string;
  minimum_stock_national?: number;
  minimum_stock_import?: number;
  minimum_stock_maintenance?: number;
  ideal_stock?: number;
  reason?: string | null;
}

export interface SensorCreatePayload {
  sensor_type: string;
  family: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  patrimony_number?: string;
  operational_status?: string;
  calibration_due_at?: string;
  notes?: string;
}

export interface SensorUpdatePayload {
  sensor_type?: string;
  family?: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  patrimony_number?: string | null;
  operational_status?: string;
  calibration_due_at?: string | null;
  notes?: string | null;
  reason?: string | null;
}

export const inventoryService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await inventoryApi.get<DashboardSummary>("/dashboard/summary");
    return response.data;
  },

  /** `q` busca por trecho do nome, patrimônio ou número de série. */
  async listItems(options?: { q?: string }): Promise<ApiList<InventoryItem>> {
    const response = await inventoryApi.get<ApiList<InventoryItem>>("/inventory/items", options?.q ? { params: { q: options.q } } : undefined);
    return response.data;
  },

  async suggestItemField(
    field: "name" | "brand" | "model" | "category_name" | "location_name",
    q: string,
    options?: { limit?: number; signal?: AbortSignal },
  ): Promise<string[]> {
    const response = await inventoryApi.get<{ field: string; q: string; items: string[] }>(
      "/inventory/items/suggestions",
      {
        params: { field, q, limit: options?.limit ?? 20 },
        signal: options?.signal,
      },
    );
    return response.data.items;
  },

  async getItem(id: string): Promise<InventoryItem> {
    const response = await inventoryApi.get<InventoryItem>(`/inventory/items/${id}`);
    return response.data;
  },

  async getItemHistory(id: string): Promise<ItemHistory> {
    const response = await inventoryApi.get<ItemHistory>(`/inventory/items/${id}/history`);
    return response.data;
  },

  async listItemFiles(id: string): Promise<ApiList<EntityFile>> {
    const response = await inventoryApi.get<ApiList<EntityFile>>(`/inventory/items/${id}/files`);
    return response.data;
  },

  async uploadItemFile(
    id: string,
    file: File,
    fileRole: EntityFileRole,
    notes?: string,
  ): Promise<EntityFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_role", fileRole);
    if (notes) {
      formData.append("notes", notes);
    }
    const response = await inventoryApi.post<EntityFile>(`/inventory/items/${id}/files`, formData);
    return response.data;
  },

  async downloadItemFile(itemId: string, entityFileId: string): Promise<Blob> {
    const response = await inventoryApi.get<Blob>(`/inventory/items/${itemId}/files/${entityFileId}/content`, {
      responseType: "blob",
    });
    return response.data;
  },

  async deleteItemFile(itemId: string, entityFileId: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/inventory/items/${itemId}/files/${entityFileId}`, {
      data: { reason },
    });
    return response.data;
  },

  async createItem(payload: InventoryItemPayload): Promise<InventoryItem> {
    const response = await inventoryApi.post<InventoryItem>("/inventory/items", payload);
    return response.data;
  },

  async updateItem(id: string, payload: InventoryItemUpdatePayload): Promise<InventoryItem> {
    const response = await inventoryApi.patch<InventoryItem>(`/inventory/items/${id}`, payload);
    return response.data;
  },

  async deleteItem(id: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/inventory/items/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async listMovements(): Promise<ApiList<Movement>> {
    const response = await inventoryApi.get<ApiList<Movement>>("/inventory/movements");
    return response.data;
  },

  async requestMovement(payload: MovementRequestPayload): Promise<Movement> {
    const response = await inventoryApi.post<Movement>("/inventory/movements/request", payload);
    return response.data;
  },

  async approveMovement(id: string, reason: string): Promise<Movement> {
    const response = await inventoryApi.post<Movement>(`/inventory/movements/${id}/approve`, { reason });
    return response.data;
  },

  async rejectMovement(id: string, reason: string): Promise<Movement> {
    const response = await inventoryApi.post<Movement>(`/inventory/movements/${id}/reject`, { reason });
    return response.data;
  },

  async readInvoice(files: File[]): Promise<InvoiceReadResult> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    // O modelo de visão leva de 10 a 40 s por nota.
    const response = await inventoryApi.post<InvoiceReadResult>("/inventory/receipts/invoice/read", formData, { timeout: 120000 });
    return response.data;
  },

  async listReceivedInvoices(): Promise<ApiList<ReceivedInvoice>> {
    const response = await inventoryApi.get<ApiList<ReceivedInvoice>>("/inventory/receipts/invoices");
    return response.data;
  },

  async getReceivedInvoice(id: string): Promise<ReceivedInvoiceDetail> {
    const response = await inventoryApi.get<ReceivedInvoiceDetail>(`/inventory/receipts/invoices/${id}`);
    return response.data;
  },

  /** Baixa todas as páginas guardadas da nota fiscal; devolve quantos arquivos foram baixados. */
  async downloadInvoice(invoiceId: string): Promise<number> {
    const listed = await inventoryApi.get<ApiList<EntityFile>>(`/inventory/receipts/invoices/${invoiceId}/files`);
    for (const file of listed.data.items) {
      const content = await inventoryApi.get<Blob>(file.download_path, { responseType: "blob" });
      saveBlob(content.data, file.original_name);
    }
    return listed.data.items.length;
  },

  async uploadReceiptPhoto(itemId: string, file: File): Promise<EntityFile> {
    const formData = new FormData();
    formData.append("item_id", itemId);
    formData.append("file", file);
    const response = await inventoryApi.post<EntityFile>("/inventory/receipts/photos", formData);
    return response.data;
  },

  async registerReceipt(payload: ReceiptPayload): Promise<ReceiptResult> {
    const response = await inventoryApi.post<ReceiptResult>("/inventory/receipts", payload);
    return response.data;
  },

  async listAcquisitions(): Promise<ApiList<AcquisitionNeed>> {
    const response = await inventoryApi.get<ApiList<AcquisitionNeed>>("/inventory/acquisitions");
    return response.data;
  },

  async createAcquisition(payload: { item_id: string; quantity: number; priority: AcquisitionPriority; reason: string }): Promise<AcquisitionNeed> {
    const response = await inventoryApi.post<AcquisitionNeed>("/inventory/acquisitions", payload);
    return response.data;
  },

  async updateAcquisition(
    id: string,
    payload: { reason: string; status?: AcquisitionStatus; quantity?: number; priority?: AcquisitionPriority; process_number?: string; expected_date?: string },
  ): Promise<AcquisitionNeed> {
    const response = await inventoryApi.patch<AcquisitionNeed>(`/inventory/acquisitions/${id}`, payload);
    return response.data;
  },

  async suggestAcquisitions(): Promise<{ created: number }> {
    const response = await inventoryApi.post<{ created: number }>("/inventory/acquisitions/suggest");
    return response.data;
  },

  async listWithdrawals(): Promise<ApiList<WithdrawalOrder>> {
    const response = await inventoryApi.get<ApiList<WithdrawalOrder>>("/inventory/withdrawals");
    return response.data;
  },

  async getWithdrawal(id: string): Promise<WithdrawalOrder> {
    const response = await inventoryApi.get<WithdrawalOrder>(`/inventory/withdrawals/${id}`);
    return response.data;
  },

  async requestWithdrawal(payload: {
    reason: string;
    lines: Array<{ item_id: string; quantity: number; from_location_id: string }>;
    purpose?: WithdrawalPurpose;
    due_date?: string;
    platform_id?: string;
  }): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>("/inventory/withdrawals", payload);
    return response.data;
  },

  /** Sem `lines`, aprova tudo como pedido. Com `lines`, quantidade 0 recusa o material. */
  async approveWithdrawal(id: string, reason: string, lines?: Array<{ line_id: string; quantity: number }>): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/withdrawals/${id}/approve`, lines ? { reason, lines } : { reason });
    return response.data;
  },

  async rejectWithdrawal(id: string, reason: string): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/withdrawals/${id}/reject`, { reason });
    return response.data;
  },

  async deliverWithdrawal(id: string, reason: string): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/withdrawals/${id}/deliver`, { reason });
    return response.data;
  },

  async requestReturn(orderId: string, lineId: string, payload: { quantity: number; reason: string }): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/withdrawals/${orderId}/lines/${lineId}/return`, payload);
    return response.data;
  },

  async requestWriteoff(orderId: string, lineId: string, payload: { quantity: number; reason: string }): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/withdrawals/${orderId}/lines/${lineId}/writeoff`, payload);
    return response.data;
  },

  async acceptCustodyEvent(id: string, reason: string): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/custody-events/${id}/accept`, { reason });
    return response.data;
  },

  async refuseCustodyEvent(id: string, reason: string): Promise<WithdrawalOrder> {
    const response = await inventoryApi.post<WithdrawalOrder>(`/inventory/custody-events/${id}/refuse`, { reason });
    return response.data;
  },

  async listAlerts(): Promise<ApiList<AlertItem>> {
    const response = await inventoryApi.get<ApiList<AlertItem>>("/alerts");
    return response.data;
  },

  async listAuditLogs(): Promise<ApiList<AuditLog>> {
    const response = await inventoryApi.get<ApiList<AuditLog>>("/audit-logs");
    return response.data;
  },

  async listPlatforms(options?: { activeOnly?: boolean }): Promise<ApiList<Platform>> {
    const activeOnly = options?.activeOnly ?? true;
    const response = await inventoryApi.get<ApiList<Platform>>("/platforms", {
      params: { active_only: activeOnly },
    });
    return response.data;
  },

  async getPlatform(id: string): Promise<PlatformDetail> {
    const response = await inventoryApi.get<PlatformDetail>(`/platforms/${id}`);
    return response.data;
  },

  async createPlatform(payload: PlatformCreatePayload): Promise<Platform> {
    const response = await inventoryApi.post<Platform>("/platforms", payload);
    return response.data;
  },

  async updatePlatform(id: string, payload: PlatformUpdatePayload): Promise<Platform> {
    const response = await inventoryApi.patch<Platform>(`/platforms/${id}`, payload);
    return response.data;
  },

  async deletePlatform(id: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/platforms/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async listLocations(options?: { q?: string; activeOnly?: boolean }): Promise<ApiList<InventoryLocation>> {
    const response = await inventoryApi.get<ApiList<InventoryLocation>>("/locations", {
      params: {
        q: options?.q || undefined,
        active_only: options?.activeOnly ?? true,
      },
    });
    return response.data;
  },

  async getLocation(id: string): Promise<InventoryLocation> {
    const response = await inventoryApi.get<InventoryLocation>(`/locations/${id}`);
    return response.data;
  },

  async createLocation(payload: LocationCreatePayload): Promise<InventoryLocation> {
    const response = await inventoryApi.post<InventoryLocation>("/locations", payload);
    return response.data;
  },

  async updateLocation(id: string, payload: LocationUpdatePayload): Promise<InventoryLocation> {
    const response = await inventoryApi.patch<InventoryLocation>(`/locations/${id}`, payload);
    return response.data;
  },

  async deleteLocation(id: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/locations/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async listSensors(): Promise<ApiList<Sensor>> {
    const response = await inventoryApi.get<ApiList<Sensor>>("/sensors");
    return response.data;
  },

  async getSensor(id: string): Promise<SensorDetail> {
    const response = await inventoryApi.get<SensorDetail>(`/sensors/${id}`);
    return response.data;
  },

  async createSensor(payload: SensorCreatePayload): Promise<Sensor> {
    const response = await inventoryApi.post<Sensor>("/sensors", payload);
    return response.data;
  },

  async updateSensor(id: string, payload: SensorUpdatePayload): Promise<Sensor> {
    const response = await inventoryApi.patch<Sensor>(`/sensors/${id}`, payload);
    return response.data;
  },

  async deleteSensor(id: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/sensors/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async listChecklists(): Promise<ApiList<Checklist>> {
    const response = await inventoryApi.get<ApiList<Checklist>>("/checklists");
    return response.data;
  },

  async getChecklist(id: string): Promise<Checklist> {
    const response = await inventoryApi.get<Checklist>(`/checklists/${id}`);
    return response.data;
  },

  async createChecklist(payload: ChecklistPayload): Promise<Checklist> {
    const response = await inventoryApi.post<Checklist>("/checklists", payload);
    return response.data;
  },

  async deleteChecklist(id: string, reason: string): Promise<{ status: string }> {
    const response = await inventoryApi.delete<{ status: string }>(`/checklists/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async updateChecklist(id: string, payload: ChecklistPayload): Promise<Checklist> {
    const response = await inventoryApi.patch<Checklist>(`/checklists/${id}`, payload);
    return response.data;
  },

  async submitChecklist(id: string, reason: string): Promise<Checklist> {
    const response = await inventoryApi.post<Checklist>(`/checklists/${id}/submit`, { reason });
    return response.data;
  },

  async getSyncStatus(): Promise<SyncStatus> {
    const response = await inventoryApi.get("/sync/status");
    return response.data;
  },

  async listSyncConflicts(): Promise<ApiList<SyncConflict>> {
    const response = await inventoryApi.get<ApiList<SyncConflict>>("/sync/conflicts");
    return response.data;
  },

  async resolveSyncConflict(payload: SyncConflictDecisionPayload): Promise<{ status: string; client_action_id: string }> {
    const response = await inventoryApi.post<{ status: string; client_action_id: string }>("/sync/resolve-conflict", payload);
    return response.data;
  },
};
