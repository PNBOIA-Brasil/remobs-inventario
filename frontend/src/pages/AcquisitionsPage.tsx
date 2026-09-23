import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { AcquisitionNeed, AcquisitionPriority, AcquisitionStatus, InventoryItem } from "../types";

const tabs: Array<{ id: string; label: string; statuses: AcquisitionStatus[] }> = [
  { id: "sugerida", label: "Sugeridas", statuses: ["sugerida"] },
  { id: "aprovada", label: "Aprovadas", statuses: ["aprovada"] },
  { id: "em_compra", label: "Em compra", statuses: ["em_compra"] },
  { id: "encerradas", label: "Encerradas", statuses: ["atendida", "cancelada"] },
];

const priorityColor: Record<AcquisitionPriority, "error" | "warning" | "default"> = { alta: "error", media: "warning", baixa: "default" };
const priorityLabel: Record<AcquisitionPriority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
const statusLabel: Record<AcquisitionStatus, string> = {
  sugerida: "Sugerida",
  aprovada: "Aprovada",
  em_compra: "Em compra",
  atendida: "Atendida",
  cancelada: "Cancelada",
};

type Decision = { need: AcquisitionNeed; status: AcquisitionStatus; title: string };

export default function AcquisitionsPage() {
  const [needs, setNeeds] = useState<AcquisitionNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("sugerida");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [form, setForm] = useState({ reason: "", processNumber: "", expectedDate: "" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [draft, setDraft] = useState({ item: null as InventoryItem | null, quantity: "1", priority: "media" as AcquisitionPriority, reason: "" });
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canManage = hasPermission("inventory:movement:approve");

  function load() {
    setLoading(true);
    inventoryService
      .listAcquisitions()
      .then((data) => {
        setNeeds(data.items);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const activeTab = tabs.find((entry) => entry.id === tab) ?? tabs[0];
  const visible = needs.filter((need) => activeTab.statuses.includes(need.status));

  function openDecision(need: AcquisitionNeed, status: AcquisitionStatus, title: string) {
    setForm({ reason: "", processNumber: need.process_number ?? "", expectedDate: need.expected_date ?? "" });
    setDecision({ need, status, title });
  }

  async function confirmDecision() {
    if (!decision) return;
    setSaving(true);
    try {
      await inventoryService.updateAcquisition(decision.need.id, {
        status: decision.status,
        reason: form.reason.trim(),
        ...(decision.status === "em_compra" && form.processNumber.trim() ? { process_number: form.processNumber.trim() } : {}),
        ...(decision.status === "em_compra" && form.expectedDate ? { expected_date: form.expectedDate } : {}),
      });
      showSuccess(`Necessidade ${statusLabel[decision.status].toLowerCase()}.`);
      setDecision(null);
      load();
    } catch {
      showError("Não foi possível atualizar a necessidade.");
    } finally {
      setSaving(false);
    }
  }

  async function suggest() {
    setSaving(true);
    try {
      const result = await inventoryService.suggestAcquisitions();
      showSuccess(result.created ? `${result.created} sugestão(ões) nova(s).` : "Nenhum item novo abaixo do mínimo.");
      load();
    } catch {
      showError("Não foi possível gerar sugestões.");
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setDraft({ item: null, quantity: "1", priority: "media", reason: "" });
    setCreating(true);
    if (items.length === 0) inventoryService.listItems().then((data) => setItems(data.items)).catch(() => setItems([]));
  }

  async function create() {
    if (!draft.item) return;
    setSaving(true);
    try {
      await inventoryService.createAcquisition({
        item_id: draft.item.id,
        quantity: Number(draft.quantity),
        priority: draft.priority,
        reason: draft.reason.trim(),
      });
      showSuccess("Necessidade aberta.");
      setCreating(false);
      setTab("aprovada");
      load();
    } catch {
      showError("Não foi possível abrir a necessidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
        <Stack>
          <Typography variant="h5">Aquisições</Typography>
          <Typography variant="body2" color="text.secondary">
            O sistema sugere quando o saldo cai abaixo do mínimo. A entrada no paiol abate a necessidade sozinha.
          </Typography>
        </Stack>
        {canManage && (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Button variant="outlined" loading={saving} loadingPosition="start" onClick={suggest}>Gerar sugestões</Button>
            <Button variant="contained" onClick={openCreate}>Nova necessidade</Button>
          </Stack>
        )}
      </Stack>
      <Tabs value={activeTab.id} onChange={(_, value: string) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
        {tabs.map((entry) => (
          <Tab key={entry.id} value={entry.id} label={`${entry.label} (${needs.filter((need) => entry.statuses.includes(need.status)).length})`} />
        ))}
      </Tabs>
      {loading && <LoadingState message="Carregando aquisições..." />}
      {error && <Alert severity="error">Erro ao carregar aquisições.</Alert>}
      {!loading && !error && visible.length === 0 && <Alert severity="info">Nada nesta etapa.</Alert>}
      {visible.map((need) => (
        <Card key={need.id}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography fontWeight={700}>{need.item_name}</Typography>
                <Stack direction="row" spacing={0.5}>
                  <Chip size="small" color={priorityColor[need.priority]} label={priorityLabel[need.priority]} />
                  {activeTab.id === "encerradas" && <Chip size="small" variant="outlined" label={statusLabel[need.status]} />}
                </Stack>
              </Stack>
              <Typography variant="body2">
                {need.quantity} {need.item_unit} · saldo atual {need.stock_total} · {need.origin === "automatica" ? "sugerida pelo mínimo" : `aberta por ${need.created_by_username ?? "usuário"}`}
              </Typography>
              {need.received_quantity > 0 && (
                <Stack spacing={0.5}>
                  <LinearProgress variant="determinate" value={Math.min(100, (need.received_quantity / need.quantity) * 100)} />
                  <Typography variant="caption" color="text.secondary">
                    {need.received_quantity} de {need.quantity} recebidos
                  </Typography>
                </Stack>
              )}
              {(need.process_number || need.expected_date) && (
                <Typography variant="body2" color="text.secondary">
                  {need.process_number ? `Processo ${need.process_number}` : ""}
                  {need.process_number && need.expected_date ? " · " : ""}
                  {need.expected_date ? `previsão ${need.expected_date.split("-").reverse().join("/")}` : ""}
                </Typography>
              )}
              {need.reason && <Typography variant="body2" color="text.secondary">{need.reason}</Typography>}
              {canManage && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {need.status === "sugerida" && (
                    <Button variant="contained" onClick={() => openDecision(need, "aprovada", "Aprovar necessidade")}>Aprovar</Button>
                  )}
                  {need.status === "aprovada" && (
                    <Button variant="contained" onClick={() => openDecision(need, "em_compra", "Iniciar compra")}>Iniciar compra</Button>
                  )}
                  {need.status === "em_compra" && (
                    <>
                      <Button variant="contained" onClick={() => navigate("/app/receipts/new")}>Registrar entrada</Button>
                      <Button onClick={() => openDecision(need, "atendida", "Concluir sem nova entrada")}>Concluir</Button>
                    </>
                  )}
                  {["sugerida", "aprovada", "em_compra"].includes(need.status) && (
                    <Button color="error" onClick={() => openDecision(need, "cancelada", "Cancelar necessidade")}>Cancelar</Button>
                  )}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Dialog open={Boolean(decision)} onClose={saving ? undefined : () => setDecision(null)} fullWidth>
        <DialogTitle>{decision?.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {decision?.status === "em_compra" && (
              <>
                <TextField label="Número do processo" value={form.processNumber} onChange={(event) => setForm((current) => ({ ...current, processNumber: event.target.value }))} />
                <TextField
                  label="Previsão de chegada"
                  type="date"
                  value={form.expectedDate}
                  onChange={(event) => setForm((current) => ({ ...current, expectedDate: event.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}
            <TextField
              label="Motivo"
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              multiline
              minRows={2}
              required
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDecision(null)} disabled={saving}>Voltar</Button>
          <Button variant="contained" disabled={form.reason.trim().length < 3} loading={saving} loadingPosition="start" onClick={confirmDecision}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={creating} onClose={saving ? undefined : () => setCreating(false)} fullWidth>
        <DialogTitle>Nova necessidade</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Autocomplete
              options={items}
              value={draft.item}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_event, value) => setDraft((current) => ({ ...current, item: value }))}
              renderInput={(params) => <TextField {...params} label="Material" required />}
            />
            <TextField label="Quantidade" type="number" value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} slotProps={{ htmlInput: { min: 1 } }} />
            <TextField select label="Prioridade" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as AcquisitionPriority }))}>
              <MenuItem value="alta">Alta</MenuItem>
              <MenuItem value="media">Média</MenuItem>
              <MenuItem value="baixa">Baixa</MenuItem>
            </TextField>
            <TextField label="Justificativa" value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} multiline minRows={2} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreating(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" disabled={!draft.item || !(Number(draft.quantity) > 0) || draft.reason.trim().length < 3} loading={saving} loadingPosition="start" onClick={create}>
            Abrir necessidade
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
