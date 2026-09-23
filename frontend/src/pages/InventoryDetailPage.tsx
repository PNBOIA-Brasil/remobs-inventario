import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import PhotoOutlinedIcon from "@mui/icons-material/PhotoOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ItemQrLabel from "../components/ItemQrLabel";
import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import { inventoryService } from "../services/inventoryService";
import { auditActionLabel, movementTypeLabel } from "../withdrawalLabels";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { EntityFile, EntityFileRole, InventoryItem, ItemHistory } from "../types";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("image/");
}

export default function InventoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const canDelete = hasPermission("inventory:item:delete");

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<ItemHistory | null>(null);
  const [files, setFiles] = useState<EntityFile[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [uploadingRole, setUploadingRole] = useState<EntityFileRole | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<EntityFile | null>(null);

  const canUpdate = hasPermission("inventory:item:update");

  const loadFiles = useCallback(async (itemId: string) => {
    const response = await inventoryService.listItemFiles(itemId);
    setFiles(response.items);
  }, []);

  useEffect(() => {
    if (!id) return;
    Promise.all([inventoryService.getItem(id), inventoryService.getItemHistory(id), inventoryService.listItemFiles(id)])
      .then(([itemData, historyData, filesData]) => {
        setItem(itemData);
        setHistory(historyData);
        setFiles(filesData.items);
      })
      .catch(() => setError(true));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function loadPreviews() {
      const next: Record<string, string> = {};
      for (const file of files) {
        if (!isImageMime(file.mime_type) || !id) continue;
        try {
          const blob = await inventoryService.downloadItemFile(id, file.id);
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          next[file.id] = url;
        } catch {
          // Pré-visualização opcional; falha silenciosa até nova tentativa.
        }
      }
      if (!cancelled) {
        setPreviews(next);
      }
    }

    loadPreviews();
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files, id]);

  async function handleUpload(role: EntityFileRole, event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || !id) return;

    setUploadingRole(role);
    try {
      await inventoryService.uploadItemFile(id, selected, role);
      await loadFiles(id);
      showSuccess(role === "foto" ? "Foto anexada com sucesso." : "Documento anexado com sucesso.");
    } catch {
      showError(role === "foto" ? "Não foi possível enviar a foto." : "Não foi possível enviar o documento.");
    } finally {
      setUploadingRole(null);
    }
  }

  async function handleDownload(file: EntityFile) {
    if (!id) return;
    try {
      const blob = await inventoryService.downloadItemFile(id, file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.original_name;
      anchor.click();
      URL.revokeObjectURL(url);
      showSuccess("Download iniciado.");
    } catch {
      showError("Não foi possível baixar o arquivo.");
    }
  }

  async function handleInvoiceDownload(invoiceId: string) {
    try {
      const count = await inventoryService.downloadInvoice(invoiceId);
      if (count) showSuccess("Download da nota fiscal iniciado.");
      else showError("Arquivo da nota fiscal não encontrado.");
    } catch {
      showError("Não foi possível baixar a nota fiscal.");
    }
  }

  async function handleDelete(file: EntityFile) {
    if (!id || !canUpdate) return;
    const confirmed = window.confirm(`Remover o anexo "${file.original_name}"?`);
    if (!confirmed) return;

    setDeletingId(file.id);
    try {
      await inventoryService.deleteItemFile(id, file.id, "Remoção de anexo no detalhe do item.");
      await loadFiles(id);
      showSuccess("Anexo removido com sucesso.");
    } catch {
      showError("Não foi possível remover o anexo.");
    } finally {
      setDeletingId(null);
    }
  }

  if (error) return <Alert severity="error">Erro ao carregar item.</Alert>;
  if (!item) return <LoadingState message="Carregando item..." />;

  return (
    <Stack spacing={2}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/app/inventory")} sx={{ alignSelf: "flex-start" }}>
        Inventário
      </Button>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography variant="h5">{item.name}</Typography>
              <StatusChip status={item.condition_status} />
            </Stack>
            <Typography color="text.secondary">{[item.brand, item.model, item.category_name].filter(Boolean).join(" • ")}</Typography>
            <Typography>
              Saldo total: {item.stock_total} {item.unit}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
              <Button startIcon={<AssignmentTurnedInIcon />} variant="contained" onClick={() => navigate("/app/movements/new", { state: { itemId: item.id } })}>
                Solicitar retirada
              </Button>
              {canUpdate && (
                <Button variant="outlined" onClick={() => navigate(`/app/inventory/${item.id}/edit`)}>
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={async () => {
                    const confirmed = window.confirm(`Excluir o item "${item.name}"? Esta ação inativa o item no inventário.`);
                    if (!confirmed) return;
                    try {
                      await inventoryService.deleteItem(item.id, "Exclusão pelo detalhe do item.");
                      showSuccess(`Item "${item.name}" excluído com sucesso.`);
                      navigate("/app/inventory");
                    } catch {
                      showError(`Não foi possível excluir o item "${item.name}".`);
                    }
                  }}
                >
                  Excluir
                </Button>
              )}
              {canUpdate && (
                <>
                  <Button
                    variant="outlined"
                    startIcon={uploadingRole === "foto" ? <CircularProgress size={16} /> : <PhotoOutlinedIcon />}
                    disabled={uploadingRole !== null}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Anexar foto
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={uploadingRole === "documento" ? <CircularProgress size={16} /> : <InsertDriveFileOutlinedIcon />}
                    disabled={uploadingRole !== null}
                    onClick={() => documentInputRef.current?.click()}
                  >
                    Anexar documento
                  </Button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => handleUpload("foto", event)}
                  />
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                    hidden
                    onChange={(event) => handleUpload("documento", event)}
                  />
                </>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <ItemQrLabel item={item} />

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">Anexos</Typography>
            {files.length === 0 && <Alert severity="info">Nenhum arquivo anexado a este item.</Alert>}
            {files.length > 0 && (
              <Grid container spacing={2}>
                {files.map((file) => (
                  <Grid key={file.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack spacing={1}>
                          {isImageMime(file.mime_type) && previews[file.id] ? (
                            <Box
                              component="img"
                              src={previews[file.id]}
                              alt={file.original_name}
                              role="button"
                              tabIndex={0}
                              aria-label={`Visualizar ${file.original_name}`}
                              onClick={() => setViewingFile(file)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setViewingFile(file);
                                }
                              }}
                              sx={{
                                width: "100%",
                                height: 140,
                                objectFit: "cover",
                                borderRadius: 1,
                                cursor: "pointer",
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                height: 140,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: "action.hover",
                                borderRadius: 1,
                              }}
                            >
                              {file.file_role === "foto" ? <PhotoOutlinedIcon fontSize="large" /> : <InsertDriveFileOutlinedIcon fontSize="large" />}
                            </Box>
                          )}
                          <Typography variant="subtitle2" noWrap title={file.original_name}>
                            {file.original_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {file.file_role} • {formatBytes(file.size_bytes)} • {new Date(file.created_at).toLocaleString("pt-BR")}
                          </Typography>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {isImageMime(file.mime_type) ? (
                              <IconButton
                                aria-label={`Visualizar ${file.original_name}`}
                                onClick={() => setViewingFile(file)}
                                size="small"
                                disabled={!previews[file.id]}
                              >
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            ) : (
                              <IconButton aria-label={`Baixar ${file.original_name}`} onClick={() => handleDownload(file)} size="small">
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            )}
                            {canUpdate && (
                              <IconButton
                                aria-label={`Remover ${file.original_name}`}
                                onClick={() => handleDelete(file)}
                                disabled={deletingId === file.id}
                                size="small"
                                color="error"
                              >
                                {deletingId === file.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6">Identificação</Typography>
              <List dense>
                <ListItem disableGutters>
                  <ListItemText primary="Número de série" secondary={item.serial_number || "Não informado"} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary="Patrimônio" secondary={item.patrimony_number || "Não informado"} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary="Nota fiscal" secondary={item.invoice_number || "Não informado"} />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText primary="Descrição" secondary={item.description || "Sem descrição"} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6">Saldos por local</Typography>
              <List dense>
                {item.balances.map((balance) => (
                  <ListItem key={balance.id} disableGutters>
                    <ListItemText primary={balance.location_name} secondary={`${balance.quantity} ${item.unit} (${balance.reserved_quantity} reservado)`} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Histórico</Typography>
            {!history && <Alert severity="info">Histórico não carregado.</Alert>}
            {history?.movements.length === 0 && history.audit_logs.length === 0 && <Alert severity="info">Sem histórico para este item.</Alert>}
            {history?.movements.slice(0, 8).map((movement) => (
              <Stack key={movement.id} direction="row" justifyContent="space-between" gap={1}>
                <Typography>
                  {movementTypeLabel(movement.movement_type)}: {movement.quantity} {item.unit} de {movement.from_location_name || "origem"}
                  {movement.to_location_name ? ` para ${movement.to_location_name}` : ""}
                </Typography>
                <Stack direction="row" alignItems="center" gap={1}>
                  {movement.invoice_id && (
                    <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleInvoiceDownload(movement.invoice_id!)}>
                      Nota fiscal
                    </Button>
                  )}
                  <StatusChip status={movement.status} />
                </Stack>
              </Stack>
            ))}
            {history?.audit_logs.slice(0, 8).map((log) => (
              <Typography key={log.id} variant="body2" color="text.secondary">
                {new Date(log.occurred_at).toLocaleString("pt-BR")} • {auditActionLabel(log.action)} • {log.actor_username || "Sistema"}
                {log.reason ? ` • ${log.reason}` : ""}
              </Typography>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={Boolean(viewingFile)} onClose={() => setViewingFile(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {viewingFile?.original_name || "Visualizar imagem"}
          <IconButton
            aria-label="Fechar visualização"
            onClick={() => setViewingFile(null)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {viewingFile && previews[viewingFile.id] ? (
            <Box
              component="img"
              src={previews[viewingFile.id]}
              alt={viewingFile.original_name}
              sx={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block", mx: "auto" }}
            />
          ) : (
            <Alert severity="info">Pré-visualização indisponível.</Alert>
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
