import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";

import { useSnackbar } from "../state/SnackbarContext";
import { withdrawalCode } from "../withdrawalLabels";

const codeSx = { fontFamily: "Consolas, 'Cascadia Mono', monospace", fontWeight: 700, letterSpacing: 2 };

export default function WithdrawalQrCard({ orderId }: { orderId: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { showSuccess, showError } = useSnackbar();
  const code = withdrawalCode(orderId);
  // O QR abre o próprio pedido: quem lê no paiol cai direto na tela de entrega.
  const url = `${window.location.origin}/app/withdrawals/${orderId}`;

  function copy() {
    navigator.clipboard.writeText(code).then(
      () => showSuccess("Código copiado."),
      () => showError("Não foi possível copiar o código."),
    );
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${code}.png`;
    link.click();
  }

  return (
    <Card>
      <CardContent>
        <Stack spacing={2} alignItems="center">
          <Stack spacing={0.5} alignSelf="stretch">
            <Typography variant="h6">QR Code da retirada</Typography>
            <Typography variant="body2" color="text.secondary">
              Apresente no paiol para agilizar a conferência e a entrega.
            </Typography>
          </Stack>
          <QRCodeCanvas
            ref={canvasRef}
            value={url}
            size={240}
            marginSize={2}
            role="img"
            aria-label={`QR Code da retirada ${code}`}
          />
          <Stack alignItems="center">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>CÓDIGO DA RETIRADA</Typography>
            <Typography variant="h5" color="primary" sx={codeSx}>{code}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
            <Button variant="contained" onClick={() => setFullscreen(true)}>Tela cheia</Button>
            <Button variant="outlined" onClick={copy}>Copiar código</Button>
            <Button variant="outlined" onClick={download}>Baixar PNG</Button>
          </Stack>
        </Stack>
      </CardContent>
      <Dialog fullScreen open={fullscreen} onClose={() => setFullscreen(false)} aria-label="QR Code em tela cheia">
        <DialogContent>
          <Stack spacing={3} alignItems="center" justifyContent="center" minHeight="100%">
            <Typography variant="h5" textAlign="center">Retirada no paiol</Typography>
            <QRCodeCanvas value={url} size={320} marginSize={2} style={{ maxWidth: "100%", height: "auto" }} />
            <Typography variant="h4" sx={codeSx}>{code}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFullscreen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
