import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";

import { useSnackbar } from "../state/SnackbarContext";
import type { InventoryItem } from "../types";

const codeSx = { fontFamily: "Consolas, 'Cascadia Mono', monospace", fontWeight: 700, letterSpacing: 1 };

/** Link gravado no QR do item: a câmera do celular abre a ficha e a tela Escanear extrai o número. */
export function itemQrUrl(patrimony: string): string {
  return `${window.location.origin}/app/p/${encodeURIComponent(patrimony)}`;
}

const LABEL_CSS =
  "@page{size:62mm 29mm;margin:0}body{margin:0;font-family:Arial,sans-serif}" +
  ".l{display:flex;gap:2mm;align-items:center;width:62mm;height:29mm;box-sizing:border-box;padding:2mm}" +
  "img{width:25mm;height:25mm}small{font-size:6pt;font-weight:700;letter-spacing:.15em;color:#0f766e}" +
  "b{display:block;font:700 11pt Consolas,monospace;margin:1mm 0}span{font-size:7pt}";

export default function ItemQrLabel({ item }: { item: InventoryItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { showError } = useSnackbar();
  const patrimony = item.patrimony_number;
  if (!patrimony) return null;

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${patrimony}.png`;
    link.click();
  }

  // Janela própria com a etiqueta 62 × 29 mm; texto via textContent (nome do item é dado do usuário).
  function print() {
    const canvas = canvasRef.current;
    const win = window.open("", "_blank", "width=480,height=320");
    if (!canvas || !win) {
      showError("Permita pop-ups deste site para imprimir a etiqueta.");
      return;
    }
    const doc = win.document;
    doc.title = patrimony!;
    const style = doc.createElement("style");
    style.textContent = LABEL_CSS;
    doc.head.append(style);
    const label = doc.createElement("div");
    label.className = "l";
    const img = doc.createElement("img");
    img.alt = patrimony!;
    img.onload = () => {
      win.focus();
      win.print();
    };
    img.src = canvas.toDataURL("image/png");
    const text = doc.createElement("div");
    const brand = doc.createElement("small");
    brand.textContent = "REMOBS";
    const code = doc.createElement("b");
    code.textContent = patrimony!;
    const name = doc.createElement("span");
    name.textContent = item.name;
    text.append(brand, code, name);
    label.append(img, text);
    doc.body.append(label);
  }

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <QRCodeCanvas
            ref={canvasRef}
            value={itemQrUrl(patrimony)}
            size={256}
            marginSize={2}
            style={{ width: 128, height: 128 }}
            role="img"
            aria-label={`QR Code do patrimônio ${patrimony}`}
          />
          <Stack spacing={1} flexGrow={1} alignItems={{ xs: "center", sm: "flex-start" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Número patrimonial
            </Typography>
            <Typography variant="h5" color="primary" sx={codeSx}>
              {patrimony}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Cole a etiqueta no item. O QR Code abre esta ficha e adiciona o item à retirada.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<PrintIcon />} onClick={print}>
                Imprimir etiqueta
              </Button>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={download}>
                Baixar PNG
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
