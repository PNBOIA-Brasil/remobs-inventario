import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { APPROVE_PERMISSIONS } from "../navigation";
import ReasonDialog from "../components/ReasonDialog";
import StatusChip from "../components/StatusChip";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { CustodyEvent, WithdrawalLine, WithdrawalOrder } from "../types";
import { auditActionLabel, isOverdue, purposeLabel } from "../withdrawalLabels";

type Decision =
  | { kind: "approve" | "reject" | "deliver" }
  | { kind: "accept" | "refuse"; eventId: string }
  | { kind: "return" | "writeoff"; line: WithdrawalLine };

function pendingQuantity(order: WithdrawalOrder, lineId: string): number {
  return order.events
    .filter((event) => event.line_id === lineId && event.status === "pending")
    .reduce((total, event) => total + event.quantity, 0);
}

export default function WithdrawalDetailPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<WithdrawalOrder | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [approveQty, setApproveQty] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, user } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  function load() {
    setLoading(true);
    inventoryService
      .getWithdrawal(id)
      .then((data) => {
        setOrder(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  const isRequester = Boolean(order && user?.id === order.requested_by_id);
  // Admin do inventário executa todo o fluxo, inclusive no próprio pedido; tudo fica no histórico.
  const isInventoryAdmin = hasAnyPermission("inventory:movement:approve");
  const canDecide = Boolean(order && (user?.id !== order.requested_by_id || isInventoryAdmin));
  // Admin do inventário pode aprovar o próprio pedido (fica registrado como autoaprovação).
  const canApprove = Boolean(
    order?.status === "pending_approval" &&
      hasAnyPermission(...APPROVE_PERMISSIONS) &&
      canDecide,
  );

  async function confirm(reason: string) {
    if (!order || !decision) return;
    try {
      if (decision.kind === "approve") {
        const lines = order.lines.map((line) => ({ line_id: line.id, quantity: Number(approveQty[line.id] ?? line.quantity) }));
        const partial = lines.some((line, index) => line.quantity !== order.lines[index].quantity);
        await inventoryService.approveWithdrawal(order.id, reason, partial ? lines : undefined);
      }
      if (decision.kind === "reject") await inventoryService.rejectWithdrawal(order.id, reason);
      if (decision.kind === "deliver") await inventoryService.deliverWithdrawal(order.id, reason);
      if (decision.kind === "accept") await inventoryService.acceptCustodyEvent(decision.eventId, reason);
      if (decision.kind === "refuse") await inventoryService.refuseCustodyEvent(decision.eventId, reason);
      if (decision.kind === "return" || decision.kind === "writeoff") {
        const payload = { quantity: Number(quantities[decision.line.id] || "1"), reason };
        if (decision.kind === "return") await inventoryService.requestReturn(order.id, decision.line.id, payload);
        if (decision.kind === "writeoff") await inventoryService.requestWriteoff(order.id, decision.line.id, payload);
      }
      showSuccess("Decisão registrada.");
      setDecision(null);
      load();
    } catch {
      showError("Não foi possível registrar a decisão.");
    }
  }

  if (loading) return <LoadingState message="Carregando pedido..." />;
  if (error || !order) return <Alert severity="error">Não foi possível carregar o pedido.</Alert>;

  const dialogTitle =
    decision?.kind === "approve" ? "Aprovar retirada" :
    decision?.kind === "reject" ? "Recusar retirada" :
    decision?.kind === "deliver" ? "Confirmar entrega" :
    decision?.kind === "accept" ? "Aceitar solicitação" :
    decision?.kind === "refuse" ? "Recusar solicitação" :
    decision?.kind === "return" ? "Solicitar devolução" :
    decision?.kind === "writeoff" ? "Solicitar baixa" :
    "Decisão";

  return (
    <Stack spacing={2}>
      <Button onClick={() => navigate("/app/movements")} sx={{ alignSelf: "flex-start" }}>Pedidos</Button>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography variant="h5">Pedido de retirada</Typography>
              <StatusChip status={order.status} />
            </Stack>
            <Typography>Solicitado por {order.requested_by_username}</Typography>
            <Typography variant="body2" fontWeight={700} color={isOverdue(order) ? "error.main" : undefined}>
              {purposeLabel(order)}
              {isOverdue(order) ? " — devolução vencida" : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">{order.reason}</Typography>
            {order.decided_by_username && (
              <Typography variant="body2">Decisão de {order.decided_by_username}: {order.decision_reason}</Typography>
            )}
            {order.delivered_by_username && (
              <Typography variant="body2">Entrega por {order.delivered_by_username}: {order.delivery_reason}</Typography>
            )}
            {order.status === "pending_approval" && !canApprove && (
              <Alert severity="info">
                {canDecide ? "Aguardando aprovação do paiol ou do admin do inventário." : "Aguardando outro aprovador: você não aprova o próprio pedido."}
              </Alert>
            )}
            {canApprove && (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={() => setDecision({ kind: "approve" })}>Aprovar</Button>
                <Button variant="outlined" color="error" onClick={() => setDecision({ kind: "reject" })}>Recusar</Button>
              </Stack>
            )}
            {order.status === "approved" && (hasPermission("inventory:withdrawal:deliver") || isInventoryAdmin) && canDecide && (
              <Button variant="contained" onClick={() => setDecision({ kind: "deliver" })}>Entregar</Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {order.lines.map((line) => {
        const waiting = pendingQuantity(order, line.id);
        const available = line.custody_quantity - waiting;
        return (
          <Card key={line.id}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" gap={1}>
                  <Typography fontWeight={700}>{line.item_name}</Typography>
                  <StatusChip status={line.status} />
                </Stack>
                <Typography variant="body2">
                  Pedido {line.quantity} • em posse {line.custody_quantity} • devolvido {line.returned_quantity} • baixado {line.written_off_quantity}
                </Typography>
                <Typography variant="body2" color="text.secondary">Origem: {line.from_location_name}</Typography>
                {canApprove && (
                  <TextField
                    label={`Aprovar de ${line.item_name}`}
                    helperText={`Pedido ${line.quantity}. Use 0 para recusar este material.`}
                    type="number"
                    value={approveQty[line.id] ?? String(line.quantity)}
                    onChange={(event) => setApproveQty((current) => ({ ...current, [line.id]: event.target.value }))}
                    slotProps={{ htmlInput: { min: 0, max: line.quantity } }}
                  />
                )}
                {order.status === "delivered" && (isRequester || isInventoryAdmin) && available > 0 && (
                  <Stack spacing={1}>
                    <TextField
                      label={`Quantidade de ${line.item_name}`}
                      type="number"
                      value={quantities[line.id] ?? "1"}
                      onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                      slotProps={{ htmlInput: { min: 1, max: available } }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button variant="outlined" onClick={() => setDecision({ kind: "return", line })}>Devolver</Button>
                      {line.item_type === "consumable" && (
                        <Button variant="outlined" color="warning" onClick={() => setDecision({ kind: "writeoff", line })}>Baixar</Button>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}

      {order.events.length > 0 && <Typography variant="h6">Devoluções e baixas</Typography>}
      {order.events.map((event: CustodyEvent) => (
        <Card key={event.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>
                  {event.event_type === "baixa" ? "Baixa" : "Devolução"} de {event.quantity} × {event.item_name}
                </Typography>
                <StatusChip status={event.status} />
              </Stack>
              <Typography variant="body2">{event.reason}</Typography>
              {event.decision_reason && (
                <Typography variant="body2" color="text.secondary">
                  {event.decided_by_username}: {event.decision_reason}
                </Typography>
              )}
              {event.status === "pending" && canDecide && (
                (isInventoryAdmin || (event.event_type === "devolucao" ? hasPermission("inventory:return:decide") : hasPermission("inventory:writeoff:decide"))) && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={() => setDecision({ kind: "accept", eventId: event.id })}>Aceitar</Button>
                    <Button variant="outlined" color="error" onClick={() => setDecision({ kind: "refuse", eventId: event.id })}>Recusar</Button>
                  </Stack>
                )
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Histórico</Typography>
            {order.audit_trail.length === 0 && <Alert severity="info">Sem eventos auditáveis neste pedido.</Alert>}
            {order.audit_trail.map((entry) => (
              <Typography key={entry.id} variant="body2">
                {new Date(entry.occurred_at).toLocaleString("pt-BR")} • {auditActionLabel(entry.action)} • {entry.actor_username || "Sistema"}
                {entry.reason ? ` • ${entry.reason}` : ""}
              </Typography>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <ReasonDialog
        open={Boolean(decision)}
        title={dialogTitle}
        confirmLabel="Confirmar"
        onClose={() => setDecision(null)}
        onConfirm={confirm}
      />
    </Stack>
  );
}
