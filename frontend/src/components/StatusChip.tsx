import Chip from "@mui/material/Chip";

const labelByStatus: Record<string, string> = {
  pending: "pendente",
  pending_approval: "aguardando aprovação",
  approved: "aprovado",
  delivered: "entregue",
  closed: "encerrado",
  rejected: "recusado",
  reserved: "reservado",
  in_custody: "em posse",
  accepted: "aceito",
  refused: "recusado",
};

const colorByStatus: Record<string, "success" | "warning" | "error" | "default" | "info"> = {
  operacional: "success",
  aprovado: "success",
  approved: "success",
  delivered: "success",
  closed: "success",
  accepted: "success",
  in_custody: "info",
  pending_approval: "warning",
  reserved: "warning",
  submitted: "success",
  em_operacao: "success",
  pendente: "warning",
  pending: "warning",
  draft: "warning",
  inconsistencia: "warning",
  adjusted: "warning",
  sent_to_admin: "warning",
  manutencao: "error",
  avariado: "error",
  rejected: "error",
  refused: "error",
  discarded: "error",
  disponivel: "default",
  nao_instalado: "default",
  ativo: "success",
  inativo: "default",
};

export default function StatusChip({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <Chip
      size="small"
      color={colorByStatus[normalized] || "info"}
      label={labelByStatus[normalized] || status.replaceAll("_", " ")}
      variant={colorByStatus[normalized] === "default" ? "outlined" : "filled"}
    />
  );
}
