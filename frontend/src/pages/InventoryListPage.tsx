import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PrintIcon from "@mui/icons-material/Print";
import SearchIcon from "@mui/icons-material/Search";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import StatusChip from "../components/StatusChip";
import { itemQrUrl, printLabels } from "../labelPrint";
import { inventoryService } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { InventoryItem } from "../types";

type Filter = "todos" | "critico" | "consumable" | "permanent_component" | "avariado";

export default function InventoryListPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canDelete = hasPermission("inventory:item:delete");

  useEffect(() => {
    inventoryService
      .listItems()
      .then((data) => setItems(data.items))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        [item.name, item.brand, item.model, item.serial_number, item.patrimony_number, item.current_location_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalized));
      const isCritical = item.minimum_stock_national > 0 && item.stock_total < item.minimum_stock_national;
      const matchesFilter =
        filter === "todos" ||
        (filter === "critico" && isCritical) ||
        (filter === "avariado" && ["avariado", "inoperante", "manutencao"].includes(item.condition_status)) ||
        item.item_type === filter;
      return matchesQuery && matchesFilter;
    });
  }, [filter, items, query]);

  const filters: Array<[Filter, string]> = [
    ["todos", "Todos"],
    ["critico", "Crítico"],
    ["consumable", "Consumíveis"],
    ["permanent_component", "Permanentes"],
    ["avariado", "Avariados"],
  ];

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  function toggleItem(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Marca ou desmarca só o que a busca e o filtro mostram.
  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      filtered.forEach((item) => (allVisibleSelected ? next.delete(item.id) : next.add(item.id)));
      return next;
    });
  }

  function printSelected() {
    if (!printLabels(items.filter((item) => selected.has(item.id)), "a4")) {
      showError("Permita pop-ups deste site para imprimir as etiquetas.");
    }
  }

  async function handleDelete(item: InventoryItem) {
    const confirmed = window.confirm(`Excluir o item "${item.name}"? Esta ação inativa o item no inventário.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    try {
      await inventoryService.deleteItem(item.id, "Exclusão pela listagem do inventário.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showSuccess(`Item "${item.name}" excluído com sucesso.`);
    } catch {
      showError(`Não foi possível excluir o item "${item.name}".`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Inventário</Typography>
        {hasPermission("inventory:item:create") && (
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => navigate("/app/inventory/new")} sx={{ display: { xs: "none", sm: "inline-flex" } }}>
            Novo item
          </Button>
        )}
      </Stack>
      <TextField
        label="Buscar item, série, patrimônio ou local"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {filters.map(([value, label]) => (
          <Chip key={value} label={label} color={filter === value ? "primary" : "default"} onClick={() => setFilter(value)} />
        ))}
      </Stack>
      {items.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Button onClick={toggleVisible} disabled={filtered.length === 0}>
            {allVisibleSelected ? "Desmarcar visíveis" : "Selecionar visíveis"}
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={printSelected} disabled={selected.size === 0}>
            Imprimir etiquetas ({selected.size})
          </Button>
        </Stack>
      )}
      {loading && <LoadingState message="Carregando inventário..." />}
      {error && <Alert severity="error">Erro ao carregar inventário.</Alert>}
      {!loading && filtered.length === 0 && !error && <Alert severity="info">Nenhum item encontrado.</Alert>}
      <Stack spacing={1.5}>
        {filtered.map((item) => {
          const isCritical = item.minimum_stock_national > 0 && item.stock_total < item.minimum_stock_national;
          return (
            <Card key={item.id}>
              <Stack direction="row" alignItems="stretch">
                <Box sx={{ display: "flex", alignItems: "center", pl: 0.5 }}>
                  <Checkbox
                    checked={selected.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                    slotProps={{ input: { "aria-label": `Selecionar etiqueta de ${item.name}` } }}
                  />
                </Box>
                <CardActionArea onClick={() => navigate(`/app/inventory/${item.id}`)} sx={{ flex: 1 }}>
                  <CardContent>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        {item.patrimony_number && (
                          <QRCodeSVG
                            value={itemQrUrl(item.patrimony_number)}
                            size={56}
                            marginSize={1}
                            style={{ flexShrink: 0 }}
                            role="img"
                            aria-label={`QR Code do patrimônio ${item.patrimony_number}`}
                          />
                        )}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          {item.patrimony_number && (
                            <Typography variant="caption" color="primary" sx={{ fontFamily: "Consolas, 'Cascadia Mono', monospace", fontWeight: 700 }}>
                              {item.patrimony_number}
                            </Typography>
                          )}
                          <Typography fontWeight={700}>{item.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {[item.brand, item.model, item.current_location_name].filter(Boolean).join(" • ")}
                          </Typography>
                        </Box>
                        <StatusChip status={item.condition_status} />
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="body2">
                          Saldo total: {item.stock_total} {item.unit}
                        </Typography>
                        {isCritical && <Chip size="small" color="warning" label={`Mínimo ${item.minimum_stock_national}`} />}
                        {item.serial_number && <Chip size="small" variant="outlined" label={`Série ${item.serial_number}`} />}
                      </Stack>
                    </Stack>
                  </CardContent>
                </CardActionArea>
                {canDelete && (
                  <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
                    <IconButton
                      aria-label={`Excluir item ${item.name}`}
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
          );
        })}
      </Stack>
      {hasPermission("inventory:item:create") && (
        <Fab
          color="primary"
          onClick={() => navigate("/app/inventory/new")}
          sx={{ display: { xs: "flex", sm: "none" }, position: "fixed", bottom: 80, right: 16 }}
        >
          <AddIcon />
        </Fab>
      )}
    </Stack>
  );
}
