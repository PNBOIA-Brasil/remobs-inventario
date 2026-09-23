export type PermissionCode = string;

export interface RemobsUser {
  id: number;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  permission_codes: PermissionCode[];
}

export interface StockBalance {
  id: string;
  location_id: string;
  location_name: string;
  quantity: number;
  reserved_quantity: number;
}

export interface InventoryItem {
  id: string;
  item_type: "consumable" | "permanent_component";
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  patrimony_number: string | null;
  invoice_number: string | null;
  description: string | null;
  condition_status: string;
  category_name: string | null;
  current_location_id: string | null;
  current_location_name: string | null;
  unit: string;
  minimum_stock_national: number;
  minimum_stock_import?: number;
  minimum_stock_maintenance?: number;
  ideal_stock: number;
  row_version: number;
  stock_total: number;
  balances: StockBalance[];
  created_at?: string;
  updated_at?: string;
}

export interface Movement {
  id: string;
  item_id: string;
  movement_type?: string;
  from_location_name: string | null;
  to_location_name: string | null;
  quantity: number;
  requested_by_username: string;
  approved_by_username: string | null;
  status: string;
  reason: string;
  invoice_id?: string | null;
  created_at: string;
}

export interface WithdrawalLine {
  id: string;
  item_id: string;
  item_name: string;
  item_type: string;
  from_location_id: string;
  from_location_name: string | null;
  quantity: number;
  reserved_quantity: number;
  delivered_quantity: number;
  returned_quantity: number;
  written_off_quantity: number;
  custody_quantity: number;
  status: string;
}

export interface CustodyEvent {
  id: string;
  line_id: string;
  item_id: string;
  item_name: string;
  event_type: "devolucao" | "baixa" | string;
  quantity: number;
  status: string;
  reason: string;
  requested_by_id: number;
  requested_by_username: string;
  decided_by_username: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface WithdrawalAuditEntry {
  id: string;
  occurred_at: string;
  actor_username: string | null;
  actor_roles: string[];
  action: string;
  reason: string | null;
}

export type AcquisitionStatus = "sugerida" | "aprovada" | "em_compra" | "atendida" | "cancelada";
export type AcquisitionPriority = "alta" | "media" | "baixa";

export interface AcquisitionNeed {
  id: string;
  item_id: string;
  item_name: string;
  item_unit: string;
  stock_total: number;
  quantity: number;
  received_quantity: number;
  status: AcquisitionStatus;
  priority: AcquisitionPriority;
  origin: "automatica" | "manual";
  reason: string | null;
  process_number: string | null;
  expected_date: string | null;
  created_by_username: string | null;
  updated_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export type WithdrawalPurpose = "consumo" | "emprestimo" | "plataforma";

export interface WithdrawalOrder {
  id: string;
  status: string;
  reason: string;
  purpose: WithdrawalPurpose;
  due_date: string | null;
  platform_id: string | null;
  platform_name: string | null;
  requested_by_id: number;
  requested_by_username: string;
  decided_by_username: string | null;
  decision_reason: string | null;
  delivered_by_username: string | null;
  delivery_reason: string | null;
  created_at: string;
  decided_at: string | null;
  delivered_at: string | null;
  lines: WithdrawalLine[];
  events: CustodyEvent[];
  audit_trail: WithdrawalAuditEntry[];
}

export interface AlertItem {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  occurred_at: string;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_label_snapshot: string | null;
  reason: string | null;
  status: string;
}

export interface Platform {
  id: string;
  name: string;
  platform_type: string;
  manufacturer?: string | null;
  operational_status: string;
  model: string | null;
  description?: string | null;
}

export interface InventoryLocation {
  id: string;
  name: string;
  location_type: string;
  is_active: boolean;
  created_at: string;
}

export interface Sensor {
  id: string;
  sensor_type: string;
  family: string;
  brand?: string | null;
  model: string | null;
  serial_number?: string | null;
  patrimony_number?: string | null;
  operational_status: string;
  calibration_due_at: string | null;
  notes?: string | null;
}

export interface PlatformSystem {
  id: string;
  name: string;
  status: string;
  notes: string | null;
}

export interface PlatformHull {
  id: string;
  code: string;
  model: string | null;
  status: string;
  notes: string | null;
}

export interface PlatformLinkedSensor extends Sensor {
  installation_status: string;
  installation_notes: string | null;
}

export interface PlatformDetail extends Platform {
  hull: PlatformHull | null;
  systems: PlatformSystem[];
  sensors: PlatformLinkedSensor[];
}

export interface SensorPlatform {
  id: string;
  name: string;
  platform_type: string;
  operational_status: string;
}

export interface SensorInstallation {
  id: string;
  platform_id: string;
  platform_name: string;
  status: string;
  installed_at: string | null;
  removed_at: string | null;
  notes: string | null;
}

export interface SensorDetail extends Sensor {
  current_platform: SensorPlatform | null;
  installations: SensorInstallation[];
}

export interface Checklist {
  id: string;
  title: string;
  template_name: string;
  platform_id: string | null;
  platform_name: string | null;
  status: "draft" | "submitted" | string;
  current_step: number;
  total_steps: number;
  answers: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  submitted_by_id: number;
  submitted_by_username: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface ItemHistory {
  movements: Movement[];
  audit_logs: Array<{
    id: string;
    occurred_at: string;
    actor_username: string | null;
    action: string;
    reason: string | null;
  }>;
}

export type EntityFileRole = "foto" | "documento";

export interface EntityFile {
  id: string;
  file_id: string;
  entity_type: string;
  entity_id: string;
  file_role: EntityFileRole | string;
  notes: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: string;
  download_path: string;
}

export interface SyncStatus {
  pending_actions: number;
  conflict_actions: number;
  server_time: string;
}

export interface DashboardCriticalStockItem {
  id: string;
  name: string;
  unit: string;
  stock_total: number;
  minimum_stock_national: number;
}

export interface DashboardSummary {
  items_registered: number;
  critical_stock: number;
  pending_requests: number;
  platforms_in_operation: number;
  platforms_in_maintenance: number;
  sensors_with_alert: number;
  checklists_registered: number;
  checklists_submitted: number;
  offline_pending: number;
  offline_conflicts: number;
  critical_alerts: AlertItem[];
  critical_stock_items: DashboardCriticalStockItem[];
}

export interface SyncConflict {
  id: string;
  client_action_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface ApiList<T> {
  items: T[];
  total: number;
}
