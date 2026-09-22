import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import ReasonDialog from "../components/ReasonDialog";
import StatusChip from "../components/StatusChip";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { Movement, WithdrawalOrder } from "../types";

type PendingDecision =
  | { kind: "legacy"; id: string; action: "approve" | "reject" }
  | { kind: "withdrawal"; id: string; action: "approve" | "reject" | "deliver" };

export default function MovementsPage() {
  const [orders, setOrders] = useState<WithdrawalOrder[]>([]);
  const [legacy, setLegacy] = useState<Movement[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canRequest = hasAnyPermission("inventory:withdrawal:request", "inventory:movement:request");

  function load() {
    setLoading(true);
    Promise.all([inventoryService.listWithdrawals(), inventoryService.listMovements()])
      .then(([withdrawals, movements]) => {
        setOrders(withdrawals.items);
        setLegacy(movements.items.filter((movement) => movement.status === "pending"));
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function canDecide(order: WithdrawalOrder): boolean {
    return user?.id !== order.requested_by_id;
  }

  async function confirm(reason: string) {
    if (!pending) return;
    try {
      if (pending.kind === "legacy" && pending.action === "approve") await inventoryService.approveMovement(pending.id, reason);
      if (pending.kind === "legacy" && pending.action === "reject") await inventoryService.rejectMovement(pending.id, reason);
      if (pending.kind === "withdrawal" && pending.action === "approve") await inventoryService.approveWithdrawal(pending.id, reason);
      if (pending.kind === "withdrawal" && pending.action === "reject") await inventoryService.rejectWithdrawal(pending.id, reason);
      if (pending.kind === "withdrawal" && pending.action === "deliver") await inventoryService.deliverWithdrawal(pending.id, reason);
      showSuccess("Decisão registrada.");
      setPending(null);
      load();
    } catch {
      showError("Não foi possível registrar a decisão.");
    }
  }

  const dialogTitle =
    pending?.action === "approve" ? "Aprovar retirada" :
    pending?.action === "reject" ? "Recusar retirada" :
    pending?.action === "deliver" ? "Confirmar entrega" :
    "Decisão";

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Operação</Typography>
        {canRequest && (
          <Button variant="contained" onClick={() => navigate("/app/movements/new")}>
            Solicitar retirada
          </Button>
        )}
      </Stack>
      {loading && <LoadingState message="Carregando movimentações..." />}
      {error && <Alert severity="error">Erro ao carregar movimentações.</Alert>}
      {!loading && orders.length === 0 && legacy.length === 0 && !error && (
        <Alert severity="info">Nenhuma movimentação registrada.</Alert>
      )}
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography fontWeight={700}>{order.lines.length} material(is)</Typography>
                <StatusChip status={order.status} />
              </Stack>
              {order.lines.map((line) => (
                <Typography key={line.id} variant="body2">
                  {line.quantity} × {line.item_name} — {line.from_location_name}
                </Typography>
              ))}
              <Typography variant="body2">Solicitado por {order.requested_by_username}</Typography>
              <Typography variant="body2" color="text.secondary">{order.reason}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button onClick={() => navigate(`/app/withdrawals/${order.id}`)}>Abrir pedido</Button>
                {order.status === "pending_approval" && hasPermission("inventory:withdrawal:approve") && canDecide(order) && (
                  <>
                    <Button variant="contained" onClick={() => setPending({ kind: "withdrawal", id: order.id, action: "approve" })}>Aprovar</Button>
                    <Button variant="outlined" color="error" onClick={() => setPending({ kind: "withdrawal", id: order.id, action: "reject" })}>Recusar</Button>
                  </>
                )}
                {order.status === "approved" && hasPermission("inventory:withdrawal:deliver") && canDecide(order) && (
                  <Button variant="contained" onClick={() => setPending({ kind: "withdrawal", id: order.id, action: "deliver" })}>Entregar</Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
      {legacy.length > 0 && (
        <Typography variant="h6">Saídas antigas pendentes</Typography>
      )}
      {legacy.map((movement) => (
        <Card key={movement.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography fontWeight={700}>{movement.quantity} item(ns)</Typography>
                <StatusChip status={movement.status} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {movement.from_location_name} → {movement.to_location_name}
              </Typography>
              <Typography variant="body2">Solicitado por {movement.requested_by_username}</Typography>
              {hasPermission("inventory:movement:approve") && (
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => setPending({ kind: "legacy", id: movement.id, action: "approve" })}>Aprovar</Button>
                  <Button variant="outlined" color="error" onClick={() => setPending({ kind: "legacy", id: movement.id, action: "reject" })}>Reprovar</Button>
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
      <ReasonDialog
        open={Boolean(pending)}
        title={dialogTitle}
        confirmLabel="Confirmar"
        onClose={() => setPending(null)}
        onConfirm={confirm}
      />
    </Stack>
  );
}
