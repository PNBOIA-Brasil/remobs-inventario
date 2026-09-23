import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import QrCameraScanner, { canUseCamera } from "../components/QrCameraScanner";

import { inventoryService } from "../services/inventoryService";
import type { InventoryItem } from "../types";
import { returnCode, withdrawalCode } from "../withdrawalLabels";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const WITHDRAWAL_URL = new RegExp(`/withdrawals/(${UUID.source})`, "i");
const WITHDRAWAL_CODE = /^RET-[0-9A-F]{8}$/i;
const RETURN_PARAM = new RegExp(`[?&]devolucao=(${UUID.source})`, "i");
const RETURN_CODE = /^DEV-[0-9A-F]{8}$/i;

/** Etiqueta com o id do item (ou link /app/inventory/<id>) abre direto; senão busca por patrimônio, série ou nome. */
export function itemIdFromCode(code: string): string | null {
  const match = code.match(UUID);
  return match ? match[0].toLowerCase() : null;
}

/** QR da retirada (link /app/withdrawals/<id>) abre o pedido na etapa em que ele está. */
export function withdrawalIdFromCode(code: string): string | null {
  const match = code.match(WITHDRAWAL_URL);
  return match ? match[1].toLowerCase() : null;
}

/** QR da devolução (link /app/withdrawals/<id>?devolucao=<evento>) destaca a devolução para o paiol. */
export function withdrawalPathFromCode(code: string): string | null {
  const withdrawalId = withdrawalIdFromCode(code);
  if (!withdrawalId) return null;
  const returnId = code.match(RETURN_PARAM)?.[1].toLowerCase();
  return `/app/withdrawals/${withdrawalId}${returnId ? `?devolucao=${returnId}` : ""}`;
}

const PATRIMONY_URL = /\/app\/p\/([^/?#]+)/i;

/** QR do item (link /app/p/<patrimônio>): devolve o número patrimonial. */
export function patrimonyFromCode(code: string): string | null {
  const match = code.match(PATRIMONY_URL);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Item da lista pelo QR do patrimônio, id/link do item, patrimônio ou série digitados. */
export function findItemByCode(items: InventoryItem[], raw: string): InventoryItem | null {
  const value = (patrimonyFromCode(raw) ?? raw).trim().toLowerCase();
  const id = itemIdFromCode(value);
  return (
    items.find(
      (item) => item.id === id || item.patrimony_number?.toLowerCase() === value || item.serial_number?.toLowerCase() === value,
    ) ?? null
  );
}

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [results, setResults] = useState<InventoryItem[] | null>(null);
  const [withdrawalNotFound, setWithdrawalNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const routeNavigate = useNavigate();
  // /app/p/<patrimônio> (QR lido pela câmera do celular) resolve aqui e sai do histórico.
  const { code: patrimonyParam } = useParams();
  const navigate = (path: string) => routeNavigate(path, { replace: Boolean(patrimonyParam) });

  useEffect(() => {
    if (!patrimonyParam) return;
    setCode(patrimonyParam);
    void lookup(patrimonyParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup só navega/atualiza estado
  }, [patrimonyParam]);

  async function lookup(raw: string) {
    const value = (patrimonyFromCode(raw) ?? raw).trim();
    setResults(null);
    setWithdrawalNotFound(false);
    if (!value) return;
    const withdrawalPath = withdrawalPathFromCode(value);
    if (withdrawalPath) {
      navigate(withdrawalPath);
      return;
    }
    if (WITHDRAWAL_CODE.test(value) || RETURN_CODE.test(value)) {
      await openWithdrawalByCode(value.toUpperCase());
      return;
    }
    const directId = itemIdFromCode(value);
    if (directId) {
      navigate(`/app/inventory/${directId}`);
      return;
    }
    setSearching(true);
    try {
      const { items } = await inventoryService.listItems({ q: value });
      const exact = items.filter(
        (item) =>
          item.patrimony_number?.toLowerCase() === value.toLowerCase() ||
          item.serial_number?.toLowerCase() === value.toLowerCase(),
      );
      const found = exact.length > 0 ? exact : items;
      if (found.length === 1) {
        navigate(`/app/inventory/${found[0].id}`);
        return;
      }
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  // Código RET- ou DEV- digitado: procura entre as retiradas visíveis ao usuário.
  async function openWithdrawalByCode(value: string) {
    setSearching(true);
    try {
      const { items } = await inventoryService.listWithdrawals();
      const order = items.find((candidate) => withdrawalCode(candidate.id) === value);
      if (order) {
        navigate(`/app/withdrawals/${order.id}`);
        return;
      }
      for (const candidate of items) {
        const event = candidate.events?.find((item) => returnCode(item.id) === value);
        if (event) {
          navigate(`/app/withdrawals/${candidate.id}?devolucao=${event.id}`);
          return;
        }
      }
      setWithdrawalNotFound(true);
    } catch {
      setWithdrawalNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void lookup(code);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Escanear etiqueta</Typography>
      <Typography variant="body2" color="text.secondary">
        Leia a etiqueta do material ou o QR Code da retirada ou da devolução, ou digite o patrimônio, o número de série, parte do nome ou o código RET- ou DEV-.
      </Typography>

      {canUseCamera() ? (
        cameraOn ? (
          <Stack spacing={1}>
            <QrCameraScanner
              onCode={(value) => {
                setCameraOn(false);
                setCode(value);
                void lookup(value);
              }}
              onError={setCameraError}
            />
            <Button onClick={() => setCameraOn(false)}>Fechar câmera</Button>
          </Stack>
        ) : (
          <Button variant="contained" size="large" startIcon={<QrCodeScannerIcon />} onClick={() => { setCameraError(null); setCameraOn(true); }}>
            Abrir câmera
          </Button>
        )
      ) : (
        <Alert severity="info">Leitura pela câmera indisponível neste navegador. Digite o código abaixo.</Alert>
      )}
      {cameraError && <Alert severity="warning">{cameraError}</Alert>}

      <Stack component="form" direction="row" spacing={1} onSubmit={submit}>
        <TextField label="Código" value={code} onChange={(event) => setCode(event.target.value)} fullWidth />
        <Button type="submit" variant="outlined" disabled={!code.trim() || searching}>
          Buscar
        </Button>
      </Stack>

      {withdrawalNotFound && <Alert severity="warning">Nenhuma retirada encontrada para este código.</Alert>}
      {results && results.length === 0 && <Alert severity="warning">Nenhum material encontrado para este código.</Alert>}
      {results && results.length > 1 && (
        <Stack spacing={1}>
          <Typography fontWeight={700}>{results.length} materiais encontrados</Typography>
          {results.map((item) => (
            <Card key={item.id}>
              <CardActionArea onClick={() => navigate(`/app/inventory/${item.id}`)}>
                <CardContent>
                  <Typography fontWeight={700}>{item.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {[item.patrimony_number, item.serial_number].filter(Boolean).join(" · ") || "Sem patrimônio"} · saldo {item.stock_total} {item.unit}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
