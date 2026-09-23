import { QRCodeSVG } from "qrcode.react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { InventoryItem } from "./types";

/** Link gravado no QR do item: a câmera do celular abre a ficha e a tela Escanear extrai o número. */
export function itemQrUrl(patrimony: string): string {
  return `${window.location.origin}/app/p/${encodeURIComponent(patrimony)}`;
}

export type LabelLayout = "a4" | "individual";

/** A4 (210 × 297 mm) com margem de 10 mm: 3 × 9 etiquetas de 62 × 29 mm e 2 mm entre elas. */
export const LABELS_PER_A4 = 27;

const BASE_CSS =
  "body{margin:0;font-family:Arial,sans-serif;color:#111827}" +
  ".l{display:flex;gap:2mm;align-items:center;width:62mm;height:29mm;box-sizing:border-box;padding:2mm;overflow:hidden}" +
  ".l svg{width:25mm;height:25mm;flex-shrink:0}.t{min-width:0}" +
  "small{display:block;font-size:6pt;font-weight:700;letter-spacing:.15em;color:#0f766e}" +
  "b{display:block;font:700 11pt Consolas,monospace;margin:1mm 0}" +
  "span{font-size:7pt;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}";

const LAYOUT_CSS: Record<LabelLayout, string> = {
  individual: "@page{size:62mm 29mm;margin:0}.p{break-after:page}.p:last-child{break-after:auto}",
  a4:
    "@page{size:A4;margin:10mm}" +
    ".p{display:grid;grid-template-columns:repeat(3,62mm);grid-auto-rows:29mm;gap:2mm;break-after:page}" +
    ".p:last-child{break-after:auto}.l{outline:.2mm dashed #94a3b8}",
};

function Label({ item }: { item: InventoryItem }) {
  const patrimony = item.patrimony_number ?? "";
  return (
    <div className="l">
      <QRCodeSVG value={itemQrUrl(patrimony)} size={96} marginSize={1} role="img" aria-label={`QR Code do patrimônio ${patrimony}`} />
      <div className="t">
        <small>REMOBS</small>
        <b>{patrimony}</b>
        <span>{item.name}</span>
      </div>
    </div>
  );
}

export function LabelSheet({ items, layout }: { items: InventoryItem[]; layout: LabelLayout }) {
  const perPage = layout === "a4" ? LABELS_PER_A4 : 1;
  const pages: InventoryItem[][] = [];
  for (let start = 0; start < items.length; start += perPage) pages.push(items.slice(start, start + perPage));
  return (
    <>
      <style>{BASE_CSS + LAYOUT_CSS[layout]}</style>
      {pages.map((page, index) => (
        <div className="p" key={index}>
          {page.map((item) => (
            <Label key={item.id} item={item} />
          ))}
        </div>
      ))}
    </>
  );
}

/** Abre janela com as etiquetas e chama a impressão. Retorna false se o navegador bloquear o pop-up. */
export function printLabels(items: InventoryItem[], layout: LabelLayout): boolean {
  const labeled = items.filter((item) => item.patrimony_number);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  win.document.title = labeled.length === 1 ? labeled[0].patrimony_number! : `Etiquetas (${labeled.length})`;
  const container = win.document.createElement("div");
  win.document.body.append(container);
  flushSync(() => createRoot(container).render(<LabelSheet items={labeled} layout={layout} />));
  win.focus();
  win.print();
  return true;
}
