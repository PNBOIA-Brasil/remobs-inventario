import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DescriptionIcon from "@mui/icons-material/Description";
import ChecklistIcon from "@mui/icons-material/FactCheck";
import HubIcon from "@mui/icons-material/Hub";
import InventoryIcon from "@mui/icons-material/Inventory2";
import MoveToInboxIcon from "@mui/icons-material/MoveToInbox";
import PlaceIcon from "@mui/icons-material/Place";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SensorsIcon from "@mui/icons-material/Sensors";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { SvgIconComponent } from "@mui/icons-material";

export const navigationGroups = ["Operação", "Estoque", "Campo", "Administração"] as const;
export type NavigationGroup = (typeof navigationGroups)[number];

export interface NavigationItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
  permissions: string[];
  group: NavigationGroup;
  bottom: boolean;
}

export const REQUEST_PERMISSIONS = ["inventory:withdrawal:request", "inventory:movement:request"];
export const RECEIPT_PERMISSIONS = ["inventory:item:update", "inventory:withdrawal:deliver"];
export const APPROVE_PERMISSIONS = ["inventory:withdrawal:approve", "inventory:movement:approve"];
export const PAIOL_PERMISSIONS = ["inventory:withdrawal:approve", "inventory:movement:approve", "inventory:withdrawal:deliver", "inventory:return:decide", "inventory:writeoff:decide"];

export const navigationItems: NavigationItem[] = [
  { label: "Início", path: "/app/home", icon: DashboardIcon, permissions: [], group: "Operação", bottom: true },
  { label: "Pedidos", path: "/app/movements", icon: AssignmentTurnedInIcon, permissions: [...REQUEST_PERMISSIONS, ...PAIOL_PERMISSIONS], group: "Operação", bottom: true },
  { label: "Receber material", path: "/app/receipts/new", icon: MoveToInboxIcon, permissions: RECEIPT_PERMISSIONS, group: "Operação", bottom: false },
  { label: "Receber por nota fiscal", path: "/app/receipts/invoice", icon: ReceiptLongIcon, permissions: RECEIPT_PERMISSIONS, group: "Operação", bottom: false },
  { label: "Escanear", path: "/app/scan", icon: QrCodeScannerIcon, permissions: ["inventory:item:read"], group: "Operação", bottom: true },
  { label: "Itens e saldos", path: "/app/inventory", icon: InventoryIcon, permissions: ["inventory:item:read"], group: "Estoque", bottom: true },
  { label: "Alertas", path: "/app/alerts", icon: WarningAmberIcon, permissions: ["inventory:item:read"], group: "Estoque", bottom: false },
  { label: "Aquisições", path: "/app/acquisitions", icon: ShoppingCartIcon, permissions: ["inventory:item:read"], group: "Estoque", bottom: false },
  { label: "Notas fiscais", path: "/app/receipts/invoices", icon: DescriptionIcon, permissions: ["inventory:item:read"], group: "Estoque", bottom: false },
  { label: "Plataformas", path: "/app/platforms", icon: HubIcon, permissions: ["platform:read"], group: "Campo", bottom: false },
  { label: "Sensores", path: "/app/sensors", icon: SensorsIcon, permissions: ["sensor:read"], group: "Campo", bottom: false },
  { label: "Checklists", path: "/app/checklists", icon: ChecklistIcon, permissions: ["checklist:read", "checklist:submit"], group: "Campo", bottom: false },
  { label: "Locais", path: "/app/locations", icon: PlaceIcon, permissions: ["location:read"], group: "Administração", bottom: false },
  { label: "Sincronização", path: "/app/sync", icon: SyncIcon, permissions: ["inventory:item:read"], group: "Administração", bottom: false },
];

export function hasPermission(userPermissions: string[], required: string[]): boolean {
  if (userPermissions.includes("*")) {
    return true;
  }
  return required.every((permission) => userPermissions.includes(permission));
}

/** Aceita se o usuário tiver ao menos uma das permissões (ou `*`). Lista vazia = liberado. */
export function hasAnyPermission(userPermissions: string[], alternatives: string[]): boolean {
  if (userPermissions.includes("*")) {
    return true;
  }
  if (alternatives.length === 0) {
    return true;
  }
  return alternatives.some((permission) => userPermissions.includes(permission));
}

export function getVisibleNavigation(userPermissions: string[]): NavigationItem[] {
  // Itens de menu usam OR entre as permissões listadas (ex.: checklist:read | checklist:submit).
  return navigationItems.filter((item) => hasAnyPermission(userPermissions, item.permissions));
}

/** Itens visíveis agrupados por intenção, na ordem de `navigationGroups`, sem grupos vazios. */
export function getGroupedNavigation(userPermissions: string[]): { group: NavigationGroup; items: NavigationItem[] }[] {
  const visible = getVisibleNavigation(userPermissions);
  return navigationGroups
    .map((group) => ({ group, items: visible.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);
}
