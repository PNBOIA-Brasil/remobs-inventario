import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import ReasonDialog from "../components/ReasonDialog";
import StatusChip from "../components/StatusChip";
import { APPROVE_PERMISSIONS, PAIOL_PERMISSIONS, REQUEST_PERMISSIONS } from "../navigation";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { Movement, WithdrawalOrder } from "../types";
import { isOverdue, purposeLabel } from "../withdrawalLabels";

type PendingDecision =
  | { kind: "legacy"; id: string; action: "approve" | "reject" }
  | { kind: "withdrawal"; id: string; action: "approve" | "reject" | "deliver" };

interface OrderTab {
  id: string;
  label: string;
  orders: WithdrawalOrder[];
}

const OPEN_STATUSES = ["pending_approval", "approved", "delivered"];

export default function MovementsPage() {
  const [orders, setOrders] = useState<WithdrawalOrder[]>([]);
  const [legacy, setLegacy] = useState<Movement[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canRequest = hasAnyPermission(...REQUEST_PERMISSIONS);
  const isPaiol = hasAnyPermission(...PAIOL_PERMISSIONS);

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

  // Admin do inventário pode aprovar o próprio pedido (fica registrado como autoaprovação).
  const isInventoryAdmin = hasAnyPermission("inventory:movement:approve");
  const canApprove = (order: WithdrawalOrder) =>
    order.status === "pending_approval" && hasAnyPermission(...APPROVE_PERMISSIONS) && (canDecide(order) || isInventoryAdmin);

  const mine = orders.filter((order) => order.requested_by_id === user?.id);
  const others = orders.filter((order) => order.requested_by_id !== user?.id);
  const hasPendingEvent = (order: WithdrawalOrder) => order.events.some((event) => event.status === "pending");
  const tabs: OrderTab[] = [
    ...(isPaiol
      ? [
          { id: "aprovar", label: "Aprovar", orders: orders.filter(canApprove) },
          { id: "entregar", label: "Entregar", orders: others.filter((order) => order.status === "approved") },
          { id: "devolucoes", label: "Devoluções", orders: others.filter(hasPendingEvent) },
        ]
      : []),
    ...(canRequest
      ? [
          { id: "meus", label: "Meus pedidos", orders: mine.filter((order) => OPEN_STATUSES.includes(order.status)) },
          {
            id: "comigo",
            label: "Comigo",
            orders: mine.filter((order) => order.status === "delivered" && order.lines.some((line) => line.custody_quantity > 0)),
          },
        ]
      : []),
    { id: "todos", label: "Todos", orders },
  ];
  const activeTab = tabs.find((tab) => tab.id === searchParams.get("tab")) ?? tabs[0];

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
    pending?.action === "approve" ? "Aprovar pedido inteiro" :
    pending?.action === "reject" ? "Recusar pedido" :
    pending?.action === "deliver" ? "Confirmar entrega" :
    "Decisão";

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="h5">Pedidos</Typography>
        {canRequest && (
          <Button variant="contained" onClick={() => navigate("/app/movements/new")}>
            Solicitar retirada
          </Button>
        )}
      </Stack>
      <Tabs
        value={activeTab.id}
        onChange={(_, value: string) => setSearchParams({ tab: value }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            value={tab.id}
            label={
              tab.id === "todos" || tab.orders.length === 0 ? (
                tab.label
              ) : (
                <Badge color="warning" badgeContent={tab.orders.length} sx={{ "& .MuiBadge-badge": { right: -12 } }}>
                  {tab.label}
                </Badge>
              )
            }
          />
        ))}
      </Tabs>
      {loading && <LoadingState message="Carregando pedidos..." />}
      {error && <Alert severity="error">Erro ao carregar pedidos.</Alert>}
      {!loading && activeTab.orders.length === 0 && !error && <Alert severity="info">Nada nesta fila.</Alert>}
      {activeTab.orders.map((order) => (
        <Card key={order.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography fontWeight={700}>{order.lines.length} material(is)</Typography>
                <StatusChip status={order.status} />
              </Stack>
              {order.lines.map((line) => (
                <Typography key={line.id} variant="body2" color={line.status === "rejected" ? "text.secondary" : undefined}>
                  {line.quantity} × {line.item_name} — {line.from_location_name}
                  {line.status === "rejected" ? " (recusado)" : ""}
                </Typography>
              ))}
              <Typography variant="body2">Solicitado por {order.requested_by_username}</Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={purposeLabel(order)} />
                {isOverdue(order) && <Chip size="small" color="error" label="Devolução vencida" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">{order.reason}</Typography>
              {hasPendingEvent(order) && <Alert severity="warning">Devolução ou baixa aguardando conferência.</Alert>}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button onClick={() => navigate(`/app/withdrawals/${order.id}`)}>Abrir pedido</Button>
                {order.status === "pending_approval" && !canApprove(order) && (
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                    {canDecide(order) ? "Aguardando o paiol ou o admin do inventário." : "Aguardando outro aprovador: você não aprova o próprio pedido."}
                  </Typography>
                )}
                {canApprove(order) && (
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
      {activeTab.id === "todos" && legacy.length > 0 && (
        <Typography variant="h6">Saídas antigas pendentes</Typography>
      )}
      {activeTab.id === "todos" && legacy.map((movement) => (
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
