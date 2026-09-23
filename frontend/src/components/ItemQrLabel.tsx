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
import { itemQrUrl, printLabels } from "../labelPrint";
import type { InventoryItem } from "../types";

const codeSx = { fontFamily: "Consolas, 'Cascadia Mono', monospace", fontWeight: 700, letterSpacing: 1 };

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

  function print() {
    if (!printLabels([item], "individual")) showError("Permita pop-ups deste site para imprimir a etiqueta.");
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
