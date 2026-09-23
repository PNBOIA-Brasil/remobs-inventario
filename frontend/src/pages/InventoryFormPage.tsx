import axios from "axios";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { inventoryService } from "../services/inventoryService";
import { useSnackbar } from "../state/SnackbarContext";

type SuggestionField = "name" | "brand" | "model" | "category_name" | "location_name";

const DEBOUNCE_MS = 150;

function useFieldSuggestions(field: SuggestionField, value: string) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 1) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const items = await inventoryService.suggestItemField(field, term, {
          signal: controller.signal,
        });
        if (requestId === requestIdRef.current) {
          setOptions(items);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (requestId === requestIdRef.current) {
          setOptions([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [field, value]);

  return { options, loading };
}

function LocationFieldInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    inventoryService
      .listLocations({ q: value.trim() || undefined, activeOnly: true })
      .then((data) => {
        if (!cancelled) setOptions(data.items.map((item) => item.name));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      filterOptions={(current) => current}
      inputValue={value}
      onInputChange={(_event, next, reason) => {
        if (reason === "input" || reason === "clear" || reason === "reset") {
          onChange(next);
        }
      }}
      onChange={(_event, next) => {
        onChange(typeof next === "string" ? next : next ?? "");
      }}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

function SuggestionFieldInput({
  field,
  label,
  value,
  onChange,
  required,
}: {
  field: SuggestionField;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { options, loading } = useFieldSuggestions(field, value);

  return (
    <Autocomplete
      freeSolo
      fullWidth
      options={options}
      filterOptions={(current) => current}
      inputValue={value}
      onInputChange={(_event, next, reason) => {
        if (reason === "input" || reason === "clear" || reason === "reset") {
          onChange(next);
        }
      }}
      onChange={(_event, next) => {
        onChange(typeof next === "string" ? next : next ?? "");
      }}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default function InventoryFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { showSuccess, showError } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({
    item_type: "consumable",
    name: "",
    brand: "",
    model: "",
    serial_number: "",
    patrimony_number: "",
    invoice_number: "",
    description: "",
    condition_status: "operacional",
    category_name: "Consumíveis",
    location_name: "Estoque",
    unit: "un",
    initial_quantity: "0",
    minimum_stock_national: "0",
    minimum_stock_import: "0",
    minimum_stock_maintenance: "0",
    ideal_stock: "0",
    reason: isEdit ? "Atualização cadastral." : "Cadastro inicial.",
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    inventoryService
      .getItem(id)
      .then((item) => {
        if (cancelled) return;
        setForm({
          item_type: item.item_type,
          name: item.name,
          brand: item.brand || "",
          model: item.model || "",
          serial_number: item.serial_number || "",
          patrimony_number: item.patrimony_number || "",
          invoice_number: item.invoice_number || "",
          description: item.description || "",
          condition_status: item.condition_status,
          category_name: item.category_name || "",
          location_name: item.current_location_name || "",
          unit: item.unit,
          initial_quantity: String(item.stock_total ?? 0),
          minimum_stock_national: String(item.minimum_stock_national ?? 0),
          minimum_stock_import: String(item.minimum_stock_import ?? 0),
          minimum_stock_maintenance: String(item.minimum_stock_maintenance ?? 0),
          ideal_stock: String(item.ideal_stock ?? 0),
          reason: "Atualização cadastral.",
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit && id) {
        const item = await inventoryService.updateItem(id, {
          name: form.name,
          brand: form.brand || null,
          model: form.model || null,
          serial_number: form.serial_number || null,
          invoice_number: form.invoice_number || null,
          description: form.description || null,
          condition_status: form.condition_status,
          category_name: form.category_name || undefined,
          location_name: form.location_name || undefined,
          unit: form.unit,
          minimum_stock_national: Number(form.minimum_stock_national),
          minimum_stock_import: Number(form.minimum_stock_import),
          minimum_stock_maintenance: Number(form.minimum_stock_maintenance),
          ideal_stock: Number(form.ideal_stock),
          reason: form.reason,
        });
        showSuccess("Item atualizado com sucesso.");
        navigate(`/app/inventory/${item.id}`);
      } else {
        const item = await inventoryService.createItem({
          item_type: form.item_type as "consumable" | "permanent_component",
          name: form.name,
          brand: form.brand || undefined,
          model: form.model || undefined,
          serial_number: form.serial_number || undefined,
          patrimony_number: form.patrimony_number || undefined,
          invoice_number: form.invoice_number || undefined,
          description: form.description || undefined,
          condition_status: form.condition_status,
          category_name: form.category_name,
          location_name: form.location_name,
          unit: form.unit,
          initial_quantity: Number(form.initial_quantity),
          minimum_stock_national: Number(form.minimum_stock_national),
          minimum_stock_import: Number(form.minimum_stock_import),
          minimum_stock_maintenance: Number(form.minimum_stock_maintenance),
          ideal_stock: Number(form.ideal_stock),
          reason: form.reason,
        });
        showSuccess(`Item cadastrado. Patrimônio ${item.patrimony_number}.`);
        navigate(`/app/inventory/${item.id}`);
      }
    } catch (error) {
      // Patrimônio repetido ou com prefixo reservado: a API explica o motivo.
      const message = axios.isAxiosError(error) ? error.response?.data?.error?.message : undefined;
      showError(message || (isEdit ? "Não foi possível atualizar o item." : "Não foi possível salvar o item."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState message="Carregando item..." />;
  if (loadError) return <Alert severity="error">Erro ao carregar item para edição.</Alert>;

  return (
    <Card>
      <CardContent>
        <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
          <Typography variant="h5">{isEdit ? "Editar item" : "Novo item"}</Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                select
                fullWidth
                label="Tipo"
                value={form.item_type}
                onChange={(event) => update("item_type", event.target.value)}
                disabled={isEdit}
              >
                <MenuItem value="consumable">Consumível</MenuItem>
                <MenuItem value="permanent_component">Componente permanente</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SuggestionFieldInput
                field="category_name"
                label="Categoria"
                value={form.category_name}
                onChange={(value) => update("category_name", value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <SuggestionFieldInput
                field="name"
                label="Nome"
                value={form.name}
                onChange={(value) => update("name", value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SuggestionFieldInput field="brand" label="Marca" value={form.brand} onChange={(value) => update("brand", value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <SuggestionFieldInput field="model" label="Modelo" value={form.model} onChange={(value) => update("model", value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Número de série" value={form.serial_number} onChange={(event) => update("serial_number", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={isEdit ? "Número patrimonial" : "Patrimônio (plaqueta existente)"}
                value={form.patrimony_number}
                onChange={(event) => update("patrimony_number", event.target.value)}
                disabled={isEdit}
                helperText={isEdit ? "Não muda: é o QR Code do item." : "Deixe vazio para gerar automaticamente (REM-000001)."}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Nota fiscal" value={form.invoice_number} onChange={(event) => update("invoice_number", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField select fullWidth label="Condição" value={form.condition_status} onChange={(event) => update("condition_status", event.target.value)}>
                <MenuItem value="operacional">Operacional</MenuItem>
                <MenuItem value="manutencao">Em manutenção</MenuItem>
                <MenuItem value="avariado">Avariado</MenuItem>
                <MenuItem value="reservado">Reservado</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <LocationFieldInput
                label="Local"
                value={form.location_name}
                onChange={(value) => update("location_name", value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Unidade" value={form.unit} onChange={(event) => update("unit", event.target.value)} required />
            </Grid>
            {!isEdit && (
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField fullWidth label="Quantidade inicial" type="number" value={form.initial_quantity} onChange={(event) => update("initial_quantity", event.target.value)} />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Mínimo nacional" type="number" value={form.minimum_stock_national} onChange={(event) => update("minimum_stock_national", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Mínimo importação" type="number" value={form.minimum_stock_import} onChange={(event) => update("minimum_stock_import", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField fullWidth label="Estoque ideal" type="number" value={form.ideal_stock} onChange={(event) => update("ideal_stock", event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Descrição" value={form.description} onChange={(event) => update("description", event.target.value)} multiline minRows={2} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Justificativa" value={form.reason} onChange={(event) => update("reason", event.target.value)} required multiline minRows={2} />
            </Grid>
          </Grid>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {submitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar item"}
            </Button>
            <Button variant="outlined" onClick={() => navigate(isEdit && id ? `/app/inventory/${id}` : "/app/inventory")}>
              Cancelar
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
