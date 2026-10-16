import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import type { WithdrawalOrder } from "./types";
import { purposeLabel, withdrawalCode } from "./withdrawalLabels";

const TERM_CSS =
  "@page{size:A4;margin:16mm}*{box-sizing:border-box}" +
  "body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:11pt;line-height:1.4}" +
  "h1{font-size:16pt;margin:0 0 1mm}.sub{color:#374151;margin:0 0 6mm}" +
  ".grid{display:grid;grid-template-columns:1fr 1fr;gap:1mm 8mm;margin-bottom:6mm}" +
  ".grid div{border-bottom:.2mm solid #e5e7eb;padding:1mm 0}" +
  ".grid b{display:block;font-size:8pt;color:#6b7280;font-weight:700;letter-spacing:.04em;text-transform:uppercase}" +
  "table{width:100%;border-collapse:collapse;margin-bottom:6mm}" +
  "th,td{border:.2mm solid #cbd5e1;padding:1.5mm 2mm;text-align:left;font-size:10pt}" +
  "th{background:#f1f5f9}.n{text-align:right}" +
  ".decl{margin:0 0 6mm}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:20mm}" +
  ".sig{border-top:.3mm solid #111827;padding-top:2mm;text-align:center;font-size:9pt}" +
  ".foot{margin-top:10mm;font-size:8pt;color:#6b7280}";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

function CustodyTerm({ order }: { order: WithdrawalOrder }) {
  const destino = order.platform_name ?? (order.purpose === "plataforma" ? "Plataforma" : "—");
  const fields: Array<[string, string]> = [
    ["Código do pedido", withdrawalCode(order.id)],
    ["Solicitante", order.requested_by_username],
    ["Finalidade", purposeLabel(order)],
    ["Destino", destino],
    ["Devolução prevista", order.purpose === "emprestimo" ? fmtDate(order.due_date) : "—"],
    ["Entregue por", order.delivered_by_username ?? "—"],
    ["Entregue em", fmtDate(order.delivered_at)],
    ["Emitido em", new Date().toLocaleString("pt-BR")],
  ];
  return (
    <>
      <style>{TERM_CSS}</style>
      <h1>Termo de Cautela</h1>
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
            <th>Tipo</th>
            <th className="n">Quantidade</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((line) => (
            <tr key={line.id}>
              <td>{line.item_name}</td>
              <td>{line.item_type === "permanent_component" ? "Permanente" : "Consumível"}</td>
              <td className="n">{line.custody_quantity > 0 ? line.custody_quantity : line.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="decl">
        Declaro ter recebido em cautela o material relacionado acima, comprometendo-me a zelar pela sua guarda e conservação e a
        devolvê-lo nas mesmas condições{order.purpose === "emprestimo" && order.due_date ? ` até ${fmtDate(order.due_date)}` : ""}.
      </p>
      <div className="sigs">
        <div className="sig">
          Recebedor
          <br />
          {order.requested_by_username}
        </div>
        <div className="sig">Responsável pela entrega (paiol)</div>
      </div>
      <p className="foot">Documento gerado pelo sistema REMOBS para controle de cautela de material.</p>
    </>
  );
}

/** Abre janela com o termo de cautela e chama a impressão. Retorna false se o pop-up for bloqueado. */
export function printCustodyTerm(order: WithdrawalOrder): boolean {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  win.document.title = `Termo de cautela — ${withdrawalCode(order.id)}`;
  const container = win.document.createElement("div");
  win.document.body.append(container);
  flushSync(() => createRoot(container).render(<CustodyTerm order={order} />));
  win.focus();
  win.print();
  return true;
}
