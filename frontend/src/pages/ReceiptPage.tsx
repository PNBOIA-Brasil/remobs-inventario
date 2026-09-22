import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { inventoryService, type ReceiptPayload } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { InventoryItem, InventoryLocation } from "../types";

type Origin = ReceiptPayload["origin"];

interface ReceiptLine {
  key: number;
  item: InventoryItem | null;
  quantity: string;
}

const origins: Array<{ value: Origin; label: string }> = [
  { value: "compra", label: "Compra" },
  { value: "doacao", label: "Doação" },
  { value: "transferencia", label: "Transferência" },
];

let nextKey = 1;
const emptyLine = (item: InventoryItem | null = null): ReceiptLine => ({ key: nextKey++, item, quantity: "1" });

export default function ReceiptPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<Origin>("compra");
  const [document, setDocument] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([emptyLine()]);
  const [sending, setSending] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({ name: "", itemType: "consumable" as "consumable" | "permanent_component", unit: "un" });
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canQuickCreate = hasPermission("inventory:item:create");

  useEffect(() => {
    Promise.all([inventoryService.listItems(), inventoryService.listLocations({ activeOnly: true })])
      .then(([itemsData, locationsData]) => {
        setItems(itemsData.items);
        setLocations(locationsData.items);
        setLocationId((current) => current || locationsData.items[0]?.id || "");
      })
      .catch(() => showError("Não foi possível carregar itens e locais."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir a tela
  }, []);

  const chosen = lines.map((line) => line.item?.id).filter(Boolean);
  const validationError =
    !locationId ? "Selecione onde o material será guardado." :
    lines.some((line) => !line.item) ? "Selecione o material de cada linha." :
    lines.some((line) => !(Number(line.quantity) > 0)) ? "Informe quantidade maior que zero." :
    new Set(chosen).size !== chosen.length ? "O mesmo material aparece em mais de uma linha." :
    null;

  function updateLine(key: number, patch: Partial<ReceiptLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function createQuickItem() {
    const locationName = locations.find((entry) => entry.id === locationId)?.name;
    try {
      const created = await inventoryService.createItem({
        item_type: quick.itemType,
        name: quick.name.trim(),
        unit: quick.unit,
        location_name: locationName,
        initial_quantity: 0,
        reason: "Cadastro rápido na entrada de material.",
      });
      setItems((current) => [created, ...current]);
      setLines((current) => {
        const blank = current.find((line) => !line.item);
        return blank ? current.map((line) => (line.key === blank.key ? { ...line, item: created } : line)) : [...current, emptyLine(created)];
      });
      setQuickOpen(false);
      setQuick({ name: "", itemType: "consumable", unit: "un" });
      showSuccess("Item cadastrado e incluído na entrada.");
    } catch {
      showError("Não foi possível cadastrar o item.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (validationError || sending) return;
    setSending(true);
    try {
      const result = await inventoryService.registerReceipt({
        origin,
        location_id: locationId,
        ...(document.trim() ? { document: document.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((line) => ({ item_id: line.item!.id, quantity: Number(line.quantity) })),
      });
      showSuccess(`Entrada registrada: ${result.total_quantity} unidade(s).`);
      navigate("/app/inventory");
    } catch {
      showError("Não foi possível registrar a entrada.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <LoadingState message="Carregando itens e locais..." />;

  return (
    <>
      <Card>
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={submit}>
            <Typography variant="h5">Receber material</Typography>
            <Typography variant="body2" color="text.secondary">
              Confira o material com o documento e informe onde ele será guardado. O saldo sobe na hora.
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              color="primary"
              aria-label="Origem do material"
              value={origin}
              onChange={(_event, value: Origin | null) => value && setOrigin(value)}
            >
              {origins.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Nota fiscal ou documento" value={document} onChange={(event) => setDocument(event.target.value)} fullWidth />
              <TextField select label="Guardar em" value={locationId} onChange={(event) => setLocationId(event.target.value)} required fullWidth>
                {locations.map((location) => (
                  <MenuItem key={location.id} value={location.id}>
                    {location.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Typography fontWeight={700}>Materiais conferidos</Typography>
            {lines.map((line, index) => (
              <Stack key={line.key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={items}
                  value={line.item}
                  getOptionLabel={(option) => [option.name, option.patrimony_number].filter(Boolean).join(" · ")}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  onChange={(_event, value) => updateLine(line.key, { item: value })}
                  renderInput={(params) => <TextField {...params} label={`Material ${index + 1}`} required />}
                />
                <TextField
                  label={`Quantidade ${index + 1}`}
                  type="number"
                  value={line.quantity}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={{ width: { sm: 140 } }}
                />
                {lines.length > 1 && (
                  <Button color="error" onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}>
                    Remover
                  </Button>
                )}
              </Stack>
            ))}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button startIcon={<AddIcon />} onClick={() => setLines((current) => [...current, emptyLine()])}>
                Adicionar material
              </Button>
              {canQuickCreate ? (
                <Button onClick={() => setQuickOpen(true)}>Material sem cadastro? Cadastrar agora</Button>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                  Material sem cadastro: peça ao administrador do inventário.
                </Typography>
              )}
            </Stack>
            <TextField label="Observação" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} />
            {validationError && <Alert severity="warning">{validationError}</Alert>}
            <Button type="submit" variant="contained" disabled={Boolean(validationError) || sending}>
              Confirmar entrada
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={quickOpen} onClose={() => setQuickOpen(false)} fullWidth>
        <DialogTitle>Cadastro rápido</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Só o essencial agora. Marca, patrimônio e mínimos podem ser completados depois na ficha do item.
            </Typography>
            <TextField label="Nome do material" value={quick.name} onChange={(event) => setQuick((current) => ({ ...current, name: event.target.value }))} required autoFocus />
            <TextField
              select
              label="Tipo"
              value={quick.itemType}
              onChange={(event) => setQuick((current) => ({ ...current, itemType: event.target.value as typeof quick.itemType }))}
            >
              <MenuItem value="consumable">Consumível</MenuItem>
              <MenuItem value="permanent_component">Permanente</MenuItem>
            </TextField>
            <TextField label="Unidade" value={quick.unit} onChange={(event) => setQuick((current) => ({ ...current, unit: event.target.value }))} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={!quick.name.trim() || !quick.unit.trim()} onClick={createQuickItem}>
            Cadastrar e incluir
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
