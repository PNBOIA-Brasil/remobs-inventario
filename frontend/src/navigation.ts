import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ChecklistIcon from "@mui/icons-material/FactCheck";
import HubIcon from "@mui/icons-material/Hub";
import InventoryIcon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import SensorsIcon from "@mui/icons-material/Sensors";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { SvgIconComponent } from "@mui/icons-material";

export interface NavigationItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
  permissions: string[];
  bottom: boolean;
}

export const navigationItems: NavigationItem[] = [
  { label: "Início", path: "/app/home", icon: DashboardIcon, permissions: [], bottom: true },
  { label: "Inventário", path: "/app/inventory", icon: InventoryIcon, permissions: ["inventory:item:read"], bottom: true },
  { label: "Operação", path: "/app/movements", icon: AssignmentTurnedInIcon, permissions: ["inventory:withdrawal:request", "inventory:movement:request", "inventory:withdrawal:approve"], bottom: true },
  { label: "Alertas", path: "/app/alerts", icon: WarningAmberIcon, permissions: ["inventory:item:read"], bottom: true },
  { label: "Locais", path: "/app/locations", icon: PlaceIcon, permissions: ["location:read"], bottom: false },
  { label: "Plataformas", path: "/app/platforms", icon: HubIcon, permissions: ["platform:read"], bottom: false },
  { label: "Sensores", path: "/app/sensors", icon: SensorsIcon, permissions: ["sensor:read"], bottom: false },
  { label: "Checklists", path: "/app/checklists", icon: ChecklistIcon, permissions: ["checklist:read", "checklist:submit"], bottom: false },
  { label: "Sincronização", path: "/app/sync", icon: SyncIcon, permissions: ["inventory:item:read"], bottom: false },
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
