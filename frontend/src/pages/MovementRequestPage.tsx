import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import Autocomplete from "@mui/material/Autocomplete";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { inventoryService } from "../services/inventoryService";
import { useSnackbar } from "../state/SnackbarContext";
import type { InventoryItem, InventoryLocation, StockBalance } from "../types";

const draftKey = "remobs_withdrawal_request_draft";
const legacyDraftKey = "remobs_movement_request_draft";

interface LineDraft {
  key: string;
  itemId: string;
  fromLocationId: string;
  quantity: string;
}

interface DraftState {
  lines: LineDraft[];
  reason: string;
  evidenceNote: string;
}

function lineKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `linha-${crypto.randomUUID()}`;
  return `linha-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: partial?.key || lineKey(),
    itemId: partial?.itemId || "",
    fromLocationId: partial?.fromLocationId || "",
    quantity: partial?.quantity || "1",
  };
}

const defaultDraft: DraftState = {
  lines: [newLine({ key: "linha-1" })],
  reason: "Uso em operação de campo.",
  evidenceNote: "",
};

function availableQty(balance: StockBalance): number {
  return balance.quantity - balance.reserved_quantity;
}

function availableAtLocation(item: InventoryItem | undefined | null, locationId: string): number {
  const balance = item?.balances.find((entry) => entry.location_id === locationId);
  return balance ? availableQty(balance) : 0;
}

/** Prefere o Local cadastrado no item; senão o primeiro saldo com estoque. */
export function resolveOriginLocationId(item: InventoryItem | undefined | null): string {
  if (item?.current_location_id) return item.current_location_id;

  const withStock = item?.balances.find((balance) => availableQty(balance) > 0);
  if (withStock) return withStock.location_id;

  return item?.balances[0]?.location_id || "";
}

export function originLocationOptions(
  locations: InventoryLocation[],
  item: InventoryItem | undefined | null,
): InventoryLocation[] {
  const options = [...locations];
  if (item?.current_location_id && !options.some((entry) => entry.id === item.current_location_id)) {
    options.unshift({
      id: item.current_location_id,
      name: item.current_location_name || "Local atual",
      location_type: "estoque",
      is_active: true,
      created_at: item.updated_at || item.created_at || "",
    });
  }
  return options;
}

function readInitialDraft(): DraftState {
  const saved = localStorage.getItem(draftKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as Partial<DraftState>;
      if (Array.isArray(parsed.lines) && parsed.lines.length > 0) {
        return {
          lines: parsed.lines.map((line) => newLine(line)),
          reason: parsed.reason || defaultDraft.reason,
          evidenceNote: parsed.evidenceNote || "",
        };
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }

  const legacy = localStorage.getItem(legacyDraftKey);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as {
        itemId?: string;
        fromLocationId?: string;
        quantity?: string;
        reason?: string;
        evidenceNote?: string;
      };
      return {
        lines: [newLine({ key: "linha-1", itemId: parsed.itemId, fromLocationId: parsed.fromLocationId, quantity: parsed.quantity })],
        reason: parsed.reason || defaultDraft.reason,
        evidenceNote: parsed.evidenceNote || "",
      };
    } catch {
      localStorage.removeItem(legacyDraftKey);
    }
  }

  return { ...defaultDraft, lines: [newLine({ key: "linha-1" })] };
}

export default function MovementRequestPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [draft, setDraft] = useState<DraftState>(readInitialDraft);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError, showInfo } = useSnackbar();
  const stateItemId = (location.state as { itemId?: string } | null)?.itemId;

  useEffect(() => {
    Promise.all([
      inventoryService.listItems(),
      inventoryService.listLocations({ activeOnly: true }),
      stateItemId ? inventoryService.getItem(stateItemId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([itemsData, locationsData, detailedItem]) => {
        const mergedItems =
          detailedItem && !itemsData.items.some((item) => item.id === detailedItem.id)
            ? [detailedItem, ...itemsData.items]
            : itemsData.items;
        setItems(mergedItems);
        setLocations(locationsData.items);
        setDraft((current) => {
          const first = current.lines[0] || newLine({ key: "linha-1" });
          const preferredItemId = detailedItem?.id || stateItemId || first.itemId || mergedItems[0]?.id || "";
          const preferredItem = detailedItem || mergedItems.find((item) => item.id === preferredItemId) || mergedItems[0];
          const itemChanged = Boolean(stateItemId) || first.itemId !== (preferredItem?.id || "");
          const nextOrigin =
            itemChanged || !first.fromLocationId ? resolveOriginLocationId(preferredItem) : first.fromLocationId;
          return {
            ...current,
            lines: [{ ...first, itemId: preferredItem?.id || "", fromLocationId: nextOrigin }, ...current.lines.slice(1)],
          };
        });
      })
      .catch(() => undefined)
      .finally(() => setLoadingItems(false));
  }, [stateItemId]);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft]);

  const lineErrors = useMemo(() => {
    return draft.lines.map((line) => {
      const selected = items.find((item) => item.id === line.itemId);
      const quantity = Number(line.quantity);
      const available = availableAtLocation(selected, line.fromLocationId);
      if (!selected) return "Selecione um material.";
      if (!line.fromLocationId) return "Selecione uma origem.";
      if (quantity <= 0) return "Informe quantidade maior que zero.";
      if (quantity > available) return "Quantidade maior que o estoque disponível.";
      const duplicate = draft.lines.filter(
        (candidate) => candidate.itemId === line.itemId && candidate.fromLocationId === line.fromLocationId,
      );
      if (duplicate.length > 1) return "Este material já está na lista com a mesma origem.";
      return null;
    });
  }, [draft.lines, items]);

  const validationError =
    draft.lines.length < 1 ? "Inclua ao menos um material." :
    lineErrors.find(Boolean) ||
    (draft.reason.trim().length < 3 ? "Informe o motivo da retirada." : null);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  }

  function addLine() {
    setDraft((current) => {
      const used = new Set(current.lines.map((line) => line.itemId));
      const nextItem = items.find((item) => !used.has(item.id)) || items[0];
      return {
        ...current,
        lines: [
          ...current.lines,
          newLine({
            itemId: nextItem?.id || "",
            fromLocationId: resolveOriginLocationId(nextItem),
          }),
        ],
      };
    });
  }

  async function sendRequest() {
    if (validationError) return;
    try {
      await inventoryService.requestWithdrawal({
        reason: [draft.reason.trim(), draft.evidenceNote && `Evidência: ${draft.evidenceNote.trim()}`].filter(Boolean).join("\n"),
        lines: draft.lines.map((line) => ({
          item_id: line.itemId,
          quantity: Number(line.quantity),
          from_location_id: line.fromLocationId,
        })),
      });
      localStorage.removeItem(draftKey);
      localStorage.removeItem(legacyDraftKey);
      showSuccess("Solicitação de retirada registrada.");
      navigate("/app/movements");
    } catch {
      showError("Não foi possível solicitar a retirada.");
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validationError) setConfirmOpen(true);
  }

  if (loadingItems) return <LoadingState message="Carregando itens..." />;

  return (
    <>
      <Card>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <Typography variant="h5">Solicitar retirada</Typography>
            <Typography variant="body2" color="text.secondary">
              Inclua um ou mais materiais. O paiol aprova e entrega. A quantidade fica reservada até a decisão.
            </Typography>
            {validationError && <Alert severity="warning">{validationError}</Alert>}
            {draft.lines.map((line, index) => {
              const selected = items.find((item) => item.id === line.itemId);
              const originOptions = originLocationOptions(locations, selected);
              const selectedOrigin = originOptions.find((entry) => entry.id === line.fromLocationId) || null;
              const quantity = Number(line.quantity);
              return (
                <Stack key={line.key} spacing={1.5} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>Material {index + 1}</Typography>
                    {draft.lines.length > 1 && (
                      <Button color="error" onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((entry) => entry.key !== line.key) }))}>
                        Remover
                      </Button>
                    )}
                  </Stack>
                  <TextField
                    select
                    label={index === 0 ? "Item" : `Item ${index + 1}`}
                    value={line.itemId}
                    onChange={(event) => {
                      const item = items.find((candidate) => candidate.id === event.target.value);
                      updateLine(line.key, {
                        itemId: event.target.value,
                        fromLocationId: resolveOriginLocationId(item),
                      });
                    }}
                    required
                  >
                    {items.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name} ({item.stock_total} {item.unit})
                      </MenuItem>
                    ))}
                  </TextField>
                  <Autocomplete
                    options={originOptions}
                    value={selectedOrigin}
                    getOptionLabel={(option) => `${option.name} (${availableAtLocation(selected, option.id)} disponível)`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_event, value) => updateLine(line.key, { fromLocationId: value?.id || "" })}
                    renderInput={(params) => <TextField {...params} label={index === 0 ? "Origem" : `Origem ${index + 1}`} required />}
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton aria-label={`Diminuir quantidade do material ${index + 1}`} onClick={() => updateLine(line.key, { quantity: String(Math.max(1, quantity - 1)) })}>
                      <RemoveIcon />
                    </IconButton>
                    <TextField
                      label="Quantidade"
                      type="number"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                      required
                    />
                    <IconButton aria-label={`Aumentar quantidade do material ${index + 1}`} onClick={() => updateLine(line.key, { quantity: String(quantity + 1) })}>
                      <AddIcon />
                    </IconButton>
                  </Stack>
                </Stack>
              );
            })}
            <Button startIcon={<AddIcon />} onClick={addLine} disabled={items.length === 0}>
              Adicionar material
            </Button>
            <TextField label="Justificativa" value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} multiline minRows={2} required />
            <TextField label="Evidência ou observação" value={draft.evidenceNote} onChange={(event) => setDraft((current) => ({ ...current, evidenceNote: event.target.value }))} multiline minRows={2} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  localStorage.setItem(draftKey, JSON.stringify(draft));
                  showInfo("Rascunho salvo neste dispositivo.");
                }}
              >
                Salvar rascunho
              </Button>
              <Button type="submit" variant="contained" disabled={Boolean(validationError)}>
                Enviar solicitação
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth>
        <DialogTitle>Confirmar retirada</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {draft.lines.map((line) => {
              const selected = items.find((item) => item.id === line.itemId);
              return (
                <Typography key={line.key}>
                  {line.quantity} {selected?.unit} de {selected?.name}
                </Typography>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={sendRequest}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
