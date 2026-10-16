import type { InventoryItem } from "./types";

export interface ItemGroup {
  key: string;
  sample: InventoryItem;
  units: number;
  stockTotal: number;
  critical: boolean;
}

/** Agrupa itens iguais (mesmo tipo, nome, marca e modelo) somando unidades e saldo. */
export function groupIdenticalItems(items: InventoryItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const item of items) {
    const key = [item.item_type, item.name, item.brand ?? "", item.model ?? ""].join("|").toLowerCase();
    const isCritical = item.minimum_stock_national > 0 && item.stock_total < item.minimum_stock_national;
    const group = map.get(key);
    if (group) {
      group.units += 1;
      group.stockTotal += item.stock_total;
      group.critical = group.critical || isCritical;
    } else {
      map.set(key, { key, sample: item, units: 1, stockTotal: item.stock_total, critical: isCritical });
    }
  }
  return [...map.values()];
}
