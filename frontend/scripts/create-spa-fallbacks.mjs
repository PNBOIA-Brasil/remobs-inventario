import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve("dist");
const indexFile = resolve(distDir, "index.html");

const routes = [
  "login",
  "app",
  "app/home",
  "app/inventory",
  "app/inventory/new",
  "app/movements",
  "app/movements/new",
  "app/withdrawals",
  "app/withdrawals/new",
  "app/receipts/new",
  "app/alerts",
  "app/locations",
  "app/locations/new",
  "app/platforms",
  "app/platforms/new",
  "app/sensors",
  "app/sensors/new",
  "app/checklists",
  "app/checklists/new",
  "app/sync",
  "app/menu",
  "app/admin/audit-logs",
];

await copyFile(indexFile, resolve(distDir, "404.html"));

for (const route of routes) {
  const routeDir = resolve(distDir, route);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexFile, resolve(routeDir, "index.html"));
}
