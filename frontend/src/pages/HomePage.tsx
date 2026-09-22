import AssignmentReturnIcon from "@mui/icons-material/AssignmentReturn";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import InventoryIcon from "@mui/icons-material/Inventory2";
import OutboxIcon from "@mui/icons-material/Outbox";
import type { SvgIconComponent } from "@mui/icons-material";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import { PAIOL_PERMISSIONS, REQUEST_PERMISSIONS } from "../navigation";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import type { DashboardSummary, WithdrawalOrder } from "../types";
import { isOverdue, purposeLabel } from "../withdrawalLabels";

const initialSummary: DashboardSummary = {
  items_registered: 0,
  critical_stock: 0,
  pending_requests: 0,
  platforms_in_operation: 0,
  platforms_in_maintenance: 0,
  sensors_with_alert: 0,
  checklists_registered: 0,
  checklists_submitted: 0,
  offline_pending: 0,
  offline_conflicts: 0,
  critical_alerts: [],
  critical_stock_items: [],
};

interface Action {
  label: string;
  hint: string;
  path: string;
  icon: SvgIconComponent;
  primary?: boolean;
}

function ActionTile({ action }: { action: Action }) {
  const navigate = useNavigate();
  const Icon = action.icon;
  return (
    <Card sx={action.primary ? { bgcolor: "primary.main", color: "primary.contrastText", borderColor: "primary.main" } : undefined}>
      <CardActionArea onClick={() => navigate(action.path)} sx={{ height: "100%" }}>
        <CardContent sx={{ minHeight: 104, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 1.5 }}>
          <Icon />
          <Box>
            <Typography fontWeight={700}>{action.label}</Typography>
            <Typography variant="body2" sx={{ opacity: action.primary ? 0.9 : 0.75 }}>
              {action.hint}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function QueueCard({ title, count, hint, path }: { title: string; count: number; hint: string; path: string }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardActionArea onClick={() => navigate(path)}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box>
              <Typography fontWeight={700}>{title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {hint}
              </Typography>
            </Box>
            <Typography variant="h4" color={count > 0 ? "warning.main" : "text.secondary"}>
              {count}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function HomePage() {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const canRequest = hasAnyPermission(...REQUEST_PERMISSIONS);
  const isPaiol = hasAnyPermission(...PAIOL_PERMISSIONS);
  const canReadStock = hasPermission("inventory:item:read");
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [orders, setOrders] = useState<WithdrawalOrder[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      canReadStock ? inventoryService.getDashboardSummary() : Promise.resolve(initialSummary),
      canRequest || isPaiol ? inventoryService.listWithdrawals() : Promise.resolve({ items: [], total: 0 }),
    ])
      .then(([dashboardSummary, withdrawals]) => {
        setSummary(dashboardSummary);
        setOrders(withdrawals.items);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [canReadStock, canRequest, isPaiol]);

  const mine = orders.filter((order) => order.requested_by_id === user?.id);
  const custody = mine
    .filter((order) => order.status === "delivered")
    .flatMap((order) => order.lines.filter((line) => line.custody_quantity > 0).map((line) => ({ order, line })));
  const openMine = mine.filter((order) => order.status === "pending_approval" || order.status === "approved");
  const others = orders.filter((order) => order.requested_by_id !== user?.id);
  const toApprove = others.filter((order) => order.status === "pending_approval").length;
  const toDeliver = others.filter((order) => order.status === "approved").length;
  const overdue = others.filter((order) => isOverdue(order)).length;

  const actions: Action[] = [
    ...(canRequest
      ? [
          { label: "Retirar material", hint: "Uso, consumo ou empréstimo", path: "/app/movements/new", icon: OutboxIcon, primary: true },
          {
            label: "Devolver",
            hint: custody.length > 0 ? `${custody.length} material(is) com você` : "Nada com você agora",
            path: "/app/movements?tab=comigo",
            icon: AssignmentReturnIcon,
          },
        ]
      : []),
    ...(hasPermission("checklist:submit")
      ? [{ label: "Novo checklist", hint: "Inspeção de plataforma", path: "/app/checklists/new", icon: FactCheckIcon }]
      : []),
    ...(canReadStock ? [{ label: "Consultar estoque", hint: "Saldo por local", path: "/app/inventory", icon: InventoryIcon }] : []),
  ];

  const metrics = [
    ["Itens cadastrados", summary.items_registered],
    ["Estoque crítico", summary.critical_stock],
    ["Solicitações pendentes", summary.pending_requests],
    ["Plataformas em operação", summary.platforms_in_operation],
    ["Plataformas em manutenção", summary.platforms_in_maintenance],
    ["Sensores com alerta", summary.sensors_with_alert],
    ["Checklists registrados", summary.checklists_registered],
    ["Checklists enviados", summary.checklists_submitted],
    ["Pendências offline", summary.offline_pending],
    ["Conflitos offline", summary.offline_conflicts],
  ] as const;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Olá, {user?.username || "usuário"}</Typography>
        <Typography color="text.secondary">O que você vai fazer agora?</Typography>
      </Box>

      {error && <Alert severity="warning">Não foi possível carregar todos os dados do início.</Alert>}

      {actions.length > 0 && (
        <Grid container spacing={1.5}>
          {actions.map((action) => (
            <Grid key={action.label} size={{ xs: 6, md: 3 }}>
              <ActionTile action={action} />
            </Grid>
          ))}
        </Grid>
      )}

      {loading ? (
        <LoadingState message="Carregando o início..." />
      ) : (
        <>
          {isPaiol && (
            <Stack spacing={1}>
              <Typography variant="h6">Precisa de você</Typography>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <QueueCard title="Aprovar pedidos" count={toApprove} hint="Aguardando decisão do paiol" path="/app/movements?tab=aprovar" />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <QueueCard title="Entregar no balcão" count={toDeliver} hint="Aprovados, aguardando retirada" path="/app/movements?tab=entregar" />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <QueueCard title="Empréstimos vencidos" count={overdue} hint="Prazo de devolução passou" path="/app/movements?tab=todos" />
                </Grid>
              </Grid>
            </Stack>
          )}

          {canRequest && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Typography variant="h6">Com você agora</Typography>
                      {custody.length === 0 && <Typography color="text.secondary">Nenhum material sob sua responsabilidade.</Typography>}
                      {custody.map(({ order, line }) => (
                        <CardActionArea key={line.id} onClick={() => navigate(`/app/withdrawals/${order.id}`)} sx={{ borderRadius: 1, p: 0.5 }}>
                          <Stack direction="row" justifyContent="space-between" gap={1}>
                            <Stack>
                              <Typography>{line.item_name}</Typography>
                              <Typography variant="body2" color={isOverdue(order) ? "error.main" : "text.secondary"}>
                                {purposeLabel(order)}
                                {isOverdue(order) ? " — vencido" : ""}
                              </Typography>
                            </Stack>
                            <Typography color="text.secondary">{line.custody_quantity}</Typography>
                          </Stack>
                        </CardActionArea>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Typography variant="h6">Seus pedidos em andamento</Typography>
                      {openMine.length === 0 && <Typography color="text.secondary">Nenhum pedido em andamento.</Typography>}
                      {openMine.map((order) => (
                        <CardActionArea key={order.id} onClick={() => navigate(`/app/withdrawals/${order.id}`)} sx={{ borderRadius: 1, p: 0.5 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                            <Typography>{order.lines.length} material(is)</Typography>
                            <StatusChip status={order.status} />
                          </Stack>
                        </CardActionArea>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {canReadStock && (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography variant="h6">Estoque crítico</Typography>
                        {summary.critical_stock_items.length === 0 && <Alert severity="success">Sem item abaixo do mínimo nacional.</Alert>}
                        {summary.critical_stock_items.map((item) => (
                          <Stack key={item.id} direction="row" justifyContent="space-between" gap={1}>
                            <Stack>
                              <Typography>{item.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.stock_total} {item.unit} de mínimo {item.minimum_stock_national}
                              </Typography>
                            </Stack>
                            <InventoryIcon color="warning" />
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography variant="h6">Alertas críticos</Typography>
                        {summary.critical_alerts.length === 0 && <Alert severity="success">Nenhum alerta ativo.</Alert>}
                        {summary.critical_alerts.map((alert) => (
                          <Stack key={alert.id} direction="row" justifyContent="space-between" gap={1}>
                            <Typography>{alert.title}</Typography>
                            <StatusChip status={alert.severity} />
                          </Stack>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Stack spacing={1}>
                <Typography variant="h6">Indicadores</Typography>
                <Grid container spacing={1.5}>
                  {metrics.map(([label, value]) => (
                    <Grid key={label} size={{ xs: 6, sm: 4, md: 3 }}>
                      <Card>
                        <CardContent>
                          <Typography variant="body2" color="text.secondary">
                            {label}
                          </Typography>
                          <Typography variant="h5">{value}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Stack>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
