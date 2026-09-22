import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import InventoryIcon from "@mui/icons-material/Inventory2";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import { inventoryService } from "../services/inventoryService";
import type { DashboardSummary } from "../types";

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

export default function HomePage() {
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    inventoryService
      .getDashboardSummary()
      .then((dashboardSummary) => {
        setSummary(dashboardSummary);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    ["Itens cadastrados", summary.items_registered, "inventory"],
    ["Estoque crítico", summary.critical_stock, "warning"],
    ["Solicitações pendentes", summary.pending_requests, "movement"],
    ["Plataformas em operação", summary.platforms_in_operation, "platform"],
    ["Plataformas em manutenção", summary.platforms_in_maintenance, "platform"],
    ["Sensores com alerta", summary.sensors_with_alert, "sensor"],
    ["Checklists registrados", summary.checklists_registered, "checklist"],
    ["Checklists enviados", summary.checklists_submitted, "checklist"],
    ["Pendências offline", summary.offline_pending, "sync"],
    ["Conflitos offline", summary.offline_conflicts, "sync"],
  ];

  return (
    <Stack spacing={2.5}>
      {error && <Alert severity="warning">Não foi possível carregar todos os indicadores.</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button startIcon={<AssignmentTurnedInIcon />} variant="contained" onClick={() => navigate("/app/movements/new")}>
          Solicitar retirada
        </Button>
        <Button startIcon={<FactCheckIcon />} variant="outlined" onClick={() => navigate("/app/checklists/new")}>
          Novo checklist
        </Button>
        <Button startIcon={<SyncIcon />} variant="outlined" onClick={() => navigate("/app/sync")}>
          Sincronização
        </Button>
      </Stack>

      {loading ? (
        <LoadingState message="Carregando indicadores..." />
      ) : (
        <>
      <Grid container spacing={2}>
        {cards.map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{label}</Typography>
                <Typography variant="h4">{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
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
      </Grid>
        </>
      )}
    </Stack>
  );
}
