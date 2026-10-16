import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { ReceivedInvoiceDetail } from "./services/inventoryService";

const TERM_CSS =
  "@page{size:A4;margin:16mm}*{box-sizing:border-box}" +
  "body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:11pt;line-height:1.4}" +
  "h1{font-size:16pt;margin:0 0 1mm}.sub{color:#374151;margin:0 0 6mm}" +
  ".grid{display:grid;grid-template-columns:1fr 1fr;gap:1mm 8mm;margin-bottom:6mm}" +
  ".grid div{border-bottom:.2mm solid #e5e7eb;padding:1mm 0}" +
  ".grid b{display:block;font-size:8pt;color:#6b7280;font-weight:700;letter-spacing:.04em;text-transform:uppercase}" +
  "table{width:100%;border-collapse:collapse;margin-bottom:6mm}" +
  "th,td{border:.2mm solid #cbd5e1;padding:1.5mm 2mm;text-align:left;font-size:10pt}" +
  "th{background:#f1f5f9}.n{text-align:right}.tot td{font-weight:700;background:#f8fafc}" +
  ".note{margin:0 0 6mm}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:20mm}" +
  ".sig{border-top:.3mm solid #111827;padding-top:2mm;text-align:center;font-size:9pt}" +
  ".foot{margin-top:10mm;font-size:8pt;color:#6b7280}";

const ORIGIN: Record<string, string> = { compra: "Compra", doacao: "Doação", transferencia: "Transferência" };
const fmtDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR") : "—");
const money = (value: number | null) => (value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

function ReceiptTerm({ invoice }: { invoice: ReceivedInvoiceDetail }) {
  const fields: Array<[string, string]> = [
    ["Nota fiscal", `${invoice.number ?? "—"}${invoice.series ? ` · série ${invoice.series}` : ""}`],
    ["Fornecedor", invoice.supplier_name ?? "—"],
    ["CNPJ", invoice.supplier_cnpj ?? "—"],
    ["Emissão", fmtDate(invoice.issue_date)],
    ["Recebida em", new Date(invoice.received_at).toLocaleString("pt-BR")],
    ["Recebido por", invoice.received_by_username],
    ["Local", invoice.location_name ?? "—"],
    ["Origem", invoice.origin ? ORIGIN[invoice.origin] ?? invoice.origin : "—"],
    ["Valor total", money(invoice.total_value)],
    ["Pedido de aquisição", invoice.acquisition_process_number ?? (invoice.acquisition_need_id ? "vinculado" : "—")],
  ];
  return (
    <>
      <style>{TERM_CSS}</style>
      <h1>Termo de Recebimento Provisório</h1>
      <p className="sub">REMOBS — Controle de Material</p>
      <div className="grid">
        {fields.map(([label, value]) => (
          <div key={label}>
            <b>{label}</b>
            {value}
          </div>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Patrimônio</th>
            <th>Tipo</th>
            <th className="n">Qtd</th>
            <th>Un.</th>
          </tr>
        </thead>
        <tbody>
          {invoice.received_items.map((item, index) => (
            <tr key={`${item.item_id}-${index}`}>
              <td>{item.name}</td>
              <td>{item.patrimony_number ?? "—"}</td>
              <td>{item.item_type === "permanent_component" ? "Permanente" : "Consumível"}</td>
              <td className="n">{item.quantity}</td>
              <td>{item.unit}</td>
            </tr>
          ))}
          <tr className="tot">
            <td colSpan={3}>Total de unidades</td>
            <td className="n">{invoice.units}</td>
            <td>un.</td>
          </tr>
        </tbody>
      </table>
      {invoice.notes ? (
        <p className="note">
          <b>Observações:</b> {invoice.notes}
        </p>
      ) : null}
      <p className="sub">
        Recebimento provisório para conferência. A aceitação definitiva ocorre após a verificação de quantidade, especificação e estado do material.
      </p>
      <div className="sigs">
        <div className="sig">
          Recebedor
          <br />
          {invoice.received_by_username}
        </div>
        <div className="sig">Responsável pela entrega</div>
      </div>
      <p className="foot">Emitido em {new Date().toLocaleString("pt-BR")}.</p>
    </>
  );
}

/** Abre janela com o termo de recebimento e chama a impressão. Retorna false se o pop-up for bloqueado. */
export function printReceiptTerm(invoice: ReceivedInvoiceDetail): boolean {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  win.document.title = `Termo de recebimento — NF ${invoice.number ?? "sem número"}`;
  const container = win.document.createElement("div");
  win.document.body.append(container);
  flushSync(() => createRoot(container).render(<ReceiptTerm invoice={invoice} />));
  win.focus();
  win.print();
  return true;
}
