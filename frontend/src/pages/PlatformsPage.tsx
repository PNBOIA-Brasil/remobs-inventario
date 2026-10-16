import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Fab from "@mui/material/Fab";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import { inventoryService, type PnboiaPreviewItem } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { Platform } from "../types";

export default function PlatformsPage() {
  const [items, setItems] = useState<Platform[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PnboiaPreviewItem[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const navigate = useNavigate();
  const { hasAnyPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canCreate = hasAnyPermission("platform:create", "platform:update");
  const canDelete = hasAnyPermission("platform:delete", "platform:update");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    inventoryService
      .listPlatforms({ activeOnly })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeOnly, reloadKey]);

  async function handleDelete(item: Platform) {
    const confirmed = window.confirm(`Excluir a plataforma "${item.name}"? Esta ação remove a plataforma da listagem.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    try {
      await inventoryService.deletePlatform(item.id, "Exclusão pela listagem de plataformas.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showSuccess(`Plataforma "${item.name}" excluída com sucesso.`);
    } catch {
      showError(`Não foi possível excluir a plataforma "${item.name}".`);
    } finally {
      setDeletingId(null);
    }
  }

  async function openSync() {
    setSyncOpen(true);
    setPreview(null);
    setPreviewErrors([]);
    setPreviewLoading(true);
    try {
      const result = await inventoryService.previewPnboiaPlatforms();
      setPreview(result.items);
      setPreviewErrors(result.errors);
      setSelected(new Set(result.items.map((_item, index) => index)));
    } catch {
      showError("Não foi possível consultar a API PNBOIA agora.");
      setSyncOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }

  function togglePreview(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function confirmSync() {
    if (!preview) return;
    const chosen = preview
      .filter((_item, index) => selected.has(index))
      .map((item) => ({
        name: item.name,
        platform_type: item.platform_type,
        manufacturer: item.manufacturer,
        model: item.model,
        operational_status: item.operational_status,
        description: item.description,
      }));
    if (chosen.length === 0) return;
    setSyncing(true);
    try {
      const result = await inventoryService.syncPnboiaPlatforms(chosen);
      showSuccess(`PNBOIA sincronizada: ${result.created} nova(s), ${result.updated} atualizada(s).`);
      setSyncOpen(false);
      setReloadKey((key) => key + 1);
    } catch {
      showError("Não foi possível sincronizar as plataformas.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" useFlexGap flexWrap="wrap" gap={1}>
        <Typography variant="h5">Plataformas</Typography>
        {canCreate && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={openSync}>Sincronizar PNBOIA</Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate("/app/platforms/new")} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
              Nova plataforma
            </Button>
          </Stack>
        )}
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
            inputProps={{ "aria-label": "Somente ativas" }}
          />
        }
        label="Somente ativas"
      />
      {loading && <LoadingState message="Carregando plataformas..." />}
      {error && <Alert severity="error">Erro ao carregar plataformas.</Alert>}
      {!loading && items.length === 0 && !error && (
        <Alert severity="info">
          {activeOnly ? "Nenhuma plataforma ativa encontrada. Desmarque \"Somente ativas\" para ver as inativas." : "Nenhuma plataforma cadastrada."}
        </Alert>
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <Stack direction="row" alignItems="stretch">
            <CardActionArea onClick={() => navigate(`/app/platforms/${item.id}`)} sx={{ flex: 1 }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Typography fontWeight={700}>{item.name}</Typography>
                    <StatusChip status={item.operational_status} />
                  </Stack>
                  <Typography color="text.secondary">{[item.platform_type, item.model].filter(Boolean).join(" • ")}</Typography>
                  {item.description && (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                      {item.description.split("\n").slice(0, 4).join("\n")}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </CardActionArea>
            {canDelete && (
              <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                <IconButton
                  aria-label={`Excluir plataforma ${item.name}`}
                  color="error"
                  disabled={deletingId === item.id}
                  onClick={() => handleDelete(item)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            )}
          </Stack>
        </Card>
      ))}
      {canCreate && (
        <Fab
          aria-label="Cadastrar plataforma"
          color="primary"
          onClick={() => navigate("/app/platforms/new")}
          sx={{ display: { xs: "flex", sm: "none" }, position: "fixed", bottom: 80, right: 16 }}
        >
          <AddIcon />
        </Fab>
      )}

      <Dialog open={syncOpen} onClose={syncing ? undefined : () => setSyncOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Sincronizar com a API PNBOIA</DialogTitle>
        <DialogContent>
          {previewLoading && <LinearProgress aria-label="Consultando a API PNBOIA" />}
          {!previewLoading && preview && (
            <Stack spacing={1} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Confira as plataformas retornadas e escolha quais gravar. "Nova" é criada; "atualiza" muda tipo e status da existente de mesmo nome e só preenche fabricante, modelo e descrição vazios.
              </Typography>
              {previewErrors.length > 0 && <Alert severity="warning">{previewErrors.length} aviso(s) ao ler metadados de boias.</Alert>}
              {preview.length === 0 && <Alert severity="info">A API não retornou plataformas.</Alert>}
              {preview.map((item, index) => (
                <FormControlLabel
                  key={index}
                  control={<Checkbox checked={selected.has(index)} onChange={() => togglePreview(index)} />}
                  label={
                    <Typography variant="body2">
                      <b>{item.name}</b> — {item.exists ? "atualiza" : "nova"} · {item.platform_type} · {item.operational_status}
                    </Typography>
                  }
                />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncOpen(false)} disabled={syncing}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={confirmSync}
            disabled={syncing || previewLoading || !preview || selected.size === 0}
            loading={syncing}
            loadingPosition="start"
          >
            Confirmar e salvar ({selected.size})
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
