import type { WithdrawalOrder } from "./types";

export function movementTypeLabel(movementType: string | undefined): string {
  switch (movementType) {
    case "entrada":
      return "Entrada";
    case "reserva":
      return "Reserva";
    case "entrega":
      return "Entrega";
    case "devolucao":
      return "Devolução";
    case "baixa":
      return "Baixa";
    case "saida":
      return "Saída";
    default:
      return movementType || "Movimentação";
  }
}

export function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    withdrawal_requested: "Retirada solicitada",
    withdrawal_approved: "Retirada aprovada",
    withdrawal_rejected: "Retirada recusada",
    withdrawal_self_approved: "Retirada autoaprovada pelo admin",
    withdrawal_self_rejected: "Retirada recusada pelo próprio admin",
    withdrawal_delivered: "Material entregue",
    return_requested: "Devolução solicitada",
    return_accepted: "Devolução aceita",
    return_refused: "Devolução recusada",
    writeoff_requested: "Baixa solicitada",
    writeoff_accepted: "Baixa aceita",
    writeoff_refused: "Baixa recusada",
    receipt_registered: "Entrada registrada",
  };
  return labels[action] || action;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Texto curto da finalidade: "Consumo", "Empréstimo até 25/09/2026" ou "Plataforma Boia 01". */
export function purposeLabel(order: Pick<WithdrawalOrder, "purpose" | "due_date" | "platform_name">): string {
  if (order.purpose === "emprestimo") return order.due_date ? `Empréstimo até ${formatDate(order.due_date)}` : "Empréstimo";
  if (order.purpose === "plataforma") return order.platform_name ? `Plataforma ${order.platform_name}` : "Plataforma";
  return "Consumo";
}

/** Empréstimo entregue, ainda com material em posse e prazo anterior a hoje. */
export function isOverdue(order: WithdrawalOrder, today = new Date()): boolean {
  if (order.purpose !== "emprestimo" || !order.due_date || order.status !== "delivered") return false;
  if (!order.lines.some((line) => line.custody_quantity > 0)) return false;
  const todayIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return order.due_date < todayIso;
}
