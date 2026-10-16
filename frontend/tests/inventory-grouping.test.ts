import { describe, expect, it } from "vitest";

import { groupIdenticalItems } from "../src/inventoryGrouping";
import type { InventoryItem } from "../src/types";

const make = (over: Partial<InventoryItem>): InventoryItem =>
  ({
    id: Math.random().toString(),
    item_type: "permanent_component",
    name: "Bateria 12V",
    brand: "Acme",
    model: "B12",
    serial_number: null,
    patrimony_number: "REM-1",
    unit: "un",
    stock_total: 1,
    minimum_stock_national: 0,
    condition_status: "operacional",
    current_location_name: null,
    ...over,
  }) as unknown as InventoryItem;

describe("groupIdenticalItems", () => {
  it("agrupa itens iguais somando unidades e saldo", () => {
    const groups = groupIdenticalItems([
      make({ id: "1", stock_total: 1 }),
      make({ id: "2", stock_total: 1 }),
      make({ id: "3", name: "Cabo de aço", brand: null, model: null, stock_total: 5 }),
    ]);
    expect(groups).toHaveLength(2);
    const bateria = groups.find((group) => group.sample.name === "Bateria 12V")!;
    expect(bateria.units).toBe(2);
    expect(bateria.stockTotal).toBe(2);
  });

  it("marca o grupo como crítico quando alguma unidade está abaixo do mínimo", () => {
    const [group] = groupIdenticalItems([make({ stock_total: 0, minimum_stock_national: 2 })]);
    expect(group.critical).toBe(true);
  });
});
