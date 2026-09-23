import AddIcon from "@mui/icons-material/Add";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import PrintIcon from "@mui/icons-material/Print";
import RemoveIcon from "@mui/icons-material/Remove";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import axios from "axios";
import { ChangeEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import LoadingState from "../components/LoadingState";
import { printLabels } from "../labelPrint";
import { inventoryService, type InvoiceLine, type InvoiceReadResult, type ReceiptPayload } from "../services/inventoryService";
import { useAuth } from "../state/AuthContext";
import { useSnackbar } from "../state/SnackbarContext";
import type { InventoryItem, InventoryLocation } from "../types";

type Stage = "files" | "reading" | "header" | "items" | "review" | "done";
type Origin = ReceiptPayload["origin"];
type ItemType = InventoryItem["item_type"];

interface Decision {
  choice: string | null; // id do item sugerido, "search" ou "new"
  searchItem: InventoryItem | null;
  newName: string;
  newType: ItemType;
  newUnit: string;
  quantity: string;
  photo: File | null;
  photoUrl: string | null;
  missing: boolean;
  confirmed: boolean;
  created: InventoryItem | null;
}

interface Header {
  supplier_name: string;
  supplier_cnpj: string;
  number: string;
  series: string;
  issue_date: string;
  total_value: string;
}

interface DoneSummary {
  lines: number;
  units: number;
  created: number;
  divergences: string[];
  photoFailures: number;
  items: InventoryItem[];
}

const STEPS = ["Nota", "Dados", "Itens", "Revisão"];
const STEP_OF: Record<Stage, number> = { files: 0, reading: 0, header: 1, items: 2, review: 3, done: 4 };
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const origins: Array<{ value: Origin; label: string }> = [
  { value: "compra", label: "Compra" },
  { value: "doacao", label: "Doação" },
  { value: "transferencia", label: "Transferência" },
];
const money = (value: number | null) => (value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const qty = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const sentence = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "");

function apiMessage(error: unknown, fallback: string): string {
  return (axios.isAxiosError(error) ? error.response?.data?.error?.message : undefined) ?? fallback;
}

function initialDecision(line: InvoiceLine, suggestions: InvoiceReadResult["suggestions"][number]): Decision {
  const best = suggestions[0];
  const sure = best && (best.match === "supplier_code" || best.score >= 0.6);
  return {
    choice: sure ? best.item_id : null,
    searchItem: null,
    newName: sentence(line.description),
    newType: "consumable",
    newUnit: (line.unit || "un").toLowerCase(),
    quantity: String(Math.max(1, Math.round(line.quantity))),
    photo: null,
    photoUrl: null,
    missing: false,
    confirmed: false,
    created: null,
  };
}

/** Botão que abre o seletor de arquivo (ou a câmera, com `capture`). */
function FileButton({ label, icon, accept, capture, multiple, variant, onFiles }: {
  label: string;
  icon: ReactNode;
  accept: string;
  capture?: boolean;
  multiple?: boolean;
  variant: "contained" | "outlined" | "text";
  onFiles: (files: File[]) => void;
}) {
  function handle(event: ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }
  return (
    <Button component="label" variant={variant} startIcon={icon} fullWidth>
      {label}
      <input hidden type="file" accept={accept} multiple={multiple} onChange={handle} {...(capture ? { capture: "environment" } : {})} />
    </Button>
  );
}

export default function InvoiceReceiptPage() {
  const [stage, setStage] = useState<Stage>("files");
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceReadResult | null>(null);
  const [header, setHeader] = useState<Header>({ supplier_name: "", supplier_cnpj: "", number: "", series: "", issue_date: "", total_value: "" });
  const [origin, setOrigin] = useState<Origin>("compra");
  const [locationId, setLocationId] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<DoneSummary | null>(null);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const canCreate = hasPermission("inventory:item:create");
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const fileUrls = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => fileUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [fileUrls]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [stage, index]);

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

  function addFiles(picked: File[]) {
    const tooBig = picked.find((file) => file.size > MAX_FILE_BYTES);
    if (tooBig) showError(`${tooBig.name} passa de 15 MB.`);
    setFiles((current) => [...current, ...picked.filter((file) => file.size <= MAX_FILE_BYTES)].slice(0, 10));
  }

  async function readInvoice() {
    setReadError(null);
    setStage("reading");
    try {
      const result = await inventoryService.readInvoice(files);
      setInvoice(result);
      setHeader({
        supplier_name: result.supplier_name ?? "",
        supplier_cnpj: result.supplier_cnpj ?? "",
        number: result.number ?? "",
        series: result.series ?? "",
        issue_date: result.issue_date ?? "",
        total_value: result.total_value == null ? "" : String(result.total_value),
      });
      setDecisions(result.lines.map((line, position) => initialDecision(line, result.suggestions[position] ?? [])));
      setIndex(0);
      setStage("header");
    } catch (error) {
      setReadError(apiMessage(error, "Não foi possível ler a nota. Tente de novo ou lance manualmente."));
      setStage("files");
    }
  }

  function update(position: number, patch: Partial<Decision>) {
    setDecisions((current) => current.map((entry, i) => (i === position ? { ...entry, ...patch } : entry)));
  }

  function resolved(decision: Decision): InventoryItem | null {
    if (decision.created) return decision.created;
    if (decision.choice === "search") return decision.searchItem;
    return decision.choice && decision.choice !== "new" ? byId.get(decision.choice) ?? null : null;
  }

  function setPhoto(position: number, file: File | null) {
    const previous = decisions[position]?.photoUrl;
    if (previous) URL.revokeObjectURL(previous);
    update(position, { photo: file, photoUrl: file ? URL.createObjectURL(file) : null });
  }

  function lineError(decision: Decision): string | null {
    if (!decision.choice) return "Escolha o item do estoque ou cadastre um novo.";
    if (decision.choice === "search" && !decision.searchItem) return "Busque e selecione o item.";
    if (decision.choice === "new" && (!decision.newName.trim() || !decision.newUnit.trim())) return "Informe nome e unidade do item novo.";
    if (!(Number(decision.quantity) > 0) || !Number.isInteger(Number(decision.quantity))) return "Informe a quantidade recebida (número inteiro).";
    return null;
  }

  function next() {
    if (index + 1 < decisions.length) setIndex(index + 1);
    else setStage("review");
  }

  function status(decision: Decision, line: InvoiceLine): { label: string; color: "success" | "info" | "warning" | "default" | "error" } {
    if (decision.missing) return { label: "Não veio", color: "error" };
    if (!decision.confirmed) return { label: "Pendente", color: "default" };
    if (Number(decision.quantity) !== line.quantity) return { label: "Qtd. diferente", color: "warning" };
    if (isPermanent(decision)) return { label: `${decision.quantity} unidade(s) nova(s)`, color: "info" };
    if (decision.choice === "new") return { label: "Item novo", color: "info" };
    return { label: "Vinculado", color: "success" };
  }

  function isPermanent(decision: Decision): boolean {
    return (decision.choice === "new" && !decision.created ? decision.newType : resolved(decision)?.item_type) === "permanent_component";
  }

  async function register() {
    if (!invoice || sending) return;
    const location = locations.find((entry) => entry.id === locationId);
    setSending(true);
    try {
      // Cadastra os itens novos primeiro; os já criados ficam na tela e não se repetem ao tentar de novo.
      const current = [...decisions];
      for (let i = 0; i < current.length; i++) {
        const decision = current[i];
        if (decision.missing || decision.choice !== "new" || decision.created) continue;
        const created = await inventoryService.createItem({
          item_type: decision.newType,
          name: decision.newName.trim(),
          unit: decision.newUnit.trim(),
          location_name: location?.name,
          invoice_number: header.number || undefined,
          initial_quantity: 0,
          reason: `Cadastro no recebimento da NF ${header.number || "sem número"}.`,
        });
        current[i] = { ...decision, created };
        setDecisions([...current]);
      }

      // Soma linhas que caíram no mesmo item: a entrada não aceita item repetido.
      const merged = new Map<string, { item_id: string; quantity: number; supplier_code?: string; permanent: boolean; photos: File[] }>();
      const divergences: string[] = [];
      current.forEach((decision, i) => {
        const line = invoice.lines[i];
        if (decision.missing) {
          divergences.push(`Não veio: ${line.description} (${qty(line.quantity)} ${line.unit ?? ""})`.trim());
          return;
        }
        const item = resolved(decision)!;
        const amount = Number(decision.quantity);
        if (amount !== line.quantity) divergences.push(`${item.name}: ${qty(amount)} de ${qty(line.quantity)}`);
        const entry = merged.get(item.id) ?? { item_id: item.id, quantity: 0, permanent: item.item_type === "permanent_component", photos: [] };
        entry.quantity += amount;
        if (line.supplier_code && !entry.supplier_code) entry.supplier_code = line.supplier_code;
        if (decision.photo) entry.photos.push(decision.photo);
        merged.set(item.id, entry);
      });
      const document = [`NF ${header.number || "sem número"}${header.series ? ` série ${header.series}` : ""}`, header.supplier_name.trim()].filter(Boolean).join(" · ");
      const noteText = [notes.trim(), divergences.length ? `Divergências: ${divergences.join("; ")}.` : ""].filter(Boolean).join(" ");
      const result = await inventoryService.registerReceipt({
        origin,
        location_id: locationId,
        document: document.slice(0, 160),
        ...(noteText ? { notes: noteText } : {}),
        lines: [...merged.values()].map(({ item_id, quantity, supplier_code }) => ({ item_id, quantity, ...(supplier_code ? { supplier_code } : {}) })),
        invoice_id: invoice.invoice_id,
        ...(header.number.trim() ? { invoice_number: header.number.trim() } : {}),
        ...(header.series.trim() ? { invoice_series: header.series.trim() } : {}),
        ...(header.supplier_name.trim() ? { supplier_name: header.supplier_name.trim() } : {}),
        ...(header.supplier_cnpj.trim() ? { supplier_cnpj: header.supplier_cnpj.trim() } : {}),
        ...(header.issue_date ? { issue_date: header.issue_date } : {}),
        ...(header.total_value && Number(header.total_value) >= 0 ? { total_value: Number(header.total_value) } : {}),
        ...(invoice.access_key ? { access_key: invoice.access_key } : {}),
      });

      // Fotos por último: falha numa foto não desfaz a entrada. A resposta traz os itens na ordem das
      // linhas; permanente traz uma unidade nova por peça e cada unidade recebe a foto.
      let photoFailures = 0;
      let cursor = 0;
      for (const entry of merged.values()) {
        const targets = result.items.slice(cursor, cursor + (entry.permanent ? entry.quantity : 1));
        cursor += targets.length;
        for (const target of targets) {
          for (const photo of entry.photos) {
            await inventoryService.uploadReceiptPhoto(target.id, photo).catch(() => {
              photoFailures += 1;
            });
          }
        }
      }
      setDone({
        lines: result.items.length,
        units: result.total_quantity,
        created: result.items.filter((item) => !byId.has(item.id)).length,
        divergences,
        photoFailures,
        items: result.items,
      });
      setStage("done");
      showSuccess(`Entrada registrada: ${result.total_quantity} unidade(s).`);
    } catch (error) {
      showError(apiMessage(error, "Não foi possível registrar a entrada."));
    } finally {
      setSending(false);
    }
  }

  function restart() {
    decisions.forEach((decision) => decision.photoUrl && URL.revokeObjectURL(decision.photoUrl));
    setFiles([]);
    setInvoice(null);
    setDecisions([]);
    setNotes("");
    setDone(null);
    setStage("files");
  }

  if (loading) return <LoadingState message="Carregando itens e locais..." />;

  const preview = (stage === "header" || stage === "items") && (
    <Card sx={{ display: { xs: "none", md: "block" }, position: "sticky", top: 16, alignSelf: "start", bgcolor: "#e2e8f0" }}>
      <Stack spacing={1} sx={{ p: 1, maxHeight: "80vh", overflow: "auto" }}>
        {fileUrls.map(({ file, url }) =>
          file.type === "application/pdf" ? (
            <Box key={url} component="object" data={url} type="application/pdf" aria-label={file.name} sx={{ width: "100%", height: "78vh", border: 0 }} />
          ) : (
            <Box key={url} component="img" src={url} alt={`Página da nota: ${file.name}`} sx={{ width: "100%", display: "block", bgcolor: "#fff" }} />
          ),
        )}
      </Stack>
    </Card>
  );

  const line = invoice?.lines[index];
  const decision = decisions[index];
  const uncertain = new Set(invoice?.uncertain_fields ?? []);
  const warnField = (key: keyof Header, sx: object = {}) => ({
    sx: {
      ...sx,
      ...(uncertain.has(key) && { "& .MuiOutlinedInput-notchedOutline": { borderColor: "warning.main", borderWidth: 2 }, "& .MuiFormHelperText-root": { color: "warning.dark" } }),
    },
    ...(uncertain.has(key) && { helperText: "Leitura incerta: confira no papel." }),
  });
  const receivedCount = decisions.filter((entry) => !entry.missing).length;
  const pending = decisions.findIndex((entry) => !entry.missing && !entry.confirmed);

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Typography variant="h5">Receber por nota fiscal</Typography>
        {invoice && stage !== "done" && <Chip label={`NF ${header.number || "sem número"}`} />}
      </Stack>
      {stage !== "done" && (
        <Stepper activeStep={STEP_OF[stage]} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {stage === "files" && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography color="text.secondary">Fotografe a DANFE ou envie o PDF. O sistema lê os itens e você confirma um por um.</Typography>
              {readError && <Alert severity="error">{readError}</Alert>}
              <Stack spacing={1.5} alignItems="center" sx={{ p: 2, border: "2px dashed #5eead4", borderRadius: 2, bgcolor: "#f0fdfa", textAlign: "center" }}>
                <DescriptionIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography fontWeight={700}>Nota fiscal do recebimento</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%" }}>
                  <FileButton label="Tirar foto da nota" icon={<CameraAltIcon />} accept="image/*" capture variant="contained" onFiles={addFiles} />
                  <FileButton label="Enviar foto ou PDF" icon={<UploadFileIcon />} accept={ACCEPT} multiple variant="outlined" onFiles={addFiles} />
                </Stack>
                <Typography variant="caption" color="text.secondary">JPG, PNG, WEBP ou PDF · até 15 MB por arquivo · uma foto por página</Typography>
              </Stack>
              {files.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="overline" color="text.secondary">Arquivos da nota</Typography>
                  {fileUrls.map(({ file, url }, position) => (
                    <Card key={url} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1 }}>
                      {file.type === "application/pdf" ? (
                        <DescriptionIcon color="action" sx={{ fontSize: 40 }} />
                      ) : (
                        <Box component="img" src={url} alt="" sx={{ width: 40, height: 52, objectFit: "cover", borderRadius: 1 }} />
                      )}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography noWrap fontWeight={600}>{file.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {(file.size / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB
                        </Typography>
                      </Box>
                      <IconButton aria-label={`Remover ${file.name}`} onClick={() => setFiles((current) => current.filter((_f, i) => i !== position))}>
                        <CloseIcon />
                      </IconButton>
                    </Card>
                  ))}
                  <FileButton label="Adicionar outra página (foto)" icon={<AddIcon />} accept="image/*" capture variant="text" onFiles={addFiles} />
                </Stack>
              )}
              <Button variant="contained" size="large" disabled={files.length === 0} onClick={readInvoice}>
                Ler nota fiscal
              </Button>
              <Button component={RouterLink} to="/app/receipts/new">
                Prefiro lançar manualmente
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {stage === "reading" && (
        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="center" sx={{ py: 4, textAlign: "center" }} role="status">
              <Typography variant="h6">Lendo a nota fiscal</Typography>
              <LinearProgress sx={{ width: "100%", maxWidth: 360 }} />
              <Typography color="text.secondary">Identificando os itens e comparando com o estoque. Pode levar até 40 segundos; não feche esta tela.</Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {(stage === "header" || stage === "items") && invoice && (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.1fr) minmax(360px, 1fr)" } }}>
          {preview}
          {stage === "header" ? (
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Confira os dados da nota</Typography>
                  <Typography variant="body2" color="text.secondary">Corrija o que estiver diferente do papel.</Typography>
                  {invoice.already_received && (
                    <Alert
                      severity="warning"
                      action={
                        <Button color="inherit" size="small" component={RouterLink} to="/app/receipts/invoices">
                          Ver notas
                        </Button>
                      }
                    >
                      Esta nota já foi recebida em {new Date(invoice.already_received.received_at).toLocaleString("pt-BR")} por{" "}
                      {invoice.already_received.received_by_username}. Registrar de novo soma o material outra vez.
                    </Alert>
                  )}
                  <TextField label="Fornecedor" value={header.supplier_name} onChange={(e) => setHeader({ ...header, supplier_name: e.target.value })} {...warnField("supplier_name")} />
                  <TextField label="CNPJ" value={header.supplier_cnpj} onChange={(e) => setHeader({ ...header, supplier_cnpj: e.target.value })} {...warnField("supplier_cnpj")} />
                  <Stack direction="row" spacing={2}>
                    <TextField label="Número" value={header.number} onChange={(e) => setHeader({ ...header, number: e.target.value })} fullWidth {...warnField("number")} />
                    <TextField label="Série" value={header.series} onChange={(e) => setHeader({ ...header, series: e.target.value })} {...warnField("series", { width: 120, flexShrink: 0 })} />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField label="Emissão" type="date" value={header.issue_date} onChange={(e) => setHeader({ ...header, issue_date: e.target.value })} fullWidth slotProps={{ inputLabel: { shrink: true } }} {...warnField("issue_date")} />
                    <TextField label="Valor total (R$)" type="number" value={header.total_value} onChange={(e) => setHeader({ ...header, total_value: e.target.value })} fullWidth {...warnField("total_value")} />
                  </Stack>
                  <ToggleButtonGroup exclusive fullWidth color="primary" aria-label="Origem do material" value={origin} onChange={(_e, value: Origin | null) => value && setOrigin(value)}>
                    {origins.map((option) => (
                      <ToggleButton key={option.value} value={option.value}>
                        {option.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <TextField select label="Guardar em" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                    {locations.map((location) => (
                      <MenuItem key={location.id} value={location.id}>
                        {location.name}
                      </MenuItem>
                    ))}
                  </TextField>
                  {invoice.lines.length > 0 ? (
                    <Alert severity="info">
                      <b>{invoice.lines.length} ite{invoice.lines.length === 1 ? "m encontrado" : "ns encontrados"}.</b> Na próxima etapa você confirma cada um e pode tirar foto.
                    </Alert>
                  ) : (
                    <Alert severity="warning">Nenhum item foi encontrado na nota. Envie uma foto mais nítida ou lance manualmente.</Alert>
                  )}
                  <Button variant="contained" size="large" disabled={!locationId || invoice.lines.length === 0} onClick={() => setStage("items")}>
                    Começar conferência ({invoice.lines.length} {invoice.lines.length === 1 ? "item" : "itens"})
                  </Button>
                  <Button onClick={restart}>Trocar arquivo</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            line &&
            decision && (
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="h6">
                        Item {index + 1} de {invoice.lines.length}
                      </Typography>
                      <LinearProgress variant="determinate" value={((index + 1) / invoice.lines.length) * 100} sx={{ width: 96 }} aria-label="Progresso da conferência" />
                    </Stack>
                    <Stack spacing={1} sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f1f5f9" }}>
                      <Typography variant="overline" color="text.secondary" lineHeight={1.2}>Lido na nota</Typography>
                      <Typography sx={{ fontFamily: "Consolas, monospace", fontWeight: 600, p: 1, bgcolor: "#fff", border: "2px solid", borderColor: "primary.main", borderRadius: 1 }}>
                        {line.description}
                      </Typography>
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1 }}>
                        {[
                          ["Cód. forn.", line.supplier_code ?? "—"],
                          ["NCM", line.ncm ?? "—"],
                          ["Qtd", `${qty(line.quantity)} ${line.unit ?? ""}`],
                          ["Vl. unit.", money(line.unit_value)],
                        ].map(([label, value]) => (
                          <Box key={label}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography variant="body2" fontWeight={600} noWrap>{value}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>

                    <Typography fontWeight={700} id="choice-label">Qual item do estoque é este?</Typography>
                    <RadioGroup aria-labelledby="choice-label" value={decision.choice ?? ""} onChange={(e) => update(index, { choice: e.target.value })} sx={{ gap: 1 }}>
                      {(invoice.suggestions[index] ?? []).map((suggestion) => {
                        const item = byId.get(suggestion.item_id);
                        if (!item) return null;
                        const chip =
                          suggestion.match === "supplier_code" ? { label: "Já vinculado", color: "success" as const } :
                          suggestion.score >= 0.75 ? { label: "Muito parecido", color: "success" as const } :
                          { label: "Parecido", color: "default" as const };
                        return (
                          <FormControlLabel
                            key={item.id}
                            value={item.id}
                            control={<Radio />}
                            sx={{ m: 0, pr: 1, border: "1px solid", borderColor: decision.choice === item.id ? "primary.main" : "divider", borderRadius: 2, bgcolor: decision.choice === item.id ? "#f0fdfa" : "background.paper" }}
                            slotProps={{ typography: { component: "div", sx: { flexGrow: 1, py: 1 } } }}
                            label={
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography fontWeight={600}>{item.name}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.item_type === "consumable" ? "Consumível" : "Permanente"} · saldo: {item.stock_total} {item.unit}
                                    {item.patrimony_number ? ` · ${item.patrimony_number}` : ""}
                                  </Typography>
                                </Box>
                                <Chip size="small" label={chip.label} color={chip.color} />
                              </Stack>
                            }
                          />
                        );
                      })}
                      <FormControlLabel value="search" control={<Radio />} label="Buscar outro item do estoque" sx={{ m: 0, border: "1px solid", borderColor: "divider", borderRadius: 2 }} />
                      {canCreate && (
                        <FormControlLabel value="new" control={<Radio />} label="Não está no estoque: cadastrar item novo" sx={{ m: 0, border: "1px solid", borderColor: "divider", borderRadius: 2 }} />
                      )}
                    </RadioGroup>
                    {isPermanent(decision) && (
                      <Alert severity="info">
                        Permanente: cada peça vira uma unidade nova, com patrimônio e etiqueta próprios
                        {resolved(decision) ? `, usando o cadastro de ${resolved(decision)!.name}` : ""}. Serão {decision.quantity || 0} unidade(s).
                      </Alert>
                    )}
                    {!canCreate && (
                      <Typography variant="body2" color="text.secondary">Material sem cadastro: peça ao administrador do inventário ou marque "Item não veio".</Typography>
                    )}
                    {decision.choice === "search" && (
                      <Autocomplete
                        options={items}
                        value={decision.searchItem}
                        getOptionLabel={(option) => [option.name, option.patrimony_number].filter(Boolean).join(" · ")}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        onChange={(_e, value) => update(index, { searchItem: value })}
                        renderInput={(params) => <TextField {...params} label="Buscar por nome ou patrimônio" autoFocus />}
                      />
                    )}
                    {decision.choice === "new" && (
                      <Stack spacing={2} sx={{ p: 1.5, border: "1px solid #bfdbfe", bgcolor: "#eff6ff", borderRadius: 2 }}>
                        <Typography variant="body2">Os dados vieram da nota; ajuste se precisar. O número patrimonial é gerado ao registrar.</Typography>
                        <TextField label="Nome do item" value={decision.newName} onChange={(e) => update(index, { newName: e.target.value })} required />
                        <ToggleButtonGroup exclusive fullWidth color="primary" aria-label="Tipo do item" value={decision.newType} onChange={(_e, value: ItemType | null) => value && update(index, { newType: value })}>
                          <ToggleButton value="consumable">Consumível</ToggleButton>
                          <ToggleButton value="permanent_component">Permanente</ToggleButton>
                        </ToggleButtonGroup>
                        <TextField label="Unidade" value={decision.newUnit} onChange={(e) => update(index, { newUnit: e.target.value })} required />
                      </Stack>
                    )}

                    <Typography fontWeight={700}>Quantidade recebida</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <IconButton aria-label="Diminuir quantidade" onClick={() => update(index, { quantity: String(Math.max(1, Number(decision.quantity) - 1)) })}>
                        <RemoveIcon />
                      </IconButton>
                      <TextField
                        type="number"
                        value={decision.quantity}
                        onChange={(e) => update(index, { quantity: e.target.value })}
                        slotProps={{ htmlInput: { min: 1, step: 1, "aria-label": "Quantidade recebida", style: { textAlign: "center" } } }}
                        sx={{ width: 96 }}
                      />
                      <IconButton aria-label="Aumentar quantidade" onClick={() => update(index, { quantity: String(Number(decision.quantity) + 1) })}>
                        <AddIcon />
                      </IconButton>
                      <Typography color="text.secondary">{resolved(decision)?.unit ?? decision.newUnit}</Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: "4px !important" }}>
                      Na nota: {qty(line.quantity)} {line.unit}
                    </Typography>
                    {Number(decision.quantity) !== line.quantity && (
                      <Alert severity="warning">Diferente da nota. Fica registrado como divergência na entrada.</Alert>
                    )}

                    <Stack direction="row" spacing={1} alignItems="baseline">
                      <Typography fontWeight={700}>Foto do material</Typography>
                      <Typography variant="body2" color="text.secondary">opcional</Typography>
                    </Stack>
                    {decision.photoUrl ? (
                      <Card sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1 }}>
                        <Box component="img" src={decision.photoUrl} alt="Foto do material" sx={{ width: 64, height: 64, objectFit: "cover", borderRadius: 1 }} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography fontWeight={600}>Foto adicionada</Typography>
                          <Typography variant="body2" color="text.secondary">Vai para o cadastro do item</Typography>
                        </Box>
                        <IconButton aria-label="Remover foto" onClick={() => setPhoto(index, null)}>
                          <CloseIcon />
                        </IconButton>
                      </Card>
                    ) : (
                      <Stack direction="row" spacing={1}>
                        <FileButton label="Tirar foto" icon={<CameraAltIcon />} accept="image/*" capture variant="outlined" onFiles={([file]) => file && setPhoto(index, file)} />
                        <FileButton label="Galeria" icon={<PhotoLibraryIcon />} accept="image/jpeg,image/png,image/webp" variant="text" onFiles={([file]) => file && setPhoto(index, file)} />
                      </Stack>
                    )}

                    {lineError(decision) && decision.choice && <Alert severity="warning">{lineError(decision)}</Alert>}
                    <Button
                      variant="contained"
                      size="large"
                      disabled={Boolean(lineError(decision))}
                      onClick={() => {
                        update(index, { confirmed: true, missing: false });
                        next();
                      }}
                    >
                      Confirmar item
                    </Button>
                    <Stack direction="row" spacing={1}>
                      <Button fullWidth onClick={() => (index === 0 ? setStage("header") : setIndex(index - 1))}>
                        {index === 0 ? "Dados da nota" : "Item anterior"}
                      </Button>
                      <Button
                        fullWidth
                        color="error"
                        onClick={() => {
                          update(index, { missing: true, confirmed: true });
                          next();
                        }}
                      >
                        Item não veio
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            )
          )}
        </Box>
      )}

      {stage === "review" && invoice && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Revise a entrada</Typography>
              <Typography variant="body2" color="text.secondary">Toque num item para corrigir.</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                {[
                  ["Nota", `${header.number || "sem número"}${header.series ? ` · série ${header.series}` : ""}`],
                  ["Origem", origins.find((option) => option.value === origin)?.label],
                  ["Fornecedor", header.supplier_name || "—"],
                  ["Guardar em", locations.find((entry) => entry.id === locationId)?.name],
                ].map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              <List disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                {decisions.map((entry, position) => {
                  const invoiceLine = invoice.lines[position];
                  const tag = status(entry, invoiceLine);
                  const item = resolved(entry);
                  return (
                    <ListItemButton
                      key={position}
                      divider={position < decisions.length - 1}
                      onClick={() => {
                        setIndex(position);
                        setStage("items");
                      }}
                      sx={{ gap: 1.5 }}
                    >
                      {entry.photoUrl ? (
                        <Box component="img" src={entry.photoUrl} alt="" sx={{ width: 44, height: 44, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} />
                      ) : (
                        <Box sx={{ width: 44, height: 44, flexShrink: 0, border: "1.5px dashed #cbd5e1", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
                          <CameraAltIcon fontSize="small" titleAccess="Sem foto" />
                        </Box>
                      )}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} sx={{ overflowWrap: "anywhere" }}>{entry.choice === "new" ? entry.newName : item?.name ?? invoiceLine.description}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {entry.missing ? `${qty(invoiceLine.quantity)} ${invoiceLine.unit ?? ""} na nota` : `${entry.quantity} de ${qty(invoiceLine.quantity)} ${invoiceLine.unit ?? ""}`}
                        </Typography>
                      </Box>
                      <Chip size="small" label={tag.label} color={tag.color} />
                      <ChevronRightIcon color="action" />
                    </ListItemButton>
                  );
                })}
              </List>
              <TextField label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} placeholder="Ex.: 2 manilhas faltando, fornecedor avisado" />
              {pending >= 0 && <Alert severity="warning">Confirme o item {pending + 1} antes de registrar.</Alert>}
              {receivedCount === 0 && <Alert severity="warning">Nenhum item foi recebido; não há entrada para registrar.</Alert>}
              <Button variant="contained" size="large" disabled={pending >= 0 || receivedCount === 0} loading={sending} loadingPosition="start" onClick={register}>
                Registrar entrada
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {stage === "done" && done && (
        <Card>
          <CardContent>
            <Stack spacing={2} alignItems="stretch">
              <Stack spacing={1} alignItems="center" sx={{ textAlign: "center", py: 2 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 64 }} />
                <Typography variant="h5">Entrada registrada</Typography>
                <Typography color="text.secondary">
                  {done.lines} {done.lines === 1 ? "item" : "itens"} · {done.units} unidade(s) · saldo atualizado
                </Typography>
              </Stack>
              <Alert severity="success">NF {header.number || "sem número"} anexada à entrada.</Alert>
              {done.created > 0 && <Alert severity="info">{done.created} item(ns) ou unidade(s) nova(s) com número patrimonial gerado.</Alert>}
              {done.divergences.length > 0 && <Alert severity="warning">Divergências registradas: {done.divergences.join("; ")}.</Alert>}
              {done.photoFailures > 0 && <Alert severity="error">{done.photoFailures} foto(s) não foram enviadas. Anexe pela ficha do item.</Alert>}
              <Button
                variant="contained"
                size="large"
                startIcon={<PrintIcon />}
                onClick={() => !printLabels(done.items, "a4") && showError("Permita pop-ups deste site para imprimir as etiquetas.")}
              >
                Imprimir etiquetas (folha A4)
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() =>
                  inventoryService
                    .downloadInvoice(invoice!.invoice_id)
                    .catch(() => showError("Não foi possível baixar a nota fiscal."))
                }
              >
                Baixar nota fiscal
              </Button>
              <Button variant="outlined" onClick={() => navigate("/app/inventory")}>
                Ver itens no estoque
              </Button>
              <Button onClick={restart}>Receber outra nota</Button>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
