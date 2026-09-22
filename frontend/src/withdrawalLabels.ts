export function movementTypeLabel(movementType: string | undefined): string {
  switch (movementType) {
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
    withdrawal_delivered: "Material entregue",
    return_requested: "Devolução solicitada",
    return_accepted: "Devolução aceita",
    return_refused: "Devolução recusada",
    writeoff_requested: "Baixa solicitada",
    writeoff_accepted: "Baixa aceita",
    writeoff_refused: "Baixa recusada",
  };
  return labels[action] || action;
}
