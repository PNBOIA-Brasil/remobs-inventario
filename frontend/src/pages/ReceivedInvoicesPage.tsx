import DownloadIcon from "@mui/icons-material/Download";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SearchIcon from "@mui/icons-material/Search";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { RECEIPT_PERMISSIONS } from "../navigation";
import { inventoryService, type ReceivedInvoice, type ReceivedInvoiceDetail } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";

const ORIGIN_LABEL: Record<string, string> = { compra: "Compra", doacao: "Doação", transferencia: "Transferência" };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
const plain = (text: string | null) => (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ReceivedInvoicesPage() {
  const [invoices, setInvoices] = useState<ReceivedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<Record<string, ReceivedInvoiceDetail | "loading">>({});
  const { hasAnyPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    inventoryService
      .listReceivedInvoices()
      .then((data) => setInvoices(data.items))
      .catch(() => showError("Não foi possível carregar as notas fiscais."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez ao abrir a tela
  }, []);

  const visible = useMemo(() => {
    const term = plain(search.trim());
    const digits = term.replace(/\D/g, "");
    if (!term) return invoices;
    return invoices.filter(
      (invoice) =>
        plain(invoice.supplier_name).includes(term) ||
        plain(invoice.number).includes(term) ||
        (digits.length > 0 && [invoice.number, invoice.supplier_cnpj, invoice.access_key].some((value) => (value ?? "").replace(/\D/g, "").includes(digits))),
    );
  }, [invoices, search]);

  function expand(invoice: ReceivedInvoice, open: boolean) {
    if (!open || details[invoice.id]) return;
    setDetails((current) => ({ ...current, [invoice.id]: "loading" }));
    inventoryService
      .getReceivedInvoice(invoice.id)
      .then((detail) => setDetails((current) => ({ ...current, [invoice.id]: detail })))
      .catch(() => {
        setDetails(({ [invoice.id]: _dropped, ...rest }) => rest);
        showError("Não foi possível carregar os itens da nota.");
      });
  }

  async function download(invoice: ReceivedInvoice) {
    try {
      if (await inventoryService.downloadInvoice(invoice.id)) showSuccess("Download da nota fiscal iniciado.");
      else showError("Arquivo da nota fiscal não encontrado.");
    } catch {
      showError("Não foi possível baixar a nota fiscal.");
    }
  }

  if (loading) return <LoadingState message="Carregando notas fiscais..." />;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ sm: "center" }}>
        <Typography variant="h5">Notas fiscais recebidas</Typography>
        {hasAnyPermission(...RECEIPT_PERMISSIONS) && (
          <Button component={RouterLink} to="/app/receipts/invoice" variant="contained" startIcon={<ReceiptLongIcon />}>
            Receber por nota fiscal
          </Button>
        )}
      </Stack>
      <TextField
        label="Buscar por número, fornecedor, CNPJ ou chave"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
      />
      <Typography variant="body2" color="text.secondary">
        {visible.length} de {invoices.length} nota(s)
      </Typography>

      {invoices.length === 0 && <Alert severity="info">Nenhuma nota fiscal recebida ainda.</Alert>}
      {invoices.length > 0 && visible.length === 0 && <Alert severity="info">Nenhuma nota encontrada para a busca.</Alert>}

      <Box>
        {visible.map((invoice) => {
          const detail = details[invoice.id];
          return (
            <Accordion key={invoice.id} disableGutters onChange={(_event, open) => expand(invoice, open)}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`nota-${invoice.id}`}>
                <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
                    <Typography fontWeight={700}>
                      NF {invoice.number ?? "sem número"}
                      {invoice.series ? ` · série ${invoice.series}` : ""}
                    </Typography>
                    {invoice.total_value != null && <Typography color="text.secondary">{money(invoice.total_value)}</Typography>}
                  </Stack>
                  <Typography sx={{ overflowWrap: "anywhere" }}>{invoice.supplier_name ?? "Fornecedor não informado"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Recebida em {new Date(invoice.received_at).toLocaleString("pt-BR")} por {invoice.received_by_username}
                    {invoice.location_name ? ` · ${invoice.location_name}` : ""}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`${invoice.units} unidade(s) · ${invoice.lines} entrada(s)`} />
                    {invoice.origin && <Chip size="small" label={ORIGIN_LABEL[invoice.origin] ?? invoice.origin} />}
                    {invoice.notes?.includes("Divergências") && <Chip size="small" color="warning" label="Com divergência" />}
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails id={`nota-${invoice.id}`}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
                    {[
                      ["CNPJ", invoice.supplier_cnpj ?? "—"],
                      ["Emissão", invoice.issue_date ? day(invoice.issue_date) : "—"],
                      ["Valor total", invoice.total_value != null ? money(invoice.total_value) : "—"],
                      ["Arquivos", String(invoice.files)],
                    ].map(([label, value]) => (
                      <Box key={label}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  {invoice.access_key && (
                    <Typography variant="body2" sx={{ fontFamily: "Consolas, monospace", overflowWrap: "anywhere" }}>
                      Chave: {invoice.access_key}
                    </Typography>
                  )}
                  {invoice.notes && <Alert severity={invoice.notes.includes("Divergências") ? "warning" : "info"}>{invoice.notes}</Alert>}
                  <Box>
                    <Button variant="outlined" startIcon={<DownloadIcon />} disabled={invoice.files === 0} onClick={() => download(invoice)}>
                      Baixar nota fiscal
                    </Button>
                  </Box>
                  <Typography fontWeight={700}>Itens recebidos</Typography>
                  {detail === "loading" && <LinearProgress aria-label="Carregando itens da nota" />}
                  {detail && detail !== "loading" && (
                    <List disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                      {detail.received_items.map((item, position) => (
                        <ListItemButton key={`${item.item_id}-${position}`} component={RouterLink} to={`/app/inventory/${item.item_id}`} divider={position < detail.received_items.length - 1}>
                          <ListItemText
                            primary={item.name}
                            secondary={[item.patrimony_number, item.item_type === "permanent_component" ? "Permanente" : "Consumível"].filter(Boolean).join(" · ")}
                          />
                          <Typography fontWeight={600} sx={{ ml: 1, whiteSpace: "nowrap" }}>
                            {item.quantity} {item.unit}
                          </Typography>
                        </ListItemButton>
                      ))}
                      {detail.received_items.length === 0 && (
                        <Typography sx={{ p: 1.5 }} color="text.secondary">Nenhum item ligado a esta nota.</Typography>
                      )}
                    </List>
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
    </Stack>
  );
}
